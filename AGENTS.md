# AGENTS.md — handover document for `keyclock-demo` ("MyApp")

Author: outgoing senior engineer. Last verified: 2026-11-26.
Everything below was checked by running the build, the tests, the config validators and a live Keycloak 26.0.8 — not copied from comments. §8 states which claims were executed and which are code-reading findings.

Read this file before touching anything. It replaces `avante.md` (see §12).

---

## 1. TL;DR — what this project actually is

A **Keycloak 26 identity/authentication demo**, not an e-commerce platform.
It is a three-part stack that demonstrates one thing end-to-end: **how an Angular SPA logs in via Keycloak, and how a Node/Express REST API verifies the resulting JWT and reads the user's profile from the Keycloak Admin REST API**.

- No application database, no orders, no catalog, no Java/JavaEE code. PostgreSQL exists only as Keycloak's own datastore.
- Two pages: `/login` and `/user-info`. Three REST endpoints: `/api/health`, `/api/user-info`, `/api/users/:id`.
- Demo quality: it works for a happy path with two hardcoded users. It is **not** production-ready (see §9).
- Git was initialized during this handover (2026-11-26): branch `main`, one commit (`18a62ea`), tag `backend-working`. There is **no history before that commit** — do not assume any.

Current state of the code (verified):

| Area | Status |
|---|---|
| Package manager | **pnpm 12.23.0** (migrated from npm on 2026-11-26, pinned via `packageManager` in both `package.json` files, run through corepack). Backend install/build/tests green; frontend install green; the backend Docker image builds and serves `/api/health` |
| Backend TypeScript | compiles clean (`pnpm run build` → no errors), 8 Jest tests pass |
| Backend `dist/` | rebuilt during this handover (2026-11-26), now matches `src`; it was stale before and broken against Keycloak 26 (see §8.1) |
| Frontend | **cannot build** — `pnpm install` succeeds, `pnpm run build` fails on the TypeScript version pin; see §8.2 |
| docker-compose.yml | valid (`docker compose config` exits 0), Keycloak/Postgres/provision/backend services are consistent |
| Frontend Dockerfile | its `RUN pnpm run build` fails for the same TypeScript reason (§8.2 reproduced locally; the image build itself was not run) |
| Keycloak container | starts fine (26.0.8, realm imported) but reports **unhealthy forever** — the healthcheck script compares a CRLF line (§8.11), so `provision` never runs |
| `GET /api/user-info` | **broken out of the box** — the service account lacks Admin API permissions (§5, §8.11) and the token has no `sub` claim (§8.12) |
| `GET /api/users/:id`, `/api/health`, 401/403/404 paths | **verified working** once the service account is granted `realm-management` → `manage-users` |

---

## 2. Repository map

```
keyclock-demo/
├── docker-compose.yml           # full stack: db, keycloak, provision, backend, frontend
├── AGENTS.md                    # this file (handover)
├── avante.md                    # legacy AI-plugin prompt, superseded (§12)
├── av.lua                       # empty placeholder (Neovim Avante config slot)
├── av2.lua                      # Neovim Avante keymap config; dev-tooling only, not app code
├── infra/
│   ├── myapp-realm.json         # Keycloak realm "myapp" (228 lines) — imported on Keycloak start
│   └── keycloak-healthcheck.sh  # health probe for the Keycloak container (management port 9000)
├── backend/
│   ├── src/        server.ts config.ts routes.ts auth.ts jwt.ts keycloak-admin.ts errors.ts
│   ├── test/       auth.spec.ts jwt.spec.ts          (Jest)
│   ├── dist/       compiled output (gitignored; rebuilt 2026-11-26 — see §8.1)
│   ├── package.json  pnpm-lock.yaml  pnpm-workspace.yaml  jest.config.js  tsconfig.json  tsconfig.test.json  Dockerfile  .env.example  .gitignore
│   └── node_modules/  (pnpm, isolated layout with @types hoisted; gitignored)
└── frontend/
    ├── src/main.ts  src/index.html  src/styles.css
    ├── src/app/       app.component.ts app.config.ts app.routes.ts config.ts
    ├── src/app/auth/  keycloak-auth.service.ts auth-guard.ts
    ├── src/app/pages/login/     login.component.ts
    ├── src/app/pages/user-info/ user-info.component.ts user-info.service.ts user-info.service.spec.ts (Vitest)
    ├── angular.json  proxy.conf.json  nginx.conf  Dockerfile  tsconfig*.json  .gitignore  pnpm-workspace.yaml  pnpm-lock.yaml
    └── node_modules/  (pnpm 12.23.0, native builds approved; gitignored)
```

Naming conventions that must be preserved:
- `backend/src/*.ts` → `backend/dist/*.js` one-to-one (CommonJS output, `tsc` only).
- `*.spec.ts` is the test file suffix in both halves of the project.
- All realm/client identifiers are prefixed `myapp-` (`myapp-frontend`, `myapp-backend`, `myapp-cli`).
- All Angular components are standalone (no NgModule, no `AppModule`).
- Package manager is **pnpm 12.23.0**, pinned in the `packageManager` field of each `package.json` (corepack runs it). pnpm 12 reads its layout/build settings from each project's `pnpm-workspace.yaml`, not from `.npmrc`, so keep those files in sync with the toolchain.

