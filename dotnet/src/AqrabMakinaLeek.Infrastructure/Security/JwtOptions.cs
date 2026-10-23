namespace AqrabMakinaLeek.Infrastructure.Security;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string AccessSecret { get; set; } = "super-secret-default-key-change-in-production-min-32-chars!";
    public string AccessTtl { get; set; } = "15m";
    public string RefreshTtl { get; set; } = "30d";
    public string ResetTtl { get; set; } = "10m";
    public string Issuer { get; set; } = "AqrabMakinaLeek";
    public string Audience { get; set; } = "AqrabMakinaLeek";
}
