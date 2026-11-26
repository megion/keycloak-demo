Done. `AGENTS.md` is at the repo root: `/home/ilya/workspaces/java/keyclock-demo/AGENTS.md` (425 lines, 14 sections).

**What's in it**

- §1–§7: what the project really is (Keycloak 26 auth demo, not an e-commerce platform), repo map, the fixed port contract (`8080/9000/3000/4200`), the request flow with its two non-interchangeable tokens, the realm model, and module maps for backend and frontend.
- §8 — 13 blockers/gotchas, each with symptom and fix:
  1. `dist/` drifts from `src` (I rebuilt it; it's currently fresh)
  2. frontend version pins (`typescript ~5.9.2`, `vitest ^0.1.6`) can't build Angular 22
  3. login form collects a password that is never used
  4. `/api/users/:id` returns a shape its frontend type doesn't match
  5. `groups`/`locale` can never be populated
  6. realm JSON's `defaultGroup` group attribute does nothing
  7. misleading `jwt.ts` comment about the audience claim
  8. dead code (config guard, JWT role helpers, unused client roles/groups)
  9. `atob` JWT decoding breaks on non-Latin1 names
  10. compose gaps (no backend healthcheck)
  11. **`infra/keycloak-healthcheck.sh` never passes** — `read` keeps the trailing `\r`, so Keycloak is permanently "unhealthy", `provision` never runs, and the whole chain breaks. Verified fix included.
  12. **tokens in this realm have no `sub` claim** (import drops all built-in scopes) → `/api/user-info` returns `not_found` for `"undefined"` and the SPA header shows a blank username.
  13. **`/api/users/:id` can never report roles/attributes/createdAt/lastLogin** — Keycloak 26's single-user representation doesn't contain those fields (verified with `jq keys`).
- §9 security notes, §10 conventions actually in use, §11 commands with verified curl smoke-test outputs, §12 how `AGENTS.md` supersedes `avante.md` (kept, along with `av.lua`/`av2.lua`), §13 prioritized open work, §14 a verification checklist tagged **green** / **BLOCKED**.

**What I verified by running, not reading**

- Backend: `tsc` clean, 8 Jest tests pass, `dist/` byte-identical to a fresh compile.
- Frontend: plain install → ERESOLVE; `--legacy-peer-deps` works; `ng build` fails (`Angular Compiler requires TypeScript >=6.0.0 and <6.1.0, found 5.9.3`).
- Live stack: Postgres healthy, Keycloak 26.0.8 imported the realm (12 "client scope doesn't exist" warnings), container unhealthy due to §8.11; service account with the compose-shipped realm `admin` role → Admin API 403; granting `realm-management`/`manage-users` → 200. Endpoint outputs confirmed: `/api/health` UP, `/api/user-info` → 404 `User "undefined"`, `/api/users/bob` → 200 with empty `roles`/`attributes`, `/api/nope` → 404, no token → 401, bob's token on `/api/users/:id` → 403.

Environment left clean: backend process stopped, `docker compose down` (the `keycloak-db` volume is retained, so the imported realm survives).

Want me to apply the fixes? The four that unblock the demo are: strip the `\r` in `infra/keycloak-healthcheck.sh`, change the compose `provision` grant to `realm-management/view-users`, restore the built-in client scopes in `infra/myapp-realm.json`, and bump `frontend/package.json` to `typescript ~6.0.3` / `vitest ^4.0.8` plus a `prestart` script in `backend/package.json`.