---

## 3. Ports and endpoints (the fixed contract)

| Component | URL | Notes |
|---|---|---|
| Keycloak (public) | `http://localhost:8080` | realm: `http://localhost:8080/realms/myapp`; admin console: `/admin`; bootstrap admin `admin`/`admin` |
| Keycloak (management) | port `9000` | health endpoints; used by `infra/keycloak-healthcheck.sh` |
| PostgreSQL | `db:5432` inside the compose network | no published port; credentials `keycloak`/`keycloak`, database `keycloak` |
| Backend REST API | `http://localhost:3000/api` | CORS allows `http://localhost:4200` only |
| Angular SPA | `http://localhost:4200` | container serves port 80; nginx proxies `/api/` to `backend:3000` |

`8080`, `3000` and `4200` are referenced in the realm import, in the frontend config, in the backend config, in `proxy.conf.json` and in `nginx.conf`. Changing one without changing the others breaks the demo.

---

## 4. Request flow (trust boundaries)

```
Browser (Angular SPA, localhost:4200)
   │  OAuth2 authorization code + PKCE, public client "myapp-frontend"
   ▼
Keycloak login form  ──►  access token (RS256, lifespan 300s) kept by keycloak-js
   │  Authorization: Bearer <JWT>
   ▼
Angular UserInfoService ─► nginx (docker) / dev-server proxy (ng serve) ─► GET /api/...
   ▼
Backend (Express 5)
   ├─ auth.ts        reads the Bearer header
   ├─ jwt.ts         verifies signature against Keycloak's JWKS + issuer + audience "myapp-backend"
   ├─ auth.ts        requireRealmRole('user' | 'admin') reads the realmRoles claim
   └─ keycloak-admin.ts  uses its OWN service-account token (client_credentials) to call
        Keycloak Admin REST API (/admin/realms/myapp/users/{id}, /groups)
   ▼
JSON response  { …UserInfo }   (errors: { code, message } with 401/403/404/502/500)
```

Two tokens exist and they are not interchangeable:
1. the **user's** access token (audience `myapp-backend`) — proves who the caller is;
2. the **backend's service-account** token — proves the backend is allowed to read Keycloak's Admin API.

The backend never trusts claims from the SPA directly: it re-verifies the JWT cryptographically and fetches the profile from Keycloak (`keycloak-admin.ts:79`).

---

## 5. Keycloak realm model — the single most important part of the project

`infra/myapp-realm.json` is imported on every Keycloak start (`command: ["start", "--import-realm"]` in docker-compose.yml:24).

**Clients**
| clientId | type | purpose |
|---|---|---|
| `myapp-frontend` | public, standard flow, no direct grants | the Angular SPA |
| `myapp-backend` | confidential, `serviceAccountsEnabled: true`, secret `myapp-backend-service-account-secret` | the REST API + its service account |
| `myapp-cli` | confidential, `directAccessGrantsEnabled: true`, secret `myapp-cli-secret` | curl/password-grant testing only; **the SPA never uses it** |

**Realm roles:** `user`, `admin`.
**Users:** `alice` (Alice Anderson, roles `user` + `admin`, password `Alice123!`, attribute `department=Finance`) and `bob` (roles `user`, password `Bob12345!`, `department=Operations`).
**Groups:** `MyApp users` (id `users`, role `user`), `MyApp administrators` (id `admins`, roles `user`+`admin`), `backend-service-accounts` (no id, no members — inert).

**Client scope `myapp-backend-audience`** (lines 174–211) is the linchpin. It is listed in `defaultDefaultClientScopes` (line 220), so **every** access token issued in this realm carries:
- `aud: ["myapp-backend"]` — via the `oidc-audience-mapper` — required by `jwt.ts:61-64`, otherwise `verifyAccessToken` throws 403;
- `realmRoles: [...]` as a **flat** claim — via `oidc-usermodel-realm-role-mapper` with `claim.name: "realmRoles"` — required by `auth.ts:31`, otherwise every role check fails.

If you create a new realm, a new client, a new scope, or remove this scope from the defaults, the backend stops authenticating. Always re-import the realm after edits.

