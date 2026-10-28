# Aqrab Makina Leek — Nearest ATM For You

Nearest ATM for You (Fayoum, Egypt). Built with **.NET 10** (ASP.NET Core, Clean Architecture), MongoDB, Redis, and a React/Vite frontend.

## Quick Links

- **Swagger UI**: `/docs` (when running locally — e.g. <http://localhost:5155/docs>)
- **Health**: `GET /v1/health`

## Repository Structure

```
ATM/
├── dotnet/              # .NET 10 backend (ASP.NET Core, Clean Architecture)
│   ├── src/
│   │   ├── AqrabMakinaLeek.Domain/          # Entities, enums, value objects
│   │   ├── AqrabMakinaLeek.Application/     # Use-cases, DTOs, interfaces
│   │   ├── AqrabMakinaLeek.Infrastructure/  # MongoDB, Redis, JWT, Email, Routing
│   │   ├── AqrabMakinaLeek.WebApi/          # Controllers, middleware, Program.cs
│   │   └── AqrabMakinaLeek.Importer/        # ATM data import tool
│   └── tests/
│       ├── AqrabMakinaLeek.UnitTests/
│       └── AqrabMakinaLeek.IntegrationTests/
├── frontend/            # React 19 + Vite frontend
├── data/
│   └── atms.json        # Google Places crawler export (source of truth)
└── docs/
    └── data-format.md   # ATM data format specification
```

## Requirements

- **.NET 10 SDK** — [Download here](https://dotnet.microsoft.com/download/dotnet/10.0)
- **MongoDB** (local or Atlas) — connection string in `appsettings.json` or environment
- **Redis** (optional) — falls back to in-memory cache if unavailable
- **Node.js >= 20 + npm** — for the frontend only

## Backend Setup

```bash
cd dotnet

# Restore NuGet packages
dotnet restore

# Build
dotnet build

# Run tests
dotnet test

# Start the API (defaults to http://localhost:5155)
dotnet run --project src/AqrabMakinaLeek.WebApi
```

### Configuration

The backend reads configuration from `dotnet/src/AqrabMakinaLeek.WebApi/appsettings.json`
and `appsettings.Development.json`. Key settings:

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `Mongo` | `ConnectionString` | `mongodb://localhost:27017` | MongoDB connection string |
| `Mongo` | `DatabaseName` | `atm_project` | Database name |
| `Redis` | `ConnectionString` | `localhost:6379` | Redis connection (`memory` to skip) |
| `Jwt` | `AccessSecret` | *(placeholder)* | JWT signing key (≥ 32 chars) |
| `Jwt` | `AccessTtl` | `15m` | Access token lifetime |
| `Jwt` | `RefreshTtl` | `30d` | Refresh token lifetime |
| `Resend` | `ApiKey` | *(empty)* | Resend API key (omit → console email fallback) |
| `Routing` | `Provider` | `fallback` | `osrm` \| `ors` \| `fallback` |

For local secrets, create `dotnet/src/AqrabMakinaLeek.WebApi/appsettings.Local.json`
(gitignored) or use environment variables with `__` as section separator:

```bash
# Example environment variable overrides
Mongo__ConnectionString=mongodb+srv://user:pass@cluster.mongodb.net/
Jwt__AccessSecret=your-secure-random-secret-min-32-chars
Resend__ApiKey=re_your_key
```

### MongoDB Atlas (Cloud)

Use the Atlas connection string from your `.env` file:

```
MONGO_URI=mongodb+srv://ATM_USER:password@cluster0.92rplio.mongodb.net/
```

Set this via environment variable: `Mongo__ConnectionString=<your-atlas-uri>`

### Data Import

```bash
cd dotnet
dotnet run --project src/AqrabMakinaLeek.Importer -- --file ../data/atms.json
```

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /v1 to http://localhost:5155)
npm run dev
```

The Vite dev server runs on <http://localhost:5173> and proxies all `/v1/*` requests
to the .NET API on port 5000. Update `frontend/vite.config.js` if you change the
backend port.

## API Routes

All routes are prefixed with `/v1`.

| Category | Routes |
|----------|--------|
| Health | `GET /v1/health` |
| Auth | `POST /v1/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/verify-otp`, `/reset-password` |
| ATMs | `GET /v1/atms/nearby`, `/atms/search`, `/atms/:id` |
| Reports | `GET/POST /v1/atms/:id/reports` |
| Navigation | `POST /v1/navigation/route` |
| Favorites | `GET/PUT/DELETE /v1/me/favorites/:id` |
| Account | `GET/PATCH/DELETE /v1/me`, `POST /v1/me/change-password` |
| Recent Searches | `GET/POST/DELETE /v1/me/recent-searches` |

ATM endpoints (`/v1/atms/*`, `/v1/navigation/route`) are publicly accessible.
Auth endpoints (`/v1/auth/*`) are public. All `/v1/me/*` endpoints require JWT.

## External Service Notes

- **Redis unavailable**: the infrastructure layer automatically falls back to
  `InMemoryCacheService` — OTP and routing cache will work but not be shared across
  instances. No configuration change is needed.
- **Email (Resend) not configured**: falls back to `ConsoleEmailService` which
  prints OTP codes to the server console — suitable for development.
- **Routing provider**: defaults to `fallback` (straight-line distance). Set
  `Routing:Provider` to `osrm` or `ors` for real routing.

## Architecture Decisions

- **Clean Architecture**: Domain → Application → Infrastructure → WebApi dependency flow.
- **MongoDB**: document store for ATMs, users, refresh tokens, reports, favorites, recent searches.
- **Redis**: optional distributed cache for OTP, route cache, and throttling.
- **JWT**: access + refresh token pair; refresh rotation with family reuse detection.
- **Password hashing**: Argon2id via `Isopoh.Cryptography.Argon2`.
- **Email**: Resend HTTP API with console fallback for development.
- **CORS**: `AllowAnyOrigin` in development; configure `AllowedOrigins` for production.
- **Error shape**: `{ statusCode, code, message }` via `GlobalExceptionMiddleware`.
- **Data import**: `AqrabMakinaLeek.Importer` is an idempotent CLI tool.

## Notes

- `data/atms.json` is the raw crawler export and remains unmodified.
- See `docs/data-format.md` for the full ATM data schema used by the importer.
- The .NET solution file is `dotnet/AqrabMakinaLeek.slnx`.