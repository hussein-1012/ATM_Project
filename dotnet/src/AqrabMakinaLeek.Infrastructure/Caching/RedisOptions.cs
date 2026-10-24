namespace AqrabMakinaLeek.Infrastructure.Caching;

public class RedisOptions
{
    public const string SectionName = "Redis";

    public string ConnectionString { get; set; } = "localhost:6379";
    public bool AbortOnConnectFail { get; set; } = false;
    public int ConnectTimeout { get; set; } = 5000;
}
