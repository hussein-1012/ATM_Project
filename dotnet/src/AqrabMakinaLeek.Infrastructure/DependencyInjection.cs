using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Infrastructure.Caching;
using AqrabMakinaLeek.Infrastructure.Persistence;
using AqrabMakinaLeek.Infrastructure.Persistence.Repositories;
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

        return services;
    }
}
