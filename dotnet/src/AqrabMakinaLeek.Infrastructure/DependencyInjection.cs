using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Infrastructure.Caching;
using AqrabMakinaLeek.Infrastructure.Email;
using AqrabMakinaLeek.Infrastructure.Persistence;
using AqrabMakinaLeek.Infrastructure.Persistence.Repositories;
using AqrabMakinaLeek.Infrastructure.Routing;
using AqrabMakinaLeek.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace AqrabMakinaLeek.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. MongoDB
        services.Configure<MongoOptions>(configuration.GetSection(MongoOptions.SectionName));
        services.AddSingleton<MongoDbContext>();

        // Repositories
        services.AddScoped<IAtmRepository, AtmRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IAtmReportRepository, AtmReportRepository>();
        services.AddScoped<IFavoriteRepository, FavoriteRepository>();
        services.AddScoped<IRecentSearchRepository, RecentSearchRepository>();

        // 2. Redis & Distributed Caching
        services.Configure<RedisOptions>(configuration.GetSection(RedisOptions.SectionName));
        var redisConn = configuration.GetSection(RedisOptions.SectionName).GetValue<string>("ConnectionString");

        if (!string.IsNullOrWhiteSpace(redisConn) && redisConn != "memory")
        {
            try
            {
                var multiplexer = ConnectionMultiplexer.Connect(new ConfigurationOptions
                {
                    EndPoints = { redisConn },
                    AbortOnConnectFail = false,
                    ConnectTimeout = 3000
                });
                services.AddSingleton<IConnectionMultiplexer>(multiplexer);
                services.AddSingleton<ICacheService, RedisCacheService>();
            }
            catch
            {
                services.AddSingleton<ICacheService, InMemoryCacheService>();
            }
        }
        else
        {
            services.AddSingleton<ICacheService, InMemoryCacheService>();
        }

        // 3. Security (Argon2 & JWT)
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IPasswordHasher, Argon2PasswordHasher>();
        services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();

        // 4. Email — Sendliberty (uses Gmail OAuth relay, no domain setup required)
        //    Docs: https://sendliberty.com/docs  |  Endpoint: POST https://sendliberty.com/api/send
        //    Falls back to ConsoleEmailService when the API key is absent (useful in Testing env).
        services.Configure<SendlibertyOptions>(configuration.GetSection(SendlibertyOptions.SectionName));
        var sendlibertyKey = configuration.GetSection(SendlibertyOptions.SectionName).GetValue<string>("ApiKey");
        if (!string.IsNullOrWhiteSpace(sendlibertyKey))
        {
            services.AddHttpClient<IEmailService, SendlibertyEmailService>();
        }
        else
        {
            services.AddSingleton<IEmailService, ConsoleEmailService>();
        }

        // 5. Routing Providers
        services.Configure<RoutingOptions>(configuration.GetSection(RoutingOptions.SectionName));
        services.AddSingleton<FallbackRoutingProvider>();
        services.AddHttpClient<OsrmRoutingProvider>();
        services.AddHttpClient<OrsRoutingProvider>();
        services.AddTransient<IRoutingProvider>(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<RoutingOptions>>().Value;
            return options.Provider.ToLowerInvariant() switch
            {
                "osrm" => sp.GetRequiredService<OsrmRoutingProvider>(),
                "ors" => sp.GetRequiredService<OrsRoutingProvider>(),
                _ => sp.GetRequiredService<FallbackRoutingProvider>()
            };
        });

        return services;
    }
}
