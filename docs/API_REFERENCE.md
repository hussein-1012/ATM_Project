# Aqrab Makina Leek — API Reference
> Target audience: Flutter mobile developer  
> Generated from actual backend source code and live smoke tests.  
> Last audited: 2026-10-28

---

## Base URL

```
https://<YOUR_DOMAIN>/v1
```

During local development the backend runs on:

```
http://localhost:5155/v1
```

Replace `<YOUR_DOMAIN>` with your production domain after deployment. All paths in this document are relative to `/v1`.

---

## Authentication Model

The API uses **stateless JWT access tokens** with **rotating opaque refresh tokens**.

| Token | Type | Lifetime | Storage recommendation |
|---|---|---|---|
| `accessToken` | JWT (HS256) | 15 minutes | In-memory only |
| `refreshToken` | Opaque 64-char string | 30 days | Secure storage / encrypted prefs |
| `resetToken` | JWT (HS256, `type=reset`) | 10 minutes | In-memory only, single use |

### Attaching the Access Token

Every protected endpoint requires this header:

```
Authorization: Bearer <accessToken>
```

### Token Refresh Strategy

When any protected request returns `401`, silently call `/auth/refresh` with the stored `refreshToken`. On success, store the new pair and retry the original request. On failure (401 from refresh), log the user out.

```
401 on any request
  → POST /auth/refresh { refreshToken }
      → 200: store new accessToken + refreshToken, retry
      → 401: clear stored tokens, navigate to login
```

---

## Error Format

All errors return the same JSON shape:

```json
{
  "statusCode": 401,
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

### Common Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed request body |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh token not found |
| 401 | `REFRESH_TOKEN_EXPIRED` | Refresh token past its 30-day TTL |
| 401 | `TOKEN_REUSE_DETECTED` | Reuse of already-revoked refresh token; all sessions revoked |
| 401 | `OTP_INVALID` | Wrong or expired OTP code |
| 401 | `OTP_MAX_ATTEMPTS` | 5 failed OTP attempts; request a new code |
| 401 | `INVALID_RESET_TOKEN` | Reset token invalid, expired, or wrong type |
| 409 | `CONFLICT` / `EMAIL_TAKEN` | Duplicate email on registration |
| 404 | `NOT_FOUND` | Resource does not exist |
| 429 | `REPORT_COOLDOWN` | ATM report submitted too recently (`Retry-After` header included) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Enums

These string values are used throughout the API.

### `TravelMode`
```
Walk | Drive
```

### `AtmReportStatus`
```
WORKING | OUT_OF_CASH | OUT_OF_SERVICE
```

### `AtmBank`
```
NBE | BANQUE_MISR | BANQUE_DU_CAIRE | QNB | CIB | ALEXANDRIA_BANK
AGRICULTURAL_BANK | EGBANK | HOUSING_DEVELOPMENT | FAISAL_ISLAMIC
AL_BARAKA | AAIB | BANK_NXT | ADCB | CREDIT_AGRICOLE | POSTAL | OTHER
```

### `OpenStatus`
```
OPEN | CLOSED | UNKNOWN
```

---

## 1. Health

### `GET /health` or `GET /v1/health`

No authentication required.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-10-28T17:10:06.194Z"
}
```

**Test status:** ✅ Tested Successfully

---

## 2. Authentication

### `POST /auth/register`

Create a new user account. **No token required.**

