using AqrabMakinaLeek.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AqrabMakinaLeek.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<OtpService>();
        services.AddScoped<RefreshTokenService>();
        services.AddScoped<AuthService>();
        services.AddScoped<AccountService>();
        services.AddScoped<AtmsService>();
        services.AddScoped<ReportsService>();
        services.AddScoped<FavoritesService>();
        services.AddScoped<RecentSearchesService>();
        services.AddScoped<NavigationService>();

        return services;
    }
}
