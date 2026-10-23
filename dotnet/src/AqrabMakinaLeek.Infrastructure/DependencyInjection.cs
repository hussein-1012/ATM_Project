using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Infrastructure.Persistence;
using AqrabMakinaLeek.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AqrabMakinaLeek.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MongoOptions>(configuration.GetSection(MongoOptions.SectionName));

        services.AddSingleton<MongoDbContext>();

        services.AddScoped<IAtmRepository, AtmRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IAtmReportRepository, AtmReportRepository>();
        services.AddScoped<IFavoriteRepository, FavoriteRepository>();
        services.AddScoped<IRecentSearchRepository, RecentSearchRepository>();

        return services;
    }
}
