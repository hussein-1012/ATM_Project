# Aqrab Makina Leek — Backend API

Nearest ATM for You (Fayoum, Egypt). Built with NestJS, TypeScript strict, PostgreSQL 16 + PostGIS, Redis.

## Quick links

- Swagger UI: `/docs` (when running locally)
- Health: `/v1/health`

## Requirements

- Node.js LTS (>= 20), pnpm
- PostgreSQL 16 + PostGIS extension
- Redis (for OTP, throttles, route cache)
- Docker + docker-compose (optional — Docker not available on current host)

## Setup

```bash
# Install deps
pnpm i

# Copy example env and adjust for your local Postgres/Redis
cp .env.example .env

# Run typecheck, build, lint, tests
pnpm exec tsc --noEmit -p tsconfig.json
pnpm build
pnpm lint
pnpm test
```

## Database (local)

Run migrations first; the importer can then upsert ATMs from `data/atms.json`.

```bash
pnpm migration:run
pnpm import:atms [--file data/atms.json] [--dry-run]
# or
pnpm import:atms --dry-run
```

## Environment

See `.env.example` for all vars. Notable routing: `ROUTING_PROVIDER=osrm|ors|fallback` (fallback is straight-line, always works). OTP/auth/throttle/report limits are configurable.

## Data source

`data/atms.json` is the single source of truth (moved unchanged from the crawler export). The importer filters by ATM/bank category, enforces Egypt bounds, maps bank names, parses opening hours (24h/overnight), upserts on `(source,sourceId)` and is idempotent. See `docs/data-format.md`.

## Decisions

- **Dataset placement**: original export `dataset_crawler-google-places_2026-10-18_16-29-07-519.json` moved unchanged to `data/atms.json` (git-tracked). No synthetic ATM records were created.
- **Bank enum**: expanded beyond a minimal set to cover the dataset (`NBE,BANQUE_MISR,BANQUE_DU_CAIRE,QNB,CIB,ALEXANDRIA_BANK,AGRICULTURAL_BANK,EGBANK,HOUSING_DEVELOPMENT,FAISAL_ISLAMIC,AL_BARAKA,AAIB,BANK_NXT,ADCB,CREDIT_AGRICOLE,POSTAL,OTHER`).
- **Search**: Arabic-normalized denormalized `searchText` (unifies alef variants, strips diacritics/tatweel and taa-marbuta; collapses whitespace) with GIN `pg_trgm` index; query normalized identically. LIKE metacharacters (`\ % _`) escaped (`ESCAPE '\'`).
- **Geo access**: `location` column has `select: false`; coordinates and distances read via `ST_X/ST_Y`, `ST_Distance`, `ST_DWithin` and `<->` in raw SQL (GiST index used for nearby filter + KNN order).
- **Open now**: `openNow=true` **excludes** ATMs with unknown hours at SQL level (only `(is24h OR openingHours)`); exact OPEN/CLOSED/UNKNOWN computed in-process with Cairo clock (DST-aware via `Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', ...})`). Overnight intervals have `close <= open` and are handled correctly (tail from previous day).
- **Report summary**: recency-weighted over last 6 h (configurable). Weight = `2 − ageHours/freshHours`. Highest total weight wins; **tie ⇒ UNKNOWN**, **no reports ⇒ UNKNOWN**. `reportsToday` is count since midnight Africa/Cairo. Documented as community-sourced (never bank-confirmed). Implementation: fetch since earliest of (freshSince, startOfDay); falls back to latest report for `reportedAt` if none recent.
- **Favorites distance**: when `lat,lng` provided to `/me/favorites`, distances are hydrated by a single `findManyByIds` query (joins to ATMs with ST_Distance). Order preserved by favorite recency; missing ATMs dropped.
- **Recent searches**: deduped by query (re-moved to top), trimmed to last 10 (`RECENT_SEARCHES_KEEP`).
- **Routing**: provider-based (OSRM/ORS/fallback). On any provider failure (timeout, non-200, malformed body) → straight-line fallback with `approximate=true`. Responses cached 60 s; cache key uses rounded coords to ~4 decimals (~11 m). GeoJSON LineString is `[lng, lat]`. Travel estimates for fallback: walk 78 m/min, urban drive 25 km/h. No WebSocket — complete response returned.
- **Throttle/guards**: `ThrottlerGuard` globally, `JwtAuthGuard` globally with `@Public()` bypass (guest covers `/v1/health`, `/v1/atms/*`, `/v1/auth/*`, `/v1/navigation/route`). Redis-backed throttler storage.
- **Auth**: access+refresh JWTs; refresh rotation; family reuse ⇒ `TOKEN_REUSE_DETECTED` + revoke family. OTP 6 digits sha256-hashed in Redis (TTL, attempts, cooldown). Reset tokens JWT `type: 'reset'`. `@CurrentUser` exposes `{id,email}`.
- **App config**: `src/app.setup.ts` exports `configureApp(app, { docs })` shared by `main.ts` and e2e tests. `dotenv/config` loaded first.
- **Docker**: deferred on current host (C: near-full, Docker Desktop broken). Dockerfile should use `node:22-slim` (argon2 musl prebuilds issue); `start:prod` `node dist/main.js` (aligns with `nest build` output `dist/main.js`). `docker-compose.yml` (api, postgres+postgis, redis, one-shot importer) left as planned.
- **Error shape**: `{statusCode, code, message}` (global filter). Validation errors → `VALIDATION_ERROR`.
- **Testing**: Jest unit + e2e. Throttler and mailer overridden in e2e. OTP extracted from mail text with `/\b(\d{6})\b/`.
- **Logging**: `nestjs-pino`, request id on every request; `/v1/health` and `/docs-json` auto-ignored; auth headers/body never logged.

## Notes

- All routes under `/v1`.
- ATMs endpoints are guest-accessible (read-only). `POST /v1/atms/:id/reports` and `/v1/me/*` require auth.
- `data/atms.json` remains unmodified from its original form.
- Project uses camelCase for DB columns; quoted in migrations (e.g. `"isBranch"`, `"openingHours"`, `"is24h"`, `"searchText"`).
- Current test suite: 164 unit tests, all green. Build + lint green. DB-dependent e2e (auth, navigation) require Postgres+Redis (deferred).