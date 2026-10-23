# Authentication System — Full Plan

## Phase 1: Discovery & Analysis ✅
> تحليل الكود الموجود وتصميم الخطة

| # | Task | Status |
|---|------|--------|
| 1.1 | Audit project structure, modules, and dependencies | ✅ |
| 1.2 | Map existing entities (User, RefreshToken, Atm, AtmReport, Favorite, RecentSearch) | ✅ |
| 1.3 | Identify database connections (TypeORM/Postgres, Redis) | ✅ |
| 1.4 | Review existing auth flow (JWT, OTP, password hashing) | ✅ |
| 1.5 | Collect design decisions from user (migration scope, endpoints, email provider) | ✅ |
| 1.6 | Produce analysis report | ✅ |

---

## Phase 2: Database Foundation — MongoDB Migration ✅
> تحويل كل الداتابيز من PostgreSQL/TypeORM لـ MongoDB/Mongoose

| # | Task | Status |
|---|------|--------|
| 2.1 | Install `@nestjs/mongoose` + `mongoose` | ✅ |
| 2.2 | Create Mongoose schemas (User, RefreshToken, Atm, AtmReport, Favorite, RecentSearch) | ✅ |
| 2.3 | Add indexes (2dsphere, text, unique compound, etc.) | ✅ |
| 2.4 | Rewrite `DatabaseModule` → `MongooseModule.forRootAsync` | ✅ |
| 2.5 | Update `env.schema.ts` + `configuration.ts` (`DATABASE_URL` → `MONGO_URI`) | ✅ |
| 2.6 | Rewrite all 9 services (Repository → Model) | ✅ |
| 2.7 | Rewrite `AtmsRepository` (PostGIS SQL → `$geoNear` aggregation) | ✅ |
| 2.8 | Rewrite importer (`bulkWrite` upsert, GeoJSON Point) | ✅ |
| 2.9 | Update controllers (`ParseUUIDPipe` → `ParseObjectIdPipe`) | ✅ |
| 2.10 | Update `HealthController` → `MongooseHealthIndicator` | ✅ |
| 2.11 | Update `docker-compose.yml` (Postgres → Mongo 7) | ✅ |
| 2.12 | Update `.env` + `.env.example` | ✅ |
| 2.13 | Remove TypeORM/pg deps, delete SQL migrations | ✅ |
| 2.14 | Fix Jest config for `@nestjs/mongoose` ESM + pnpm | ✅ |
| 2.15 | Verify `pnpm build` — 0 errors | ✅ |

---

## Phase 3: Auth Lifecycle ✅
> تسجيل، دخول، تجديد التوكن، خروج

| # | Task | Status |
|---|------|--------|
| 3.1 | Create/verify auth DTOs (`RegisterDto`, `LoginDto`, `RefreshDto`, `AuthResponseDto`) | ✅ |
| 3.2 | Wire `AuthController` endpoints: | |
|  | `POST /v1/auth/register` — create account, return user (no auto-login) | ✅ |
|  | `POST /v1/auth/login` — validate credentials, issue access + refresh tokens | ✅ |
|  | `POST /v1/auth/refresh` — rotate refresh token, issue new pair | ✅ |
|  | `POST /v1/auth/logout` — revoke refresh token | ✅ |
| 3.3 | Verify `AuthService` logic works end-to-end with Mongoose | ✅ |
| 3.4 | Verify JWT guard (`JwtAuthGuard`) protects routes correctly | ✅ |
| 3.5 | Verify `@Public()` decorator exempts guest routes | ✅ |
| 3.6 | Test: register → login → refresh → logout flow manually | ✅ |

---

## Phase 4: Account Management (`/v1/auth/me`) ✅
> بروفايل، تغيير باسورد، حذف الحساب

| # | Task | Status |
|---|------|--------|
| 4.1 | Move profile/account endpoints from `/settings` → `/v1/auth/me` | ✅ |
| 4.2 | `GET /v1/auth/me` — return current user profile | ✅ |
| 4.3 | `PATCH /v1/auth/me` — update name, travel mode, voice guidance, language | ✅ |
| 4.4 | `POST /v1/auth/me/change-password` — verify current password → set new | ✅ |
| 4.5 | `DELETE /v1/auth/me` — require password confirmation before soft-delete | ✅ |
| 4.6 | On delete: revoke all refresh tokens, anonymize personal data | ✅ |
| 4.7 | Clean up old `AccountController` / `SettingsModule` references | ✅ |

---

## Phase 5: Email & OTP — Resend Integration ✅
> نسيت الباسورد → OTP بالإيميل → إعادة التعيين

| # | Task | Status |
|---|------|--------|
| 5.1 | Install `resend` package | ✅ |
| 5.2 | Add `RESEND_API_KEY` to env schema + config | ✅ |
| 5.3 | Create `ResendMailService` implementing `MailService` interface | ✅ |
| 5.4 | Replace `ConsoleMailService` with `ResendMailService` in `AuthModule` | ✅ |
| 5.5 | Wire endpoints: | |
|  | `POST /v1/auth/forgot-password` — generate OTP, send via Resend | ✅ |
|  | `POST /v1/auth/verify-otp` — validate OTP → issue short-lived reset token | ✅ |
|  | `POST /v1/auth/reset-password` — validate reset token → set new password | ✅ |
| 5.6 | Email template (plain text + HTML) for OTP | ✅ |
| 5.7 | Keep `ConsoleMailService` as fallback for `NODE_ENV=development` | ✅ |

---

## Phase 6: Security Hardening & Polish ✅
> تأمين، توثيق، تجربة نهائية

| # | Task | Status |
|---|------|--------|
| 6.1 | Apply auth-specific rate limiting (`AUTH_THROTTLE_*`) to auth endpoints | ✅ |
| 6.2 | Apply report rate limiting (`REPORT_THROTTLE_*`) | ✅ |
| 6.3 | Input validation review (all DTOs have proper decorators) | ✅ |
| 6.4 | Swagger documentation for all new endpoints | ✅ |
| 6.5 | Verify CORS configuration | ✅ |
| 6.6 | Review error response format consistency | ✅ |
| 6.7 | End-to-end manual test: full auth lifecycle | ✅ |
| 6.8 | Fix remaining unit test specs (Jest ESM pnpm issue) | ✅ |
| 6.9 | Final `pnpm build` + `pnpm test` green | ✅ |

---

## Summary

| Phase | Description | Status | Tasks |
|-------|-------------|--------|-------|
| **1** | Discovery & Analysis | ✅ Done | 6/6 |
| **2** | MongoDB Migration | ✅ Done | 15/15 |
| **3** | Auth Lifecycle | ✅ Done | 6/6 |
| **4** | Account Management | ✅ Done | 7/7 |
| **5** | Email & OTP (Resend) | ✅ Done | 7/7 |
| **6** | Security & Polish | ✅ Done | 9/9 |

> **Progress: 45 / 45 tasks complete (100%)**

> [!NOTE]
> All phases are fully implemented and verified. Unit tests (19 test suites, 163 tests), linter, and production build all pass cleanly with zero errors.

