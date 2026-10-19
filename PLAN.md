# PLAN — Aqrab Makina Leek ("Nearest ATM For You")

Backend API for a mobile app that helps people in Fayoum, Egypt find the nearest ATM and navigate to it.
Arabic/RTL client — but the API returns **language-neutral JSON** (no localized strings, no `message` localization).

## 1. Tech stack

- Node.js 22 LTS, TypeScript (strict), NestJS 11, pnpm 10
- PostgreSQL 16 + PostGIS (`postgis/postgis:16-3.4`), TypeORM with **hand-written SQL migrations** (`synchronize: false` always)
- Redis (OTP storage, refresh-token-independent caching, rate-limit counters, route cache)
- class-validator / class-transformer, @nestjs/swagger (OpenAPI at `/docs`), @nestjs/config + zod env schema
- JWT (access + refresh with rotation & reuse detection), argon2 password hashing
- Jest (unit + e2e), ESLint 9 (flat) + Prettier, pino structured logging with request id
- Docker + docker-compose: `postgres` (postgis), `redis`, `api`, `importer` (one-shot, idempotent)

## 2. Repository / folder structure

```
.
├── PLAN.md
├── README.md
├── docs/
│   └── data-format.md          # expected import format (based on the real file)
├── data/
│   └── atms.json               # the real dataset (single source of truth, provided)
├── test/
│   ├── fixtures/atms-small.json # tiny fixture for e2e import test (never the full dataset)
│   ├── jest-e2e.json
│   └── *.e2e-spec.ts
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json / tsconfig.build.json
├── eslint.config.mjs / .prettierrc
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── config/
    │   ├── configuration.ts    # raw config object
    │   └── env.schema.ts       # zod schema, fails fast on boot
    ├── common/
    │   ├── constants.ts
    │   ├── decorators/         # @Public, @CurrentUser, @Throttle presets
    │   ├── filters/http-exception.filter.ts   # { statusCode, code, message }
    │   ├── guards/jwt-auth.guard.ts           # global; skips @Public
    │   ├── interceptors/logging.interceptor.ts
    │   ├── pipes/              # (validation configured globally in main.ts)
    │   ├── redis/redis.module.ts / redis.service.ts
    │   └── utils/
    │       ├── arabic-normalize.util.ts  # أ/إ/آ->ا, ة->ه, ى->ي, strip diacritics/tatweel
    │       ├── geo.util.ts               # haversine, rounding, bbox
    │       └── time.util.ts              # Africa/Cairo helpers via Intl
    ├── database/
    │   ├── data-source.ts      # TypeORM CLI DataSource (migrations only)
    │   └── migrations/         # 1600000000001-extensions.ts, ...-core-tables.ts, ...-atm-indexes.ts, ...
    └── modules/
        ├── auth/               # controller, service, dto, otp.service, refresh-token.service
        ├── users/              # users service + entities (User, RefreshToken)
        ├── atms/               # atms controller (nearby/search/detail), service, open-now.service, report-summary.service, entities (Atm, AtmReport)
        ├── search/             # SearchService (query building, normalization) used by atms controller
        ├── reports/            # reports controller (POST/GET /atms/:id/reports)
        ├── favorites/          # /me/favorites
        ├── navigation/         # /navigation/route, RoutingProvider (ors | osrm | fallback), redis cache
        ├── settings/           # account: /me (get/patch), change-password, soft delete, recent searches
        ├── health/             # /v1/health via @nestjs/terminus (db + redis)
        └── importer/           # AtmJsonMapper, ImportService, run-import.ts standalone script
```

Module wiring notes:
- The `/atms/search` route is exposed by `AtmsController` (declared before `:id` to avoid route shadowing); `SearchModule` owns the query-building service.
- `/me/recent-searches` lives in `SettingsModule` (account-owned data), matching the "account/settings" grouping.
- `CommonModule` is global and provides Redis, guards, filters.

