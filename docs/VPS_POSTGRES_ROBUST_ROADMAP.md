# VPS PostgreSQL Robust Roadmap

Updated: 2026-02-15

## Current status (measured)
- `136` files still import `@/lib/db/connection` (SQLite-centric API).
- `102` files still import `@/lib/auth/sqlite-auth`.
- `42` files still contain SQLite-specific symbols.
- Current health endpoints are now adapter-based and PostgreSQL-aware.
- Production compose is validated with PostgreSQL + Redis + Nginx.

Source: `reports/postgres-readiness-20260215_092723.md`

## What is already hardened
- Production `docker-compose.yml` now:
  - initializes PostgreSQL with `schema.postgres.sql` + `seed.postgres.sql`.
  - uses internal `expose` for Postgres/Redis/App (Nginx front door on port 80).
  - fixes Redis health check with auth.
  - sets `DB_TYPE=postgresql` and PostgreSQL-safe `DATABASE_URL`.
- Health API updated to shared dependency checks:
  - database and redis checks centralized in `lib/health/dependency-checks.ts`.
  - startup/ready/health endpoints no longer hardcoded to SQLite internals.
- Nginx config added for reverse proxy and `/health` endpoint.
- Docker scripts hardened:
  - `deploy.sh`: supports `docker compose`, real backup archive, robust container health wait.
  - `health-check.sh`: supports `docker compose`, configurable `HEALTHCHECK_URL`, authenticated Redis checks.
  - `validate.sh`: validates compose syntax with required env placeholders.

## Remaining critical gap
Large portions of API/business logic still depend on synchronous SQLite patterns (`db.prepare(...).all/get/run`) and legacy auth module coupling. Full production-grade PostgreSQL readiness requires migrating these paths to async adapter/repository interfaces.

## Migration waves

### Wave 1 (critical runtime path)
- Migrate auth-dependent API routes with highest traffic to adapter/repositories.
- Remove direct `db.prepare` usage from authentication, ticket listing, ticket details, and dashboard summary endpoints.
- Keep SQL compatibility centralized via `lib/db/adapter.ts` and typed repository methods.

Acceptance:
- No import of `@/lib/db/connection` in critical auth/ticket routes.
- Login + token verification + ticket CRUD pass on PostgreSQL.

### Wave 2 (domain modules)
- Migrate modules: analytics, knowledge, CMDB, workflows, notifications.
- Replace `sqlite-auth` usages with an auth service backed by adapter.
- Add query integration tests running against PostgreSQL container.

Acceptance:
- Zero SQLite-only code in `app/api/**` runtime routes.
- Integration suite green using PostgreSQL.

### Wave 3 (cleanup and hardening)
- Restrict SQLite usage to isolated test helpers only.
- Introduce DB migration/version tooling for PostgreSQL-only schema evolution.
- Finalize backup/restore drill with PostgreSQL routines only.

Acceptance:
- Production path has no SQLite dependencies.
- Disaster-recovery runbook validated in VPS staging.

## VPS go-live checklist
1. Populate `.env` secrets (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`).
2. Build and deploy:
   - `./scripts/docker/build.sh`
   - `./scripts/docker/deploy.sh`
3. Validate:
   - `./scripts/docker/health-check.sh`
   - `curl -f http://<vps-ip-or-domain>/health`
4. Run readiness audit after each migration wave:
   - `./scripts/architecture/audit-postgres-readiness.sh`

