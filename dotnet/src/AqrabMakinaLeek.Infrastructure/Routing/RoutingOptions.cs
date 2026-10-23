namespace AqrabMakinaLeek.Infrastructure.Routing;

public class RoutingOptions
{
    public const string SectionName = "Routing";

    public string Provider { get; set; } = "fallback";
    public string OsrmUrl { get; set; } = "https://router.project-osrm.org";
    public string OrsUrl { get; set; } = "https://api.openrouteservice.org";
    public string OrsApiKey { get; set; } = string.Empty;
    public int TimeoutMs { get; set; } = 5000;
    public int CacheTtlSeconds { get; set; } = 60;
}