**The import drops every built-in client scope.** Verified in the Keycloak startup log: twelve warnings of the form `Referenced client scope 'profile' doesn't exist` (profile, email, roles, web-origins, acr, basic, offline_access, microprofile-jwt, phone, address, organization) — they are referenced in `defaultDefaultClientScopes`/`defaultOptionalClientScopes` (lines 213–228) but do not exist at import time, so they are discarded. After import the realm has exactly two scopes: `offline_access` and `myapp-backend-audience`.
Consequences of a live token (decoded payload of alice's access token): `scope: "myapp-backend-audience"`, and **no `sub`, no `preferred_username`, no `email`, no `name` claims**; `/realms/myapp/protocol/openid-connect/userinfo` returns an empty body. See §8.12 for the endpoints this breaks.

**The provisioning service in docker-compose.yml (lines 50–55)** is not optional — **and the role it assigns is the wrong one.** Verified on a live Keycloak 26.0.8:

Keycloak creates the service-account user (`service-account-myapp-backend`) when the client is imported, and realm-import JSON cannot express its role mappings, so a provisioning step is required. The compose line grants the **realm role `admin`**, which is declared in the realm JSON as a plain, non-composite role — it grants **nothing** to the Admin REST API. With only that role, `/admin/realms/myapp/users` and `/admin/realms/myapp/groups` return **HTTP 403** for the service-account token, and `/api/user-info` / `/api/users/:id` fail with `502 keycloak_upstream_error`. Alice's own token (holding realm `admin`) is also rejected by the Admin API — the realm's `admin` role is not Keycloak's built-in composite `admin` role.

**The verified working grant** is a `realm-management` client role:
```bash
kcadm.sh add-roles -r myapp --uusername service-account-myapp-backend --cclientid realm-management --rolename manage-users
```
After this, the Admin API returns 200 and `/api/users/:id` returns a real profile. Use `view-users` instead of `manage-users` for a read-only backend (safer, see §9). Replace the compose `provision` entry point accordingly. The grant persists across `docker compose restart keycloak` (the realm re-import does not remove role mappings that are not in the JSON) — verified.

**Keycloak 26 specifics that changed the code:**
- no `/realms/{realm}/token` shorthand → `keycloak-admin.ts:61` uses `/protocol/openid-connect/token`;
- no built-in master-realm `admin` user → bootstrap via `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD`;
- health endpoints live on the management port (9000) and the image has no `curl` → `infra/keycloak-healthcheck.sh` uses bash's `/dev/tcp`.

---

## 6. Backend module map

| File | Responsibility | Key symbols |
|---|---|---|
| `backend/src/config.ts` | env-driven config with docker-compose defaults | `config` (port, keycloakUrl, realm, backendClientId, backendClientSecret, allowedOrigins) |
| `backend/src/errors.ts` | canonical API error type + factories | `ApiError` (status, code, message); `unauthorized`/`forbidden`/`notFound`/`upstreamError` |
| `backend/src/jwt.ts` | OpenID discovery (cached), remote JWKS (cached per URI), JWT verification, role helpers | `loadOpenIdConfig`, `warmUpOpenIdConfig`, `getJwks`, `verifyClaims`, `verifyAccessToken`, `extractRealmRoles`, `hasRealmRole` |
| `backend/src/auth.ts` | Express middleware; attaches verified claims to `req.authClaims` (module augmentation) | `requireAuth`, `requireRealmRole(role)` |
| `backend/src/keycloak-admin.ts` | service-account token (cached), Admin REST API calls, response shaping | `getServiceAccountToken`, `fetchUserProfile`, `listGroups`, `isoTimestamp`, `buildUserInfo`, `toUserProfile` |
| `backend/src/routes.ts` | the three endpoints | `apiRouter` |
| `backend/src/server.ts` | logging, error handler, `createApp()` (exported for tests), `main()` | `createApp`, `errorHandler` |

Endpoint contract (all under `/api`):
- `GET /api/health` — unauthenticated. Returns `{ status:'UP', keycloak, realm }`. **It fetches the backend's service-account token first** (`routes.ts:15`), so it fails with 502 `keycloak_upstream_error` when Keycloak rejects the client-credentials request, and 500 when Keycloak is unreachable. Note that it returns UP even when the Admin API is unusable (§5) — token issuance and Admin API permission are separate things.
- `GET /api/user-info` — `requireAuth` + `requireRealmRole('user')`. Profile assembled from claims + Keycloak.
- `GET /api/users/:id` — `requireAuth` + `requireRealmRole('admin')`. Admin lookup of any realm user. Note that its `roles`, `attributes`, `createdAt` and `lastLogin` are structurally empty (§8.13).

Error contract (never change the shape): `{ "code": <string>, "message": <string> }` with
401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 502 `keycloak_upstream_error`, 500 `internal_error`, 404 `not_found` for unmatched routes (`server.ts:27`).

Express 5 (`express ^5.1.0`) is used deliberately: it catches rejected promises from async middleware, so async middleware that throws `ApiError` is handled by `errorHandler` without extra wrapping.

---

## 7. Frontend module map

Angular **22**, standalone components, signals, **zoneless change detection** (`app.config.ts:14`), functional guards via `canMatch`, `provideHttpClient(withFetch())` (fetch-based interceptor style), app bootstrap via `provideAppInitializer` so Keycloak is initialized before the first navigation.

| File | Responsibility |
|---|---|
| `frontend/src/app/config.ts` | hardcoded Keycloak URL/realm/clientId + `API_BASE_URL = '/api'` |
| `frontend/src/app/auth/keycloak-auth.service.ts` | `Keycloak` instance, signals `authenticated`/`accessToken`, computed `claims`, `init()`, `login()`, `logout()`, `ensureValidToken()` (refreshes when the token expires within 30s), `decodeJwt()` |
| `frontend/src/app/auth/auth-guard.ts` | `authenticatedGuard` (→ `/login` when anonymous), `anonymousGuard` (→ `/user-info` when logged in) |
| `frontend/src/app/app.routes.ts` | `login`, `user-info` (lazy `loadComponent`), `''` → `user-info`, `**` → `user-info` |
| `frontend/src/app/app.component.ts` | header with the logged-in username + sign-out button |
| `frontend/src/app/pages/login/login.component.ts` | reactive form (email + password ≥8 chars) whose **only** effect is `auth.login()` (see §8.3) |
| `frontend/src/app/pages/user-info/user-info.component.ts` | loading/error/ready states, profile card, roles/groups badges, identity-provider card |
| `frontend/src/app/pages/user-info/user-info.service.ts` | `getUserInfo()`, `getUserById()`; attaches `Authorization: Bearer` |
| `frontend/src/app/pages/user-info/user-info.service.spec.ts` | Vitest test with a fake Keycloak service and an HTTP interceptor stub |

Response shape `UserInfo` is duplicated in two places and must stay in sync:
`frontend/src/app/pages/user-info/user-info.service.ts:8-26` and `backend/src/keycloak-admin.ts:31-49`.

---

## 8. Known blockers, bugs and gotchas
Items 8.1, 8.2, 8.11, 8.12, 8.13 and 8.14 were reproduced by running the build, the toolchain (npm and pnpm) and a live Keycloak 26.0.8. Items 8.3–8.10 are findings from reading the code and the realm/config files; 8.6 is documented Keycloak behavior that this realm's JSON does not implement.

### 8.1 `backend/dist/` drifts from `src` — it was broken against Keycloak 26
`dist/keycloak-admin.js` was built at 10:28 while `src/keycloak-admin.ts` was last edited at 14:14. The compiled file still called the removed Keycloak shorthand `/realms/myapp/token`; the source uses `/realms/myapp/protocol/openid-connect/token`.
**Symptom:** `pnpm start` (`node dist/server.js`) fails with `502 keycloak_upstream_error`, and `/api/health` is useless.
**I rebuilt `dist/` during this handover, so it currently matches `src` (verified byte-identical to a fresh `tsc` run).** The drift will reappear as soon as anyone edits `src` without rebuilding.
**Rule:** `pnpm run build` before every `pnpm start`. `dist/` is gitignored; treat it as disposable, never as source. If you add a `prestart` script, this class of bug disappears.

### 8.2 The frontend toolchain is pinned to versions that cannot build
`frontend/package.json` declares `typescript: ~5.9.2` and `vitest: ^0.1.6`.
- Angular 22 (`@angular/build` / `@angular/compiler-cli`) peer-requires **TypeScript `>=6.0 <6.1`** — `pnpm run build` fails with: `The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but 5.9.3 was found instead.`
- `@angular/build:unit-test` peer-requires **vitest `^4.0.8 || ^5.0.0`**. `vitest@0.1.6` does not exist in the npm registry (pnpm resolves it to `0.1.27`).
- The npm lockfile is gone after the pnpm migration (2026-11-26): `frontend/pnpm-lock.yaml` is committed and `pnpm install` completes cleanly — the peer conflicts are warnings, not `ERESOLVE` aborts.

**Fix:** set `"typescript": "~6.0.3"` and `"vitest": "^4.0.8"` in `frontend/package.json`, then `pnpm install` and commit the refreshed lockfile.
This also unblocks `frontend/Dockerfile`, whose `RUN pnpm run build` currently fails → the `frontend` image in docker-compose cannot be built.

### 8.3 The login form collects credentials that are never used
`login.component.ts:41-46` builds a reactive form with email + password validators, and `submitLogin()` (line 48-56) discards the values and calls `auth.login()`, which sends the browser to Keycloak's own login page. Users type a password into a form that does nothing, then have to type it again on Keycloak's page.
**Recommendation:** keep the Keycloak redirect, drop the local inputs (a single "Sign in" button), or forward the typed username to `keycloak.login({ username: ... })` as a pre-filled hint. Do not implement a password grant here — that is `myapp-cli`'s purpose and it is a deliberate anti-pattern.

### 8.4 `GET /api/users/:id` returns a different shape than its TypeScript type claims
The backend returns `toUserProfile()` (`keycloak-admin.ts:138-152`): `id`, `username`, `fullName`, `firstName`, `lastName`, `email`, `emailVerified`, `enabled`, `roles`, `attributes`, `createdAt`, `lastLogin`.
The frontend types the call as `Promise<UserInfo>` (`user-info.service.ts:48`), which promises `sub`, `groups`, `authTime`, `locale`, `audience`, `keycloakUrl`, `accountUrl` — fields the backend never sends.
Nothing in the UI consumes `getUserById` yet; if you build the admin UI, introduce a separate `UserProfile` interface on the frontend.

### 8.5 The `groups` and `locale` fields are usually empty
`routes.ts:23` filters Keycloak groups against `claims.groups`, and `buildUserInfo` reads `claims.locale`. Keycloak emits `groups` only under the **`microprofile-jwt`** optional scope and `locale` only under **`organization`** — both are listed in `defaultOptionalClientScopes` (lines 222–228) in the JSON, and per §5 **neither scope exists in the imported realm**, so these fields can never be populated today.
**Symptom:** the user-info page shows roles but an empty Groups list; "Locale" shows `—`. The Vitest fixture (`user-info.service.spec.ts:17-18,23`) pretends they are populated.
**Fix:** request the optional scopes explicitly in `keycloak.login({ scope: 'microprofile-jwt organization' })`, or drop the claims from the UI.

### 8.6 The `defaultGroup` group attribute does nothing
The realm JSON marks group "MyApp users" with attribute `defaultGroup: ["true"]` (lines 85-89). Keycloak's default-group mechanism is a **realm-level** attribute `defaultGroup` pointing at a group id, not an attribute on a group. New users created through the admin console are therefore not added to any group.
**Fix:** add `"attributes": { "defaultGroup": ["users"] }` to the realm object in `infra/myapp-realm.json`.

### 8.7 Misleading comment in `jwt.ts`
Lines 59–60 say Keycloak writes `aud: ["myapp-backend"]` "when the user holds the `myapp-backend-audience` realm role". There is no such realm role (`myapp-realm.json:9-18` defines only `user` and `admin`); the audience comes from the **client scope's protocol mapper**. The Vitest fixture (`user-info.service.spec.ts:17`) repeats the same mistake by listing `myapp-backend-audience` as a role. Correct the comment before someone builds role logic on it.

### 8.8 Dead code to be aware of
- `backend/src/config.ts:22-24` — the `if (!config.backendClientSecret)` guard never fires because the default value is non-empty. It only fires if someone sets `KC_BACKEND_CLIENT_SECRET=` to an empty string.
- `backend/src/jwt.ts:85-93` — `extractRealmRoles`/`hasRealmRole` are used **only** by `test/jwt.spec.ts`; `auth.ts:31` reads `claims.realmRoles` inline. If you extend role checks, use the helpers and make `auth.ts` consistent.
- Realm JSON client roles (`myapp-backend` → `admin`, lines 20-26) and group `backend-service-accounts` (lines 104-109) are declared but unused by any code path.
- `backend/Dockerfile` runs `pnpm install --frozen-lockfile` (dev deps included) in the build stage, then `pnpm install --frozen-lockfile --prod` in the runtime stage — intentional, two installs; each stage starts with `corepack enable` so the `packageManager` pin picks pnpm 12.23.0. Verified: the image builds and the container serves `/api/health`.

### 8.9 Unicode bug in the JWT decoder
`keycloak-auth.service.ts:73-76` decodes the payload with `atob`, which fails for non-Latin1 bytes (Cyrillic, accented names). Real users in a government deployment will hit this.
**Fix:** decode with base64url → bytes → `new TextDecoder('utf-8').decode(...)`. Better: read claims from Keycloak's `/realms/myapp/protocol/openid-connect/userinfo` endpoint instead of decoding the JWT locally.

### 8.10 docker-compose gaps
- `backend` has **no healthcheck**, even though `/api/health` exists and its comment claims it is "used by docker healthchecks" (`routes.ts:13`). `frontend`'s `depends_on: backend` is unconditional.
- `provision` has no restart/health policy: if Keycloak is unhealthy the provisioning step is skipped, and the 502 symptom of §5 reappears.
- Postgres has no published port; you cannot inspect it from the host without `docker compose exec db psql`.

### 8.11 The Keycloak healthcheck never passes (verified, and it blocks the whole stack)
`infra/keycloak-healthcheck.sh` line 5 sends a CRLF HTTP request; line 6 reads the status line with `read -t 10 status`, which **keeps the trailing `\r`** (verified with `od`: `H T T P / 1 . 1   2 0 0   O K \r`), so line 7's `[ "$status" = "HTTP/1.1 200 OK" ]` is false. Keycloak is genuinely UP — `curl` on port 9000 inside the container returns `HTTP/1.1 200 OK` with `{"status":"UP"}` — yet the probe reports exit 1 every time and the container stays `unhealthy`.
**Chain reaction:** `provision` has `depends_on: keycloak: condition: service_healthy` → it never runs → the service account is never granted anything → every Admin API call is 403 → `/api/user-info` and `/api/users/:id` return 502.
**Verified fix (tested in the container, exit 0):**
```bash
#!/bin/bash
exec 3<>/dev/tcp/localhost/9000 || exit 1
printf 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
read -t 10 status <&3
status=${status%$'\r'}          # strip the carriage return from the HTTP status line
[ "$status" = "HTTP/1.1 200 OK" ]
```

### 8.12 Access tokens in this realm have no `sub` claim (verified, breaks `/api/user-info`)
`routes.ts:22` does `fetchUserProfile(claims.sub as string)`. A live access token for alice (password grant via `myapp-cli`) decodes to:
```json
{"exp":…,"iat":…,"jti":…,"iss":"http://localhost:8080/realms/myapp","aud":"myapp-backend","typ":"Bearer","azp":"myapp-cli","sid":"…","scope":"myapp-backend-audience","realmRoles":["admin","user"]}
```
There is **no `sub`**, no `preferred_username`, no `email`, no `name` — the built-in scopes were dropped at import (§5). The endpoint therefore returns:
```json
{"code":"not_found","message":"User \"undefined\" not found in realm \"myapp\""}
```
The SPA is hit twice by the same defect: `app.component.ts:12` renders `auth.claims()?.['preferred_username']`, which is `undefined` → the header shows a blank username.
**Two ways to fix:**
1. Restore the missing scopes so tokens carry `sub`/`preferred_username`/`email` (declare `profile`, `email`, `basic`, `acr`, `web-origins`, `roles` in `clientScopes` with their protocol mappers, or create them post-import with `kcadm.sh create /client-scopes -r myapp`).
2. Stop deriving the subject from the JWT: verify the token, then resolve the subject from the session (`sid`) / Keycloak's `userinfo`, or pass the user id explicitly. `keycloak-admin.ts` already fetches the authoritative profile; only the id lookup depends on `sub`.

### 8.13 `GET /api/users/:id` can never report roles, attributes, createdAt or lastLogin (verified)
`toUserProfile` (`keycloak-admin.ts:142-151`) reads `user.clientRoleMappings`, `user.attributes`, `user.createdTimestamp`, `user.lastAccess`. Keycloak 26's **single-user representation** (`GET /admin/realms/myapp/users/{id}`) does not contain any of those fields — verified with `jq keys` on a live response: the payload has only `access`, `disableableCredentialTypes`, `email`, `emailVerified`, `enabled`, `firstName`, `id`, `lastName`, `notBefore`, `requiredActions`, `totp`, `username`.
**Symptom:** every `/api/users/:id` response shows `"roles":[]`, `"attributes":{}`, `"createdAt":null`, `"lastLogin":null` — even for alice, who holds `user` and `admin`. The `clientRoleMappings` fallback silently yields `[]` and realm roles are never read at all.
**Fix:** fetch the extras from their dedicated endpoints: `/users/{id}/realm-role-mappings`, `/users/{id}/client-role-mappings`, `/users/{id}/groups`, `/users/{id}/attributes`. (`listGroups()` at `/admin/realms/myapp/groups` works and is what `/api/user-info` uses, so group data is available for the owner — just not for arbitrary users.)

### 8.14 pnpm's isolated layout hides `express-serve-static-core` from the type augmentation (verified, fixed in place)
`auth.ts:5` declares `declare module 'express-serve-static-core'` to attach `authClaims` to Express's `Request`. npm's flat `node_modules` made that module resolvable from the project root, so it worked. pnpm's default `isolated` linker keeps `@types/express-serve-static-core` inside `node_modules/.pnpm`, so `tsc` silently drops the augmentation and every `req.authClaims` access fails with **TS2339** — `pnpm run build` fails and `auth.spec.ts` fails with 5 of 8 tests.
**Fix in place:** `backend/pnpm-workspace.yaml` sets `publicHoistPattern: ["*types*"]`, hoisting all `@types/*` packages into the root `node_modules`. Verified: `pnpm run build` compiles clean and all 8 Jest tests pass, with the source code unchanged.
Do not "fix" this by rewriting the augmentation to target `'express'` — the Router handler types come from `express-serve-static-core`, so that only patches `auth.ts` and leaves `routes.ts` broken.

---

## 9. Security notes (read before deploying anything real)

Everything here is demo-grade and deliberately readable:
- Realm import contains **plaintext user passwords** (`Alice123!`, `Bob12345!`), client secrets (`myapp-backend-service-account-secret`, `myapp-cli-secret`), the Keycloak bootstrap admin (`admin`/`admin`) and the Postgres password (`keycloak`). These live in `infra/myapp-realm.json` and `docker-compose.yml` and are checked into any future repo.
- `KC_HTTP_ENABLED: "true"` — Keycloak runs plain HTTP, no TLS, no `KC_HOSTNAME` TLS setup.
- `accessTokenLifespan: 300` (5 min) is reasonable; `ssoSessionMaxLifespan: 36000` (10 h).
- CORS is restricted to a single origin (`http://localhost:4200`); add origins via `ALLOWED_ORIGINS` (comma-separated), never wildcard.
- Privilege model: docker-compose grants the backend's service account the **realm `admin` role**, which (as verified in §5) is a plain non-composite role that grants nothing. The working grant is `realm-management` → `manage-users`, which is **write access** to every user in the realm. The backend code only reads, so prefer `view-users` (read-only) for a read-only API and never grant `realm-management` roles to end users. Alice's realm `admin` role is what `requireRealmRole('admin')` checks in the JWT; it is a *label* for the API, not a Keycloak privilege, and it does not let alice touch the Admin API.
- ROPC (`myapp-cli`, password grant) exists only for curl demos. Do not let it become a login path: it bypasses PKCE and exposes passwords to the client secret.
- Production checklist: TLS + published `KC_HOSTNAME`, secrets from an environment/vault (not the realm JSON), no realm-imported credentials, rotate client secrets, delete `myapp-cli`, audit who holds `admin`.

---

## 10. Coding conventions actually used (follow them)

- **TypeScript strict everywhere.** Backend: `strict`, `noUnusedLocals`, `noUnusedParameters` (`tsconfig.json`). Frontend: `strict`, `strictTemplates`, `noPropertyAccessFromIndexSignature`, `isolatedModules` (`tsconfig.json` + `angularCompilerOptions`).
- **All runtime values in the backend come from env** with defaults that match docker-compose (`config.ts`). Do not hardcode URLs in backend code; frontend config is hardcoded by design (it is a browser constant).
- **Every function and interface has a doc comment** — JSDoc-style, one or two lines, stating *why* the code exists (the comments in `avante.md` asking for JSDoc on complex functions is honored throughout).
- **Errors are always thrown as `ApiError` factories** (`errors.ts`), never as bare `Error`. The response body shape `{ code, message }` is fixed.
- **Naming:** middleware `requireX`, verification `verifyX`, fetch `fetchX`, list `listX`, shaping `buildX`/`toX`.
- **Angular:** standalone components, inline templates, signals (`signal`, `computed`), `inject()` instead of constructor DI, functional guards (`canMatch`), lazy `loadComponent` for the user-info page, zoneless change detection. Templates use the new `@if/@else/@for` syntax. No `NgModule`, no lifecycle hooks.
- **CSS:** plain global stylesheet in `src/styles.css`, semantic class names (`.login-card`, `.profile-card`, `.badge role/group/verified/unverified`). Accessibility: `role="alert"` on error blocks, labelled inputs.
- **Tests:** backend `test/*.spec.ts` runs Jest with `tsconfig.test.json` (loosened `noUnused*`); frontend `src/app/**/*.spec.ts` runs via `ng test` with Vitest. Tests use fakes (fake Express response in `auth.spec.ts`, local RSA key pair in `jwt.spec.ts`, stubbed Keycloak service in `user-info.service.spec.ts`) — no live Keycloak in tests, deliberately.

---

## 11. Commands

**Backend** (in `backend/`):
```bash
pnpm install         # corepack runs the pinned pnpm 12.23.0; layout settings come from pnpm-workspace.yaml
pnpm run build       # tsc -p tsconfig.json → dist/  (always run before pnpm start)
pnpm run dev        # tsx watch src/server.ts (no dist needed)
pnpm test           # jest (8 tests, ~1s, passes)
pnpm start          # node dist/server.js  ← requires a fresh build (§8.1)
```

**Frontend** (in `frontend/`):
```bash
pnpm install         # succeeds; Angular/vitest peer conflicts are warnings, not ERESOLVE (§8.2)
pnpm start          # ng serve, proxies /api → http://localhost:3000 via proxy.conf.json
pnpm run build       # currently fails (§8.2)
pnpm run watch       # incremental dev build
pnpm test           # ng test → vitest (currently fails, vitest version pinned too low)
```

**Full stack** (in the project root):
```bash
docker compose config          # validates the file (currently OK)
docker compose up -d           # db → keycloak → provision → backend → frontend
docker compose logs -f keycloak provision
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin
```
Keycloak starts in about 12s. Only `backend` and `frontend` are built locally; `db`, `keycloak` and `provision` come straight from registry images. **I ran `docker compose up -d db keycloak provision` during this handover**: Postgres came up healthy, Keycloak imported the realm successfully (with the 12 scope warnings of §5) and served the OIDC discovery document, but the container stayed **unhealthy** because of the healthcheck bug (§8.11) — so `provision` never ran. The `frontend` image build fails (§8.2). Take the stack down with `docker compose down` (the `keycloak-db` volume keeps the imported realm; `docker compose down -v` resets it).

**Smoke test with curl (uses `myapp-cli`, password grant) — verified outputs:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/myapp/protocol/openid-connect/token \
  -d grant_type=password -d client_id=myapp-cli -d client_secret=myapp-cli-secret \
  -d username=alice -d password='Alice123!' | jq -r .access_token)