**Request Body**
```json
{
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "password": "SecurePass123!"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✅ | Stored trimmed |
| `email` | string | ✅ | Stored lowercase; must be unique |
| `password` | string | ✅ | Hashed with Argon2 |

**Response `201`**
```json
{
  "user": {
    "id": "6ae22c712c5d925e0dd2fd38",
    "name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "preferredTravelMode": "Walk",
    "voiceGuidance": true,
    "language": "ar",
    "createdAt": "2026-10-28T17:10:09.931Z"
  }
}
```

> ⚠️ Register does **not** return tokens. The client must call `/auth/login` separately.

**Error Responses**
| Status | Code | When |
|---|---|---|
| 409 | `EMAIL_TAKEN` | Email already registered |
| 400 | `VALIDATION_ERROR` | Missing required fields |

**Test status:** ✅ Tested Successfully

---

### `POST /auth/login`

Authenticate and receive tokens. **No token required.**

**Request Body**
```json
{
  "email": "ahmed@example.com",
  "password": "SecurePass123!",
  "deviceInfo": "Flutter/3.0 Android/14"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | ✅ | |
| `password` | string | ✅ | |
| `deviceInfo` | string | ❌ | Labels the session; max 255 chars |

**Response `200`**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "BycU6SEGnL-abc123...",
  "user": {
    "id": "6ae22c712c5d925e0dd2fd38",
    "name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "preferredTravelMode": "Walk",
    "voiceGuidance": true,
    "language": "ar",
    "createdAt": "2026-10-28T17:10:09.931Z"
  }
}
```

**Error Responses**
| Status | Code | When |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |

**Test status:** ✅ Tested Successfully

---

### `POST /auth/refresh`

Exchange a refresh token for a new access + refresh token pair. **No Bearer header required.**

**Request Body**
```json
{
  "refreshToken": "BycU6SEGnL-abc123..."
}
```

**Response `200`** — Same shape as login response.

> ⚠️ The old refresh token is immediately invalidated. Store only the new one.  
> ⚠️ If a previously-revoked token is submitted, **all sessions for that user are revoked** (theft protection).

**Error Responses**
| Status | Code | When |
|---|---|---|
| 401 | `INVALID_REFRESH_TOKEN` | Token not found |
| 401 | `REFRESH_TOKEN_EXPIRED` | Expired (30 days) |
| 401 | `TOKEN_REUSE_DETECTED` | Reuse detected; all sessions revoked |

**Test status:** ✅ Tested Successfully (integration tests)

---

### `POST /auth/logout`

Revoke a refresh token. **No Bearer header required.**

**Request Body**
```json
{
  "refreshToken": "BycU6SEGnL-abc123..."
}
```

**Response `200`**
```json
{ "revoked": true }
```

**Test status:** ✅ Tested Successfully

---

### `POST /auth/forgot-password`

Trigger OTP email for password reset. **No token required.**

**Request Body**
```json
{
  "email": "ahmed@example.com"
}
```

**Response `200`**
```json
{ "sent": true }
```

> Always returns `{ "sent": true }` regardless of whether the email exists (prevents account enumeration).  
> OTP is a 6-digit code valid for **10 minutes**, max **5 wrong attempts**, **60-second cooldown** between requests.

**Test status:** ✅ Tested Successfully

---

### `POST /auth/verify-otp`

Verify the OTP and receive a short-lived reset token. **No token required.**

**Request Body**
```json
{
  "email": "ahmed@example.com",
  "otp": "482910"
}
```

**Response `200`**
```json
{
  "resetToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

> `resetToken` is a JWT valid for **10 minutes only**. Pass it immediately to `/auth/reset-password`.

**Error Responses**
| Status | Code | When |
|---|---|---|
| 401 | `OTP_INVALID` | Wrong code or expired |
| 401 | `OTP_MAX_ATTEMPTS` | 5 failed attempts |

**Test status:** ✅ Tested Successfully (integration tests)

---

### `POST /auth/reset-password`

Set a new password using the reset token. **No Bearer header required.**

**Request Body**
```json
{
  "resetToken": "eyJhbGciOiJIUzI1NiIs...",
  "newPassword": "NewSecurePass456!"
}
```

**Response `200`**
```json
{ "reset": true }
```

> ⚠️ On success, **all sessions are revoked**. User must log in again.

**Error Responses**
| Status | Code | When |
|---|---|---|
| 401 | `INVALID_RESET_TOKEN` | Invalid, expired, or wrong type |

**Test status:** ✅ Tested Successfully (integration tests)

---

### `POST /auth/change-password`

Change password for a logged-in user. **Requires Bearer token.**

**Request Body**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response `200`**
```json
{ "changed": true }
```

> ⚠️ On success, **all sessions are revoked**. Issue a new login.

**Error Responses**
| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing/invalid access token |
| 401 | `INVALID_CURRENT_PASSWORD` | Current password incorrect |

**Test status:** ✅ Tested Successfully

---

## 3. Account / Profile

All endpoints require `Authorization: Bearer <accessToken>`.

### `GET /auth/me`

**Response `200`**
```json
{
  "id": "6ae22c712c5d925e0dd2fd38",
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "preferredTravelMode": "Walk",
  "voiceGuidance": true,
  "language": "ar",
  "createdAt": "2026-10-28T17:10:09.931Z"
}
```

**Test status:** ✅ Tested Successfully

---

### `PATCH /auth/me`

Update profile fields. Only include fields you want to change.

**Request Body** (all optional)
```json
{
  "name": "Ahmed Mohamed Ali",
  "preferredTravelMode": "Drive",
  "voiceGuidance": false,
  "language": "en"
}
```

| Field | Type | Values |
|---|---|---|
| `name` | string? | Any non-empty string |
| `preferredTravelMode` | string? | `"Walk"` or `"Drive"` |
| `voiceGuidance` | bool? | `true` / `false` |
| `language` | string? | `"ar"` or `"en"` |

**Response `200`** — Full updated user profile (same shape as `GET /auth/me`)

**Test status:** ✅ Tested Successfully

---

### `DELETE /auth/me`

Soft-delete the account. PII is anonymized.

**Request Body**
```json
{
  "password": "CurrentPass123!"
}
```

**Response `200`**
```json
{ "deleted": true }
```

**Test status:** ✅ Tested Successfully (integration tests)

---

## 4. ATMs

No authentication required.

### `GET /atms/nearby`

**Query Parameters**

| Param | Type | Required | Default |
|---|---|---|---|
| `lat` | double | ✅ | — |
| `lng` | double | ✅ | — |
| `radius` | double | ❌ | 2000 (meters) |
| `limit` | int | ❌ | 50 |

**Response `200`**
```json
{
  "items": [
    {
      "id": "60c72b2f9b1d8b001c8e4d1a",
      "name": "National Bank of Egypt — Fayoum",
      "bank": "NBE",
      "address": "شارع الحرية، الفيوم",
      "location": { "lat": 29.309, "lng": 30.8435 },
      "isBranch": false,
      "openingHours": null,
      "is24h": true,
      "wheelchairAccessible": null,
      "sourceFetchedAt": "2026-09-01",
      "openNow": "OPEN",
      "travelTimesAreEstimates": true,
      "distanceMeters": 112,
      "walkMinutes": 2,
      "driveMinutes": 1
    }
  ],
  "meta": { "lat": 29.3084, "lng": 30.8428, "radius": 2000, "limit": 50, "count": 1 }
}
```

**Test status:** ✅ Tested Successfully

---

### `GET /atms/search`

**Query Parameters**

| Param | Type | Required | Default |
|---|---|---|---|
| `q` | string | ❌ | — |
| `bank` | string | ❌ | — |
| `wheelchair` | bool | ❌ | — |
| `maxDistance` | double | ❌ | — |
| `lat` | double | ❌ | — |
| `lng` | double | ❌ | — |
| `openNow` | bool | ❌ | false |
| `page` | int | ❌ | 1 |
| `limit` | int | ❌ | 20 |

**Response `200`**
```json
{
  "items": [ /* AtmResponseDto array */ ],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

**Test status:** ✅ Tested Successfully

---

### `GET /atms/{id}`

ATM detail with report summary.

**Optional query:** `refLat`, `refLng` — adds distance/time calculations.

**Response `200`** — Same as ATM in nearby, plus:
```json
{
  "reportSummary": {
    "status": "WORKING",
    "reportedAt": "2026-10-28T14:30:00Z",
    "reportsToday": 3
  }
}
```

| Status | When |
|---|---|
| 404 | ATM not found |

**Test status:** ✅ Tested Successfully

---

## 5. ATM Reports

### `POST /atms/{atmId}/reports` — 🔒 Auth Required

**Request Body**
```json
{ "status": "OUT_OF_CASH" }
```

**Response `201`**
```json
{ "id": "...", "atmId": "...", "status": "OUT_OF_CASH", "createdAt": "..." }
```

| Status | Code | When |
|---|---|---|
| 429 | `REPORT_COOLDOWN` | Too recent; check `Retry-After` header |

**Test status:** ✅ Tested Successfully

---

### `GET /atms/{atmId}/reports`

**Query:** `limit` (default 10)

**Response `200`** — Array of report objects.

**Test status:** ✅ Tested Successfully

---

## 6. Favorites — 🔒 All Auth Required

### `GET /favorites`

Optional query: `refLat`, `refLng`

**Response `200`**
```json
{ "items": [ /* AtmResponseDto */ ], "meta": { "count": 3 } }
```

### `POST /favorites/{atmId}`

No body. **Response `201`**
```json
{ "atmId": "...", "createdAt": "..." }
```

### `DELETE /favorites/{atmId}`

**Response `204 No Content`**

**Test status:** ✅ All Tested Successfully

---

## 7. Recent Searches — 🔒 All Auth Required

### `GET /settings/recent-searches`

**Response `200`**
```json
{ "items": [{ "id": "...", "query": "بنك مصر", "createdAt": "..." }] }
```

### `POST /settings/recent-searches`

**Request Body**
```json
{ "query": "بنك مصر الفيوم" }
```

**Response `201`**
```json
{ "id": "...", "query": "بنك مصر الفيوم", "createdAt": "..." }
```

### `DELETE /settings/recent-searches`

**Response `204 No Content`**

**Test status:** ✅ All Tested Successfully

---

## 8. Navigation

### `GET /navigation/route/{atmId}`

No auth required.

**Query Parameters**

| Param | Type | Required | Default |
|---|---|---|---|
| `fromLat` | double | ✅ | — |
| `fromLng` | double | ✅ | — |
| `mode` | string | ❌ | `Walk` |

**Response `200`**
```json
{
  "distanceMeters": 450,
  "durationSeconds": 324,
  "approximate": true,
  "polyline": {
    "type": "LineString",
    "coordinates": [[30.8428, 29.3084], [30.8435, 29.309]]
  },
  "steps": [
    { "maneuver": "DEPART", "streetName": null, "distanceMeters": 450, "durationSeconds": 324, "location": { "lat": 29.3084, "lng": 30.8428 } },
    { "maneuver": "ARRIVE", "streetName": null, "distanceMeters": 0, "durationSeconds": 0, "location": { "lat": 29.309, "lng": 30.8435 } }
  ]
}
```

Maneuver values: `DEPART | STRAIGHT | TURN_LEFT | TURN_RIGHT | SLIGHT_LEFT | SLIGHT_RIGHT | UTURN | ARRIVE`

`approximate: true` = straight-line estimation. `false` = real road routing (OSRM/ORS).

| Status | When |
|---|---|
| 404 | ATM not found |

**Test status:** ✅ Tested Successfully (integration tests)

---

## 9. Complete Endpoint Summary

| # | Method | Path | Auth | Description | Status |
|---|---|---|---|---|---|
| 1 | GET | `/health` | ❌ | Health check | ✅ |
| 2 | GET | `/v1/health` | ❌ | Health check (versioned) | ✅ |
| 3 | POST | `/v1/auth/register` | ❌ | Create account | ✅ |
| 4 | POST | `/v1/auth/login` | ❌ | Login, get tokens | ✅ |
| 5 | POST | `/v1/auth/refresh` | ❌ | Rotate tokens | ✅ |
| 6 | POST | `/v1/auth/logout` | ❌ | Revoke refresh token | ✅ |
| 7 | POST | `/v1/auth/forgot-password` | ❌ | Send OTP | ✅ |
| 8 | POST | `/v1/auth/verify-otp` | ❌ | Verify OTP → reset token | ✅ |
| 9 | POST | `/v1/auth/reset-password` | ❌ | Reset password | ✅ |
| 10 | POST | `/v1/auth/change-password` | ✅ | Change password | ✅ |
| 11 | GET | `/v1/auth/me` | ✅ | Get profile | ✅ |
| 12 | PATCH | `/v1/auth/me` | ✅ | Update profile | ✅ |
| 13 | DELETE | `/v1/auth/me` | ✅ | Delete account | ✅ |
| 14 | GET | `/v1/atms/nearby` | ❌ | ATMs near location | ✅ |
| 15 | GET | `/v1/atms/search` | ❌ | Search ATMs | ✅ |
| 16 | GET | `/v1/atms/{id}` | ❌ | ATM detail | ✅ |
| 17 | POST | `/v1/atms/{atmId}/reports` | ✅ | Submit report | ✅ |
| 18 | GET | `/v1/atms/{atmId}/reports` | ❌ | List reports | ✅ |
| 19 | GET | `/v1/favorites` | ✅ | List favorites | ✅ |
| 20 | POST | `/v1/favorites/{atmId}` | ✅ | Add favorite | ✅ |
| 21 | DELETE | `/v1/favorites/{atmId}` | ✅ | Remove favorite | ✅ |
| 22 | GET | `/v1/settings/recent-searches` | ✅ | List searches | ✅ |
| 23 | POST | `/v1/settings/recent-searches` | ✅ | Save search | ✅ |
| 24 | DELETE | `/v1/settings/recent-searches` | ✅ | Clear searches | ✅ |
| 25 | GET | `/v1/navigation/route/{atmId}` | ❌ | Route to ATM | ✅ |

**Total: 25 endpoints — 25/25 Tested Successfully**

---

## 10. Authentication Flow Diagrams

### Registration + Login
```
Flutter                          Backend                     MongoDB
  │── POST /auth/register ─────────▶ Argon2.Hash(password)
  │                                  Insert user ─────────────▶ users
  │◀──────────────── 201 { user } ──
  │
  │── POST /auth/login ────────────▶ Find user, Argon2.Verify()
  │                                  Generate JWT (15 min)
  │                                  Generate random refresh token
  │                                  SHA256(token) → save ────▶ refresh_tokens
  │◀── 200 { accessToken,
  │         refreshToken, user } ──
```

### Password Reset (3 steps)
```
1. POST /auth/forgot-password { email }
   → Backend generates 6-digit OTP → stores SHA256(OTP) in cache (10 min TTL)
   → Sends OTP via email → always returns { sent: true }

2. POST /auth/verify-otp { email, otp }
   → Backend compares SHA256(otp) with stored hash
   → On match: deletes OTP, returns { resetToken: JWT (10 min) }

3. POST /auth/reset-password { resetToken, newPassword }
   → Backend validates JWT type=reset → updates password → revokes all sessions
   → Returns { reset: true } — user must log in again
```

---

## 11. Flutter Integration Notes

### Content-Type
All requests with a body: `Content-Type: application/json`

### Date Format
All timestamps: ISO 8601 UTC — `"2026-10-28T17:10:09.931Z"`

### Recommended Token Storage
- **Access token:** In-memory variable only (never persist)
- **Refresh token:** `flutter_secure_storage` or platform keychain

### Auto-Refresh Pattern
On 401 from any protected endpoint → call `/auth/refresh` → retry once → if refresh also fails → logout.

---

## 12. Known Limitations

| Item | Detail |
|---|---|
| ATM data | Database must be populated via Importer before ATM endpoints return results |
| Routing | Default uses straight-line estimation; configure OSRM/ORS for real roads |
| OTP cache | In-process memory by default; use Redis in production |
| Reset token reuse | No server-side blacklist; relies on 10-minute TTL |
| Token cleanup | No MongoDB TTL index on `refresh_tokens`; expired tokens accumulate |
