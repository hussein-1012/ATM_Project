using System.Text;
using System.Text.Json.Serialization;
using AqrabMakinaLeek.Application;
using AqrabMakinaLeek.Infrastructure;
using AqrabMakinaLeek.Infrastructure.Persistence;
using AqrabMakinaLeek.Infrastructure.Security;
using AqrabMakinaLeek.WebApi.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

// ── Load .env file (root of repo, two levels up from WebApi) ─────────────────
// ASP.NET Core does not read .env automatically; we do it here so that all
// Resend__ApiKey, Mongo__ConnectionString, etc. from .env are available as
// environment variables to the configuration system.
static void LoadDotEnv()
{
    // Walk up from the assembly location to find the repo root .env
    var dir = AppContext.BaseDirectory;
    string? envPath = null;
    for (var i = 0; i < 8; i++)
    {
        var candidate = Path.Combine(dir, ".env");
        if (File.Exists(candidate)) { envPath = candidate; break; }
        var parent = Directory.GetParent(dir);
        if (parent is null) break;
        dir = parent.FullName;
    }

    if (envPath is null) return;

    foreach (var raw in File.ReadAllLines(envPath))
    {
        var line = raw.Trim();
        // Skip blanks and comments
        if (string.IsNullOrEmpty(line) || line.StartsWith('#')) continue;

        var idx = line.IndexOf('=');
        if (idx <= 0) continue;

        var key   = line[..idx].Trim();
        var value = line[(idx + 1)..].Trim();

        // Only set if not already set by the OS environment (OS wins)
        if (Environment.GetEnvironmentVariable(key) is null)
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);

// Re-add environment variables after loading .env so ASP.NET configuration
// picks up the newly set variables (they are now OS-level env vars).
builder.Configuration.AddEnvironmentVariables();

// 1. Clean Architecture Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// 2. Controllers & JSON Configuration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// 3. JWT Authentication
var jwtSecret = builder.Configuration.GetSection(JwtOptions.SectionName).GetValue<string>("AccessSecret")
    ?? "super-secret-default-key-change-in-production-min-32-chars!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.FromSeconds(5)
    };
});

// 4. CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .WithHeaders("Content-Type", "Authorization", "X-Request-Id")
              .WithExposedHeaders("X-Request-Id");
    });
});

// 5. Swagger / OpenAPI Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Aqrab Makina Leek API",
        Version = "v1",
        Description = "Nearest ATM For You — find and navigate to ATMs in Fayoum, Egypt. " +
                      "All responses are language-neutral JSON. Community-reported ATM status is " +
                      "crowd-sourced and NEVER bank-confirmed."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT Bearer token"
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", document),
            new List<string>()
        }
    });
});

var app = builder.Build();

// 6. Middleware Pipeline
app.UseMiddleware<RequestIdMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();

app.UseCors();

// Mount Swagger at /docs
app.UseSwagger(c =>
{
    c.RouteTemplate = "docs/{documentName}/swagger.json";
});
app.UseSwaggerUI(c =>
{
    c.RoutePrefix = "docs";
    c.SwaggerEndpoint("/docs/v1/swagger.json", "Aqrab Makina Leek API v1");
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Initialize MongoDB indices (non-fatal; app runs even if this fails)
try
{
    using var scope = app.Services.CreateScope();
    var mongoContext = scope.ServiceProvider.GetService<MongoDbContext>();
    if (mongoContext is not null)
    {
        await mongoContext.InitializeIndicesAsync();
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Failed to initialize MongoDB indexes on startup");
}

app.Run();

// Required for WebApplicationFactory in Integration Tests
public partial class Program { }
