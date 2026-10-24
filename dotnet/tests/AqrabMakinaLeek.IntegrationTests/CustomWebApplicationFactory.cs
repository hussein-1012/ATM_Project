using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Infrastructure.Caching;
using AqrabMakinaLeek.Infrastructure.Email;
using AqrabMakinaLeek.Infrastructure.Routing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace AqrabMakinaLeek.IntegrationTests;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    public FakeAtmRepository AtmRepository { get; } = new();
    public FakeUserRepository UserRepository { get; } = new();
    public FakeRefreshTokenRepository RefreshTokenRepository { get; } = new();
    public FakeAtmReportRepository ReportRepository { get; } = new();
    public FakeFavoriteRepository FavoriteRepository { get; } = new();
    public FakeRecentSearchRepository SearchRepository { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove real repositories
            RemoveService<IAtmRepository>(services);
            RemoveService<IUserRepository>(services);
            RemoveService<IRefreshTokenRepository>(services);
            RemoveService<IAtmReportRepository>(services);
            RemoveService<IFavoriteRepository>(services);
            RemoveService<IRecentSearchRepository>(services);
            RemoveService<ICacheService>(services);
            RemoveService<IEmailService>(services);
            RemoveService<IRoutingProvider>(services);

            // Register Fakes as Singletons
            services.AddSingleton<IAtmRepository>(AtmRepository);
            services.AddSingleton<IUserRepository>(UserRepository);
            services.AddSingleton<IRefreshTokenRepository>(RefreshTokenRepository);
            services.AddSingleton<IAtmReportRepository>(ReportRepository);
            services.AddSingleton<IFavoriteRepository>(FavoriteRepository);
            services.AddSingleton<IRecentSearchRepository>(SearchRepository);

            // Register fast In-Memory implementations
            services.AddSingleton<ICacheService, InMemoryCacheService>();
            services.AddSingleton<IEmailService, ConsoleEmailService>();
            services.AddSingleton<IRoutingProvider, FallbackRoutingProvider>();
        });
    }

    private static void RemoveService<T>(IServiceCollection services)
    {
        var descriptor = services.FirstOrDefault(d => d.ServiceType == typeof(T));
        if (descriptor != null)
        {
            services.Remove(descriptor);
        }
    }
}