curl -s http://localhost:3000/api/health                          # {"status":"UP","keycloak":"http://localhost:8080","realm":"myapp"}
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/user-info   # 404 {"code":"not_found","message":"User \"undefined\" not found…"} ← §8.12
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/bob   # 502 before §5's fix; after granting realm-management/manage-users it returns 200 with a profile whose roles/attributes/createdAt/lastLogin are empty (§8.13)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/nope         # 404 not_found
curl -s http://localhost:3000/api/user-info                       # 401 {"code":"unauthorized","message":"Missing Authorization: Bearer <JWT>"}
# bob's token against /api/users/:id → 403 {"code":"forbidden","message":"Realm role \"admin\" is required"}
```
Decoding the token to confirm the claims (§5):
```bash
node -e "const p=process.argv[1].split('.')[1];console.log(JSON.parse(Buffer.from(p,'base64url').toString('utf8')))" "$TOKEN"
```
`aud` is `"myapp-backend"` and `realmRoles` is `["admin","user"]` — both required by the backend. `sub` is missing (§8.12).

---

## 12. Legacy artifacts and superseded instructions

`avante.md` (30 lines) is a project-instruction prompt written for the **Avante.nvim** AI assistant plugin, with `av2.lua` as its companion Neovim keymap config (Alt+p/Alt+n for history navigation in the `AvanteInput` filetype) and `av.lua` as an empty placeholder. They are developer-tooling files, not application code. **Keep them** — deleting them breaks the author's editor setup.

`avante.md` was written before this project existed and no longer describes it. Its claims conflict with the verified reality, and per the handover rules the conflicting parts are replaced here:

| `avante.md` claim | Reality (this document) |
|---|---|
| "scalable e-commerce platform targeting big government businesses" | Keycloak auth demo with two pages and three REST endpoints (§1) |
| "backend: nodejs, postgres" | backend is Node/Express 5; PostgreSQL is **Keycloak's** datastore only, the application has no database (§4) |
| "java, JavaEE" expertise | no Java code, no JavaEE stack anywhere in the repo |
| "testing: jest" | Jest for the backend **and** Vitest for the frontend (§10) |
| "angular … hooks patterns" | Angular 22 with signals, zoneless change detection, standalone components, functional guards — no lifecycle hooks (§10) |
| "following angular best practices" | honored, but the frontend's dependency pins are incompatible with Angular 22 (§8.2) |
| "deployment: docker" | correct and implemented: `docker-compose.yml` + two Dockerfiles (§3) |
| "self-documenting code, clear names, JSDoc" | correct, continue (§10) |
| "follow the existing folder structure" | correct, see §2 |

AGENTS.md takes precedence over `avante.md`. If an AI agent is configured to read `avante.md`, point it at AGENTS.md instead (the project prompt file Avante reads is the one to update when the project changes).

---

## 13. What I expected to do and did not (open work)

In rough priority order — 1 to 4 are the blockers that keep the demo from working at all:

1. **Fix `infra/keycloak-healthcheck.sh`** (§8.11, one line: strip the `\r`). Without it Keycloak is permanently unhealthy and `provision` never runs.
2. **Fix the `provision` grant** (§5) to `--cclientid realm-management --rolename manage-users` (or `view-users` for read-only). Verified: this is what makes the Admin API, and therefore `/api/users/:id` and `/api/user-info`, work.
3. **Restore the built-in client scopes** (§5, §8.12) so tokens carry `sub`, `preferred_username` and `email`. Without it `GET /api/user-info` returns 404 and the SPA header is blank.
4. **Fix the frontend dependency pins** (§8.2) — `pnpm install` already works and `pnpm-lock.yaml` is committed; changing the pins and reinstalling unblocks `pnpm run build`, `pnpm test` and the frontend Docker image.
5. **Add a `prestart` script** (`"prestart": "pnpm run build"`) so `pnpm start` can never run a stale `dist/` (§8.1 — the rebuild itself is done).
6. **Initialize git** — **done** during this handover (`git init -b main`, 48 files committed, tag `backend-working`). A changelog is still missing; `result.md` is the closest thing to one.
7. **Fix the login UX** (§8.3) — remove the dead password field.
8. **Fix `toUserProfile`** (§8.13) so `roles`, `attributes`, `createdAt` and `lastLogin` come from the dedicated Admin API endpoints (`realm-role-mappings`, `client-role-mappings`, `groups`, `attributes`) instead of fields the single-user representation doesn't have.
9. **Add an admin page** using `GET /api/users/:id`, with a frontend type that matches `toUserProfile` (§8.4) after item 8 is fixed.
10. **Decide on `groups`/`locale`** (§8.5) — request the optional scopes (which requires fix #3 first) or drop the fields.
11. **Add a backend healthcheck** to docker-compose (§8.10). Note that `/api/health` reports UP even when the Admin API is unusable (§5) — make the probe check the Admin API, not just token issuance.
12. **Add integration tests**: the current Jest suite covers JWT verification and role middleware only. Nothing tests `routes.ts`, `keycloak-admin.ts` (Admin API calls), the error handler, or CORS. A `supertest` suite against `createApp()` with a stubbed Keycloak is the natural next step.
13. **Production hardening** (§9) — TLS, secrets out of the realm JSON, scoped admin privileges, remove `myapp-cli`.
14. **Replace `atob` JWT decoding** (§8.9).
15. **Real application data**: if MyApp is to become the e-commerce platform described in `avante.md`, this stack provides identity only. A Postgres schema, an ORM, and a second database service in docker-compose are entirely missing.

---

## 14. Verification checklist after any change

Status legend: **green** = I ran it and it passed; **BLOCKED** = I ran it and it fails today. Most of these were executed during this handover against a live stack; `jq`, `curl` and `psql` are installed on this machine, so the smoke test runs from the host.

```bash
cd backend && pnpm install && pnpm run build && pnpm test   # green (8 tests pass)
cd backend && pnpm exec tsc -p tsconfig.json --noEmit       # green
cd backend && pnpm run build && pnpm exec tsc -p tsconfig.json --outDir /tmp/opencode-check && diff dist/keycloak-admin.js /tmp/opencode-check/keycloak-admin.js   # §8.1 staleness check, must be identical
cd frontend && pnpm install                                 # green (peer conflicts are warnings)
cd frontend && pnpm run build                               # BLOCKED (§8.2)
cd backend && docker build -t myapp-backend-pnpm .          # green (corepack + pnpm 12.23.0; container serves /api/health against a live Keycloak)
docker compose config                                   # green
docker compose up -d db keycloak                        # keycloak starts and imports the realm; container reports unhealthy (§8.11)
docker compose exec keycloak bash /opt/keycloak/healthcheck.sh   # exit 1 today (§8.11)
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin   # green
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh get-roles -r myapp --uusername service-account-myapp-backend --cclientid realm-management   # green, shows `manage-users` after §5's grant; empty on a fresh import
node -e "...decode the JWT payload…"                    # claims of a live token (§11)
curl /api/health, /api/user-info as alice, /api/users/bob as alice, /api/nope, /api/user-info without a token   # verified outputs in §11
```
After editing `infra/myapp-realm.json`: restart Keycloak (`docker compose restart keycloak`) so `--import-realm` re-applies, then re-run the curl smoke test, then re-check the `realmRoles` and `aud` claims. If you change docker-compose, run `docker compose config` before `up`.
