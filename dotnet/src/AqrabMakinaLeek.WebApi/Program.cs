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

var builder = WebApplication.CreateBuilder(args);

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

// Mount Swagger at /docs to match Node.js documentation path
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

// Initialize MongoDB indices if database is configured
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
