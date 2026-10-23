using AqrabMakinaLeek.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AqrabMakinaLeek.Infrastructure.Caching;

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisCacheService> _logger;

    public RedisCacheService(IConnectionMultiplexer redis, ILogger<RedisCacheService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    private IDatabase Database => _redis.GetDatabase();

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var value = await Database.StringGetAsync(key);
            return value.IsNullOrEmpty ? null : value.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis GET failed for key {Key}", key);
            return null;
        }
    }

    public async Task SetAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        try
        {
            await Database.StringSetAsync(key, value, expiry.HasValue ? expiry.Value : default);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis SET failed for key {Key}", key);
        }
    }

    public async Task DeleteAsync(CancellationToken ct = default, params string[] keys)
    {
        if (keys.Length == 0) return;

        try
        {
            var redisKeys = keys.Select(k => (RedisKey)k).ToArray();
            await Database.KeyDeleteAsync(redisKeys);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis DEL failed for keys {Keys}", string.Join(", ", keys));
        }
    }

    public async Task<long> GetTtlSecondsAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var ttl = await Database.KeyTimeToLiveAsync(key);
            return ttl.HasValue ? (long)ttl.Value.TotalSeconds : -1;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis TTL failed for key {Key}", key);
            return -1;
        }
    }

    public async Task<(long Count, long TtlSeconds)> IncrementWithTtlAsync(string key, TimeSpan expiry, CancellationToken ct = default)
    {
        try
        {
            var count = await Database.StringIncrementAsync(key);
            if (count == 1)
            {
                await Database.KeyExpireAsync(key, expiry);
            }
            var ttl = await Database.KeyTimeToLiveAsync(key);
            return (count, ttl.HasValue ? (long)ttl.Value.TotalSeconds : (long)expiry.TotalSeconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis INCR failed for key {Key}", key);
            return (1, (long)expiry.TotalSeconds);
        }
    }

    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken ct = default)
    {
        try
        {
            return await Database.StringSetAsync(key, value, expiry, When.NotExists);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis SET NX failed for key {Key}", key);
            return false;
        }
    }
}
