## 11. Commands

### Start MyApp with Docker Compose

From the project root, run `docker compose up -d --build`. The `provision`
service adds the required token claims and grants the backend read access in
both new and existing `myapp` realms. It uses the existing PostgreSQL volume.

- [MyApp](http://localhost:4200/login) → **Sign in with Keycloak** → use the demo
  account `alice` / `Alice123!` or `bob` / `Bob12345!`.
- [Keycloak Admin Console](http://localhost:8080/admin/master/console/) uses the
  `master` realm and the bootstrap account `admin` / `admin` on a fresh setup.
- [Backend health](http://localhost:3000/api/health) checks service-account token
  issuance. Open the profile in MyApp to verify the full sign-in flow.

**Backend** (in `backend/`):
```bash
pnpm install         # corepack runs the pinned pnpm 12.23.0; layout settings come from pnpm-workspace.yaml
pnpm run build       # tsc -p tsconfig.json → dist/  (always run before pnpm start)
pnpm run dev        # tsx watch src/server.ts (no dist needed)
pnpm test           # jest (8 tests, ~1s, passes)
pnpm run lint       # eslint src test → green (0 problems)
pnpm run lint:fix   # eslint src test --fix
pnpm start          # node dist/server.js  ← requires a fresh build (§8.1)
pnpm run format      # prettier --write: src/**/*.ts, test/**/*.ts, eslint.config.ts, jest.config.js, package.json, tsconfig.json, tsconfig.test.json
pnpm run format:check # prettier --check, exits 0 when every file is already formatted
```

**Frontend** (in `frontend/`):
```bash
pnpm install         # green; pins fixed (§8.2) — Angular 22.3.0, TypeScript 6.0.3, vitest 5.1.2, prettier 3.10.1
pnpm start          # ng serve, proxies /api → http://localhost:3000 via proxy.conf.json
pnpm run build       # output dist/myapp-frontend
pnpm run watch       # incremental dev build
pnpm test           # ng test → Vitest
pnpm run lint       # ng lint (angular-eslint on src/**/*.ts and src/app/**/*.html, prettier/prettier) → green
pnpm run lint:fix   # ng lint --fix
pnpm run format      # prettier --write: src/**/*.{ts,html,css} + angular.json, eslint.config.ts, package.json, proxy.conf.json, tsconfig*.json
pnpm run format:check # prettier --check, exits 0 when every file is already formatted
```

**Compose diagnostics** (in the project root):
```bash
docker compose config --quiet
docker compose ps -a
docker compose logs -f keycloak provision
```

