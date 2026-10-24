namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface ICacheService
{
    Task<string?> GetAsync(string key, CancellationToken ct = default);
    Task SetAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default);
    Task DeleteAsync(CancellationToken ct = default, params string[] keys);
    Task<long> GetTtlSecondsAsync(string key, CancellationToken ct = default);
    Task<(long Count, long TtlSeconds)> IncrementWithTtlAsync(string key, TimeSpan expiry, CancellationToken ct = default);
    Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken ct = default);
}