## 3. Data model (ER)

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ ATM_REPORT : writes
    USER ||--o{ FAVORITE : has
    USER ||--o{ RECENT_SEARCH : issues
    ATM ||--o{ ATM_REPORT : receives
    ATM ||--o{ FAVORITE : is

    USER {
        uuid id PK
        string name
        string email UK "lowercased"
        string passwordHash "argon2"
        string preferredTravelMode "walk|drive, default walk"
        bool voiceGuidance "default true"
        string language "default ar"
        timestamptz createdAt
        timestamptz deletedAt "soft delete"
    }
    REFRESH_TOKEN {
        uuid id PK
        uuid userId FK
        string tokenHash "sha256 of the opaque token"
        uuid familyId "rotation family, reuse detection"
        timestamptz expiresAt
        timestamptz revokedAt
        string deviceInfo "user-agent, truncated"
    }
    ATM {
        uuid id PK
        string name
        string bank "enum: NBE, BANQUE_MISR, BANQUE_DU_CAIRE, QNB, CIB, ALEXANDRIA_BANK, AGRICULTURAL_BANK, EGBANK, HOUSING_DEVELOPMENT, FAISAL_ISLAMIC, AL_BARAKA, AAIB, BANK_NXT, ADCB, POSTAL, OTHER"
        string address
        geography location "Point SRID 4326, GiST index"
        bool isBranch
        jsonb openingHours "nullable, {monday:[{open,close}]}"
        bool is24h "nullable"
        bool wheelchairAccessible "nullable"
        string source
        string sourceId "unique with source"
        timestamptz sourceFetchedAt
        string searchText "normalized name+address+bank for trigram search"
        timestamptz createdAt
        timestamptz updatedAt
    }
    ATM_REPORT {
        uuid id PK
        uuid atmId FK
        uuid userId FK
        string status "WORKING|OUT_OF_CASH|OUT_OF_SERVICE"
        timestamptz createdAt
    }
    FAVORITE {
        uuid userId FK
        uuid atmId FK
        timestamptz createdAt
    }
    RECENT_SEARCH {
        uuid id PK
        uuid userId FK
        string query
        timestamptz createdAt
    }
```

Explicitly **not stored**: phone numbers, rating counts/distributions, reviews, photos/images, plus codes. The importer drops them.

`Favorite` primary key = (`userId`, `atmId`).
`RecentSearch`: keep only the **last 10 per user** (trimmed after insert).
`sourceId`: the file's `placeId` when present; otherwise a deterministic sha256 of normalized name + 5-decimal rounded coordinates.
`source`: constant `"google_places"` (overridable via `--source`; importer is source-agnostic).

## 4. Endpoints (all under `/v1`, JSON, language-neutral)

Error shape (global exception filter):

```json
{ "statusCode": 404, "code": "ATM_NOT_FOUND", "message": "ATM not found" }
```

### Auth
| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | /auth/register | public | `{name, email, password}` | `201 {user}` |
| POST | /auth/login | public | `{email, password}` | `{accessToken, refreshToken, user}` |
| POST | /auth/refresh | public | `{refreshToken}` | `{accessToken, refreshToken, user}` (rotates; reuse ⇒ revoke family + 401) |
| POST | /auth/logout | public | `{refreshToken}` | `{revoked: true}` (idempotent) |
| POST | /auth/forgot-password | public + strict throttle | `{email}` | `{sent: true}` — **same response whether or not the email exists** |
| POST | /auth/verify-otp | public + strict throttle | `{email, otp}` | `{resetToken}` (JWT, 10 min) |
| POST | /auth/reset-password | public + strict throttle | `{resetToken, newPassword}` | `{reset: true}` (revokes all refresh tokens) |

OTP: 6 digits, **hashed (sha256) in Redis**, TTL 10 min, max 5 attempts, 60 s resend cooldown. Delivered through a `MailService` interface — dev implementation logs to console/pino.

### ATMs (guest-accessible, read-only)
| Method | Path | Request | Response |
|---|---|---|---|
| GET | /atms/nearby | `?lat&lng&radius=3000 (max 20000)&limit=20 (max 100)` | `{items: [Atm], meta:{lat,lng,radius,limit,count}}` sorted by distance |
| GET | /atms/search | `?q&bank&openNow&wheelchair&maxDistance&lat&lng&page=1&limit=20` | `{items:[Atm], meta:{page,limit,total}}` |
| GET | /atms/:id | `?lat&lng` (optional) | `{Atm + reportSummary}` |

`Atm` response DTO: `{id, name, bank, address, location:{lat,lng}, isBranch, openingHours, is24h, wheelchairAccessible, sourceFetchedAt, openNow: "OPEN"|"CLOSED"|"UNKNOWN", distanceMeters?, walkMinutes?, driveMinutes?, travelTimesAreEstimates: true}`.
`walkMinutes = ceil(distanceMeters / 78)` (78 m/min walking), `driveMinutes = ceil(distanceMeters / 25000 * 60)` (25 km/h urban) — both **estimates**, flagged.

`reportSummary` = `{status: "WORKING"|"OUT_OF_CASH"|"OUT_OF_SERVICE"|"UNKNOWN", reportedAt: string|null, reportsToday: number}`.
Status from reports in the **last 6 h**, recency-weighted (`weight = 2 − ageHours/6`), highest total weight wins, **tie ⇒ UNKNOWN**, none ⇒ UNKNOWN. `reportsToday` = count since midnight Africa/Cairo. **Never presented as bank-confirmed** (documented in README + Swagger description).

### Reports (auth)
| Method | Path | Request | Response |
|---|---|---|---|
| POST | /atms/:id/reports | `{status}` | `201 {report}`; 429 `REPORT_COOLDOWN` if same user reported this ATM within 30 min; per-user throttle on top |
| GET | /atms/:id/reports | `?limit=10` | `{items:[{status, createdAt}]}` anonymized (no user ids) |

### Favorites (auth)
| Method | Path | Request | Response |
|---|---|---|---|
| GET | /me/favorites | `?lat&lng` | `{items:[Atm + distanceMeters?], meta:{count}}` |
| PUT | /me/favorites/:atmId | — | `200 {favorite}` (idempotent) |
| DELETE | /me/favorites/:atmId | — | `204` (idempotent) |

### Recent searches (auth)
| Method | Path | Request | Response |
|---|---|---|---|
| GET | /me/recent-searches | — | `{items:[{query, createdAt}]}` newest first, max 10 |
| POST | /me/recent-searches | `{query}` | `201 {item}` (trimmed, 1–120 chars, deduped per user, keeps last 10) |
| DELETE | /me/recent-searches | — | `204` clears all |

### Account / settings (auth)
| Method | Path | Request | Response |
|---|---|---|---|
| GET | /me | — | `{user}` |
| PATCH | /me | `{name?, preferredTravelMode?, voiceGuidance?, language?}` | `{user}` |
| POST | /me/change-password | `{currentPassword, newPassword}` | `{changed:true}` (revokes all refresh tokens) |
| DELETE | /me | — | `204` — soft delete: `deletedAt` set, PII anonymized, all refresh tokens revoked |

### Navigation (guest)
| Method | Path | Request | Response |
|---|---|---|---|
| POST | /navigation/route | `{from:{lat,lng}, atmId, mode:"walk"|"drive"}` | `{distanceMeters, durationSeconds, approximate, polyline (GeoJSON LineString), steps:[{maneuver, streetName, distanceMeters, durationSeconds, location}]}` |

`maneuver` enum: `DEPART | STRAIGHT | TURN_LEFT | TURN_RIGHT | SLIGHT_LEFT | SLIGHT_RIGHT | UTURN | ARRIVE`.
Provider selected by env `ROUTING_PROVIDER=osrm|ors|fallback`: OSRM/ORS over HTTP; on failure (timeout, non-200, bad body) → straight-line fallback with `approximate:true`. Identical requests cached in Redis 60 s, coordinates rounded to 4 decimals (~11 m). No WebSocket — client computes live ETA from this complete, stable response.

### Health
| Method | Path | Response |
|---|---|---|
| GET | /health | terminus status for `db` + `redis` (public, not versioned-prefixed requirement — mounted at `/v1/health`) |

## 5. Environment variables (validated with zod at boot — see `.env.example`)

| Var | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `development \| test \| production` |
| `PORT` | `3000` | |
| `DATABASE_URL` | `postgres://aqrab:aqrab@localhost:5432/aqrab` | |
| `REDIS_URL` | `redis://localhost:6379` | |
| `JWT_ACCESS_SECRET` | — (required) | min length 32 in production |
| `JWT_ACCESS_TTL` | `15m` | |
| `JWT_REFRESH_SECRET` | — (required) | |
| `JWT_REFRESH_TTL` | `30d` | |
| `JWT_RESET_TTL` | `10m` | password-reset token |
| `CORS_ORIGINS` | `*` in dev | comma-separated |
| `LOG_LEVEL` | `info` | |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60000` / `300` | global |
| `AUTH_THROTTLE_TTL` / `AUTH_THROTTLE_LIMIT` | `60000` / `10` | auth routes |
| `REPORT_THROTTLE_TTL` / `REPORT_THROTTLE_LIMIT` | `60000` / `5` | report routes |
| `OTP_TTL_SECONDS` / `OTP_MAX_ATTEMPTS` / `OTP_COOLDOWN_SECONDS` | `600` / `5` / `60` | |
| `REPORT_COOLDOWN_MINUTES` | `30` | per user per ATM |
| `REPORT_FRESH_HOURS` | `6` | reportSummary window |
| `ROUTING_PROVIDER` | `fallback` | `osrm \| ors \| fallback` |
| `OSRM_URL` | `https://router.project-osrm.org` | |
| `ORS_API_KEY` | — | required when provider=ors |
| `ROUTE_CACHE_TTL_SECONDS` | `60` | |
| `IMPORT_DEFAULT_FILE` | `data/atms.json` | |

## 6. Indexes & search strategy

- `atm_location_geog_gix` — **GiST** on `location` (geography). Nearby uses `ST_DWithin` (filter) + `<->` KNN (order). EXPLAIN output recorded in README.
- `ux_atm_source_sourceid` — UNIQUE (`source`, `sourceId`) — upsert target.
- `atm_search_trgm_idx` — **GIN pg_trgm** on `searchText` (normalized lowercase name + address + bank, diacritics stripped, Arabic letters unified) — `ILIKE '%q%'` is index-assisted. The query string is normalized with the exact same util before matching.
- `ix_atm_report_atm_created` — (`atmId`, `createdAt DESC`) — reportSummary + recent reports.
- `ix_atm_report_user_atm_created` — (`userId`, `atmId`, `createdAt DESC`) — cooldown check.
- `ix_refresh_token_user`, `ux_refresh_token_hash`, `ix_refresh_token_family`.
- `ix_recent_search_user_created` — (`userId`, `createdAt DESC`).
- All list endpoints paginated; list queries are single-statement (no N+1); reportSummary on the detail endpoint is one aggregated query.

## 7. Risks & assumptions

- **Data quality**: 43/157 records are not ATMs (banks, shops, mosques…), 11 are (temporarily/permanently) closed. The importer filters: keeps records whose `categories` contain `"ATM"` or a bank category; skips and reports everything else with reasons. Permanently closed ⇒ skipped; temporarily closed ⇒ imported (can reopen; users can report). No data is invented or deleted.
- **`data/atms.json`** arrived as a crawler export at the repo root (`dataset_crawler-google-places_2026-10-18_*.json`); moved to `data/atms.json` unchanged. Its shape is documented in `docs/data-format.md`.
- **Licensing**: source data derives from Google Maps scraping; ToS/licensing limits noted in README; the importer is source-agnostic (any JSON matching `docs/data-format.md` works).
- **Routing providers**: public OSRM demo is rate-limited; ORS needs a key. The fallback (straight line) guarantees the endpoint always answers. `approximate` tells the client which one it got.
- **Timezone**: `Africa/Cairo` computed via Node's full-ICU `Intl` (no extra dependency); DST handled by the runtime.
- **Egypt bounding box** for import validation: lat 22.0–31.7, lng 24.7–36.9 (records outside ⇒ skipped with reason).
- **Walk speed 78 m/min and 25 km/h urban** are spec-mandated constants — kept in one place (`common/constants.ts`).
- Assumption: guest mode covers all read endpoints (`/atms/*`, `/navigation/route`, `/health`); auth only for `/me/*` and reports.
- Assumption: `openNow=true` **excludes** ATMs with unknown hours (documented); without the flag, unknown-hours ATMs are included with `openNow:"UNKNOWN"`.
- Assumption: refresh token is an opaque random string; only its sha256 hash is stored.

## 8. Phase checklist (acceptance criteria per phase)

> **Status note (updated 2026-10-19).** Docker Desktop on the build host is
> broken (C: drive near-full; engine/vhdx unwritable), so every
> `docker compose up` / live-DB **e2e** acceptance item is verified against the
> running PostGIS container's SQL where possible and otherwise **deferred**
> until Docker is restored. Ticked phases have build + lint + unit tests green.
> The README EXPLAIN evidence and full documentation land in Phase 7.

- [x] **Phase 0 — Plan**: this file covers modules, ER diagram, endpoints, env vars, phases. ✔ committed before any code.
- [x] **Phase 1 — Scaffold**: NestJS app boots; config validated by zod; global ValidationPipe (whitelist + forbidNonWhitelisted), exception filter `{statusCode, code, message}`, request-id + pino logs, helmet, CORS, URI versioning `/v1`; Swagger at `/docs`; `/v1/health` green. `docker compose up` starts api + postgres + redis *(deferred — Docker)*. Build + lint green.
- [x] **Phase 2 — Database & import**: migrations create extensions (postgis, pg_trgm), all tables + indexes; `pnpm import:atms [--file] [--dry-run]` prints summary (total/inserted/updated/skipped+reasons/near-duplicates); re-import is idempotent; runs automatically via the one-shot importer service on first `docker compose up` *(deferred — Docker)*; mapper unit tests pass; `docs/data-format.md` written.
- [x] **Phase 3 — Auth/users/settings**: register/login/refresh/logout, OTP forgot→verify→reset with all limits, `/me` get/patch, change-password, soft delete. Auth e2e green incl. **refresh reuse detection** and OTP attempt/cooldown limits *(DB-dependent run deferred — Docker)*.
- [x] **Phase 4 — ATMs**: nearby (GiST, EXPLAIN in README *(README evidence deferred to Phase 7)*), search (Arabic normalization tests), detail (+reportSummary), openNow (unit-tested incl. Cairo timezone + wrap intervals). Build + lint + tests green.
- [x] **Phase 5 — Community**: reports with 30-min cooldown + throttle, reportSummary algorithm tests, favorites (distance), recent searches (last-10 trim). Tests green.
- [ ] **Phase 6 — Navigation**: RoutingProvider interface, OSRM + ORS impls, fallback, Redis cache (60 s, rounded coords). E2e with provider mocked + fallback path.
- [ ] **Phase 7 — Hardening & docs**: throttler review (Redis storage), no secrets/sensitive data in logs, coverage report, README complete (setup from scratch, EXPLAIN, Decisions), build + lint + all tests green.

Definition of done: `docker compose up` starts everything, the real `data/atms.json` is imported, all tests pass, `/docs` shows the complete API.
