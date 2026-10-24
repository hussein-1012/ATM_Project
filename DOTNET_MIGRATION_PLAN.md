# خطة التحويل الشاملة من Node.js (NestJS) إلى .NET 10 (C# / ASP.NET Core)
## مشروع: أقرب ماكينة ليك (Aqrab Makina Leek — Nearest ATM For You)

> **حالة المشروع:** ✅ **مكتمل بنسبة 100% عبر كافة المراحل الـ 14**  
> **الفرع المخصص في Git:** `dotnet-migration`  
> **الاختبارات الآلية:** 57 اختباراً يعمل بنجاح بنسبة 100% (47 Unit Tests + 10 Integration Tests) دون أي أخطاء أو تحذيرات.

---

## المقارنة التقنية بين النظامين (Tech Stack Mapping)

| المكون (Component) | في Node.js (NestJS) الأصلي | المقابل في .NET 10 (C#) المنجز | الحالة |
|---|---|---|:---:|
| **Runtime & Framework** | Node.js 22 LTS + NestJS 11 | **.NET 10 SDK + ASP.NET Core Web API** | ✅ مكتمل |
| **Language** | TypeScript (Strict mode) | **C# 14 (Nullable Reference Types, Records, Pattern Matching)** | ✅ مكتمل |
| **Architecture** | NestJS Modular Architecture | **Clean Architecture (Domain, Application, Infrastructure, WebAPI)** | ✅ مكتمل |
| **Database & Spatial** | MongoDB + Mongoose (2dsphere index) | **MongoDB.Driver Official C# Driver + GeoPoint + BsonClassMap** | ✅ مكتمل |
| **Caching & In-Memory** | ioredis (Redis) | **StackExchange.Redis + InMemory fallback** | ✅ مكتمل |
| **Password Hashing** | argon2 | **Isopoh.Cryptography.Argon2** (Argon2id implementation) | ✅ مكتمل |
| **Authentication & Tokens**| `@nestjs/jwt` (Access/Refresh/Reset) | **JwtBearer + System.IdentityModel.Tokens.Jwt** | ✅ مكتمل |
| **Validation** | `class-validator` + `zod` | **Strongly-typed DTOs + Global Exception Pipeline** | ✅ مكتمل |
| **Rate Limiting** | `@nestjs/throttler` (Redis-backed) | **Memory/Redis Distributed OTP & Reports Cooldown Service** | ✅ مكتمل |
| **Email Service** | `resend` SDK + Dev Console | **Resend Email Service + Console fallback provider** | ✅ مكتمل |
| **Routing / Navigation** | OSRM + ORS + Fallback | **OsrmRoutingProvider + OrsRoutingProvider + FallbackRoutingProvider** | ✅ مكتمل |
| **Arabic Normalization** | Regex utility in TypeScript | **ArabicNormalizeUtil (Tashkeel, Tatweel, Alef, Yeh, Ta-Marbuta)** | ✅ مكتمل |
| **Time & Cairo Clock** | `Intl.DateTimeFormat` (Africa/Cairo) | **CairoTimeUtil (Africa/Cairo + Egypt Standard Time + StartOfDayUtc)** | ✅ مكتمل |
| **API Documentation** | `@nestjs/swagger` | **Microsoft.OpenApi 2.x + Swashbuckle UI على المسار `/docs`** | ✅ مكتمل |
| **Testing** | Jest + Supertest | **xUnit + WebApplicationFactory E2E Integration Tests (57 Tests)** | ✅ مكتمل |
| **Containerization** | Dockerfile + docker-compose | **Multi-stage .NET 10 Dockerfile + docker-compose.yml (API, Mongo, Redis)** | ✅ مكتمل |

---

## تفاصيل المراحل الـ 14 المنجزة بالكامل (The 14 Migration Phases)

### Phase 1: Solution Architecture & Project Scaffolding 🏗️ ✅ [مكتملة 100%]
- [x] إنشاء .NET Solution باسم `AqrabMakinaLeek.slnx`.
- [x] إنشاء 7 مشاريع وفق Clean Architecture:
  1. `AqrabMakinaLeek.Domain` (Class Library - Pure domain).
  2. `AqrabMakinaLeek.Application` (Class Library - Use cases, DTOs, interfaces).
  3. `AqrabMakinaLeek.Infrastructure` (Class Library - MongoDB, Redis, JWT, Argon2, Resend, OSRM).
  4. `AqrabMakinaLeek.WebApi` (ASP.NET Core Web API - Controllers, Middleware, Docs).
  5. `AqrabMakinaLeek.Importer` (Console CLI - ATM dataset bulk upsert tool).
  6. `AqrabMakinaLeek.UnitTests` (xUnit - Algorithm, utility, and service unit tests).
  7. `AqrabMakinaLeek.IntegrationTests` (xUnit - End-to-end API HTTP integration tests).
- [x] إعداد `Directory.Build.props` المشترك (TargetFramework: net10.0, Nullable: enable, ImplicitUsings: enable).

### Phase 2: Domain Layer — Entities, Enums & Value Objects 📦 ✅ [مكتملة 100%]
- [x] الـ Enums: `AtmBank` (17 بنك مصري بالكامل مع الـ Labels الإنجليزية والعربية)، `TravelMode` (Walk, Drive)، `AtmReportStatus` (WORKING, OUT_OF_CASH, OUT_OF_SERVICE)، `OpenStatus` (OPEN, CLOSED, UNKNOWN).
- [x] الـ Value Objects: `GeoPoint` (2dsphere GeoJSON compliant [lng, lat])، `OpeningHours`، `OpeningHoursInterval`.
- [x] الـ Entities: `Atm`، `User`، `RefreshToken`، `AtmReport`، `Favorite`، `RecentSearch`.

### Phase 3: Core Utilities & High-Performance Algorithms 🧠 ✅ [مكتملة 100%]
- [x] `ArabicNormalizeUtil`: تطهير التشكيل، التطويل، توحيد الهمزات والألف والياء والتاء المربوطة.
- [x] `GeoUtil`: معادلة Haversine بالمتر، فحص حدود جمهورية مصر والفيوم، تقريب الإحداثيات للكيش.
- [x] `CairoTimeUtil`: تحويل التوقيت الصيفي لمدينة القاهرة وحساب بداية اليوم (Midnight) واستخراج `CairoClock`.
- [x] `OpenNowEvaluator`: قرار الفتح والإغلاق، دعم الـ 24 ساعة والفترات الممتدة بعد منتصف الليل (Overnight intervals).
- [x] `ReportSummaryCalculator`: ترجيح أحدث البلاغات (Recency weights: 1.0, 0.7, 0.4)، كسر التعادل، وتحديد الحالة بدقة.
- [x] `DurationParser`: تحويل نصوص الأوقات (`15m`, `30d`, `60s`) إلى `TimeSpan`.

### Phase 4: Infrastructure Foundation — MongoDB Persistence & Spatial Queries 🗄️ ✅ [مكتملة 100%]
- [x] `FlexibleObjectIdStringSerializer`: دعم شفاف للـ ObjectId كسلسلة نصية مع قاعدة بيانات Mongoose القديمة.
- [x] `MongoClassMapper`: ربط الـ BSON Class Maps تلقائياً مع CamelCase وإخفاء العناصر الزائدة.
- [x] `MongoDbContext`: إدارة الاتصال وإنشاء الفهارس الجغرافية `2dsphere` وفهارس البحث النصي والفريد.
- [x] `AtmRepository`: استعلام `$geoNear` بالـ Driver لحساب المسافة جغرافياً مع الفلترة والترتيب.
- [x] `UserRepository`, `RefreshTokenRepository`, `AtmReportRepository`, `FavoriteRepository`, `RecentSearchRepository`.

### Phase 5: Infrastructure Foundation — Redis Caching & Distributed Storage ⚡ ✅ [مكتملة 100%]
- [x] تثبيت `StackExchange.Redis`.
- [x] واجهة `ICacheService` مع `RedisCacheService` و `InMemoryCacheService` للطوارئ والاختبارات.
- [x] معالجة مرنة لانقطاع الاتصال (Resilient Connection & Fallback).

### Phase 6: Security Infrastructure — Argon2 & JWT Pipeline 🔐 ✅ [مكتملة 100%]
- [x] تشفير `Argon2PasswordHasher` باستخدام خوارزمية Argon2id المتوافقة مع باقة Node.js الأصلية.
- [x] `JwtTokenGenerator`: توليد وفحص Access Token (15 دقيقة) و Reset Token (10 دقائق) بختم HMAC-SHA256.

### Phase 7: Email Service & Resend Integration 📧 ✅ [مكتملة 100%]
- [x] واجهة `IEmailService` و `EmailMessage`.
- [x] `ResendEmailService` للتواصل مع `api.resend.com/emails`.
- [x] `ConsoleEmailService` للاختبار والتطوير بدون مفتاح API خارجي.

### Phase 8: Resilient Routing & Navigation Engine 🗺️ ✅ [مكتملة 100%]
- [x] نماذج الملاحة: `Maneuver`, `LatLng`, `RouteStep`, `RouteGeometry`, `RouteResult`.
- [x] `OsrmRoutingProvider`: الاتصال بمحرك OSRM بمهلة 5 ثوانٍ واستخراج مسار GeoJSON.
- [x] `OrsRoutingProvider`: الاتصال بمحرك OpenRouteService.
- [x] `FallbackRoutingProvider`: التقدير الهندسي الدقيق للخط المستقيم وحساب الدقائق (80m/min مشي، 500m/min قيادة).

### Phase 9: Application Services & Business Logic ⚙️ ✅ [مكتملة 100%]
- [x] استثناءات موحدة: `NotFoundException`, `UnauthorizedException`, `BadRequestException`, `ConflictException`, `ReportCooldownException`.
- [x] نماذج الـ DTOs الكاملة لكافة الموديولات.
- [x] خدمات الأعمال:
  - `AuthService`: تسجيل، دخول، تحديث توكن، نسيت كلمة المرور، التحقق من OTP، تغيير كلمة المرور.
  - `OtpService`: توليد OTP عشوائي من 6 أرقام مع التشفير والتخزين في الكاش وحد أقصى 5 محاولات.
  - `RefreshTokenService`: تدوير التوكن المنعش وإلغاء عائلة التوكن كاملة (Token Family Revocation) عند الشك في السرقة.
  - `AccountService`: استعراض البروفايل، تعديل الإعدادات واللغة، وحذف الحساب مع التحقق من الباسورد.
  - `AtmsService`: جلب أقرب ماكينات، البحث بالاسم والبنك ومواعيد العمل، وعرض تفاصيل الماكينة وبلاغات المجتمع.
  - `ReportsService`: تسجيل بلاغ مجتمعي وفرض فترة انتظار (Cooldown) لمنع السبام.
  - `FavoritesService`: إدارة المفضلة للمستخدم.
  - `RecentSearchesService`: حفظ ومسح سجل البحث الأخير.
  - `NavigationService`: حساب المسارات ومطابقة بيانات الماكينة.

### Phase 10: ATM Importer Engine & CLI Tool 📥 ✅ [مكتملة 100%]
- [x] بناء `RawAtmRecord`, `AtmJsonMapper`, `AtmImportService`.
- [x] كونسول CLI في `AqrabMakinaLeek.Importer` يدعم الخيارات: `--file`, `--source`, `--dry-run`.
- [x] كشف الماكينات المكررة في نطاق 15 متراً وعمل Bulk Upsert آمن.

### Phase 11: WebAPI Controllers & Endpoints 🌐 ✅ [مكتملة 100%]
- [x] `AuthController` (`/v1/auth`): تسجيل، دخول، استرجاع كلمة المرور، خروج.
- [x] `AccountController` (`/v1/auth/me`): قراءة البروفايل، تحديثه، حذف الحساب.
- [x] `AtmsController` (`/v1/atms`): أقرب ماكينات (`/nearby`)، بحث (`/search`)، وتفاصيل (`/{id}`).
- [x] `ReportsController` (`/v1/atms/{atmId}/reports`): إنشاء وقراءة البلاغات.
- [x] `FavoritesController` (`/v1/favorites`): استعراض وإضافة وحذف المفضلات.
- [x] `RecentSearchesController` (`/v1/settings/recent-searches`): سجل البحث.
- [x] `NavigationController` (`/v1/navigation`): مسارات الملاحة.
- [x] `HealthController` (`/health`, `/v1/health`): فحص صحة النظام.

### Phase 12: Security Middleware, Error Handling & Swagger Documentation 🛡️ ✅ [مكتملة 100%]
- [x] `GlobalExceptionMiddleware`: تحويل كل الأخطاء لهيكل `{ statusCode, code, message }` المتوافق حرفياً مع NestJS.
- [x] `RequestIdMiddleware`: توليد `X-Request-Id` وتضمينه في كل استجابة.
- [x] توثيق OpenAPI / Swagger على الرابط `/docs` مع دعم JWT Bearer.
- [x] ضبط CORS وتنسيق JSON بـ CamelCase وتحويل الـ Enums لنصوص تلقائياً.

### Phase 13: Unit & Integration Testing Suite 🧪 ✅ [مكتملة 100%]
- [x] **47 Unit Tests** في `AqrabMakinaLeek.UnitTests`:
  - `ArabicNormalizeUtilTests` (الهمزات والتشكيل والبحث).
  - `GeoUtilTests` (حسابات Haversine والحدود الجغرافية).
  - `CairoTimeUtilTests` (التوقيت الصيفي وبداية اليوم).
  - `OpenNowEvaluatorTests` (المواعيد العادية والليلية والـ 24 ساعة).
  - `ReportSummaryCalculatorTests` (أوزان البلاغات وكسر التعادل).
  - `DurationParserTests` (تحويل النصوص الزمنية).
  - `CacheServiceTests` (عمليات Redis و In-Memory).
  - `SecurityTests` (Argon2id و JWT tokens).
  - `EmailServiceTests` (Resend و Console fallback).
  - `RoutingTests` (الخط المستقيم ومحركات التوجيه).
  - `OtpServiceTests` (التوليد والتحقق والحد الأقصى للمحاولات).
  - `RefreshTokenServiceTests` (التدوير وإلغاء العائلة).
  - `AtmJsonMapperTests` (تحويل وتطهير سجلات الماكينات).
- [x] **10 End-to-End Integration Tests** في `AqrabMakinaLeek.IntegrationTests` عبر `WebApplicationFactory`:
  - اختبار الـ Health و Request ID header.
  - دورة الـ Auth الكاملة: تسجيل، بريد مكرر (409)، كلمة مرور خاطئة (401)، تسجيل دخول، قراءة البروفايل (200)، تحديث البروفايل، تغيير كلمة المرور، وتسجيل الخروج.
  - استعلام أقرب ماكينات بالفيوم (`/v1/atms/nearby`).
  - البحث باللغة العربية (`/v1/atms/search?q=الاهلي`).
  - تفاصيل الماكينة والحالة (200) والاستعلام عن ماكينة غير موجودة (404).
  - تسجيل بلاغ مجتمعي (201) وتطبيق فترة الانتظار Cooldown ومنع البلاغ المباشر (429).
  - قائمة بلاغات الماكينة.
  - إضافة مفضلة، استعراضها، وحذفها.
  - إضافة استعلام لسجل البحث الأخير واستعراضه ومسحه.
  - حساب مسار الملاحة وإرجاع الخطوات والمدة (`/v1/navigation/route/{atmId}`).
- [x] نتيجة الاختبارات: **57 Passed, 0 Failed, 0 Skipped** بنسبة نجاح 100%.

### Phase 14: Dockerization, Production Readiness & Verification 🚢 ✅ [مكتملة 100%]
- [x] إنشاء `dotnet/Dockerfile` متعدد المراحل (Multi-stage) مع تقليل حجم الصورة وتشغيلها بحساب غير جذري (`non-root USER $APP_UID`).
- [x] إنشاء `dotnet/docker-compose.yml` يشمل خدمات:
  - `api` (.NET 10 WebAPI على البورت 5000).
  - `mongodb` (Mongo 7.0 مع Healthcheck و Volume دائم).
  - `redis` (Redis 7.2 Alpine مع Healthcheck و Volume دائم).
- [x] إنشاء `dotnet/.dockerignore` لتسريع بناء الصور.
- [x] إعداد `appsettings.json` لربط المتغيرات تلقائياً.

---

## كيفية تشغيل المشروع واختباره (Running & Testing)

### 1. تشغيل جميع الاختبارات الآلية (Test Suite)
```powershell
dotnet test dotnet/AqrabMakinaLeek.slnx
```
**النتيجة المتوقعة:**
```text
Passed!  - Failed: 0, Passed: 47, Skipped: 0 - AqrabMakinaLeek.UnitTests.dll (net10.0)
Passed!  - Failed: 0, Passed: 10, Skipped: 0 - AqrabMakinaLeek.IntegrationTests.dll (net10.0)
Total: 57 passed, 0 failed.
```

### 2. بناء الحل بالكامل (Build Solution)
```powershell
dotnet build dotnet/AqrabMakinaLeek.slnx
```

### 3. تشغيل الـ WebAPI محلياً
```powershell
dotnet run --project dotnet/src/AqrabMakinaLeek.WebApi
```
- الرابط الأساسي: `http://localhost:5000`
- توثيق السواجر التفاعلي: `http://localhost:5000/docs`
- فحص الحالة: `http://localhost:5000/health`

### 4. تشغيل أداة استيراد الماكينات (CLI Importer)
```powershell
dotnet run --project dotnet/src/AqrabMakinaLeek.Importer -- --file data/atms.json --source fayoum_dataset
```

### 5. التشغيل الكامل عبر Docker Compose
```powershell
docker compose -f dotnet/docker-compose.yml up --build -d
```
