using System.Collections.Concurrent;
using AqrabMakinaLeek.Application.Common.Interfaces;

namespace AqrabMakinaLeek.Infrastructure.Caching;

public class InMemoryCacheService : ICacheService
{
    private class CacheEntry
    {
        public string Value { get; set; } = string.Empty;
        public DateTime? ExpiresAt { get; set; }
    }

    private readonly ConcurrentDictionary<string, CacheEntry> _store = new();

    public Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        if (_store.TryGetValue(key, out var entry))
        {
            if (entry.ExpiresAt.HasValue && entry.ExpiresAt.Value <= DateTime.UtcNow)
            {
                _store.TryRemove(key, out _);
                return Task.FromResult<string?>(null);
            }
            return Task.FromResult<string?>(entry.Value);
        }
        return Task.FromResult<string?>(null);
    }

    public Task SetAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var expiresAt = expiry.HasValue ? DateTime.UtcNow.Add(expiry.Value) : (DateTime?)null;
        _store[key] = new CacheEntry { Value = value, ExpiresAt = expiresAt };
        return Task.CompletedTask;
    }

    public Task DeleteAsync(CancellationToken ct = default, params string[] keys)
    {
        foreach (var key in keys)
        {
            _store.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }

    public Task<long> GetTtlSecondsAsync(string key, CancellationToken ct = default)
    {
        if (_store.TryGetValue(key, out var entry))
        {
            if (!entry.ExpiresAt.HasValue) return Task.FromResult(-1L);
            var remaining = (entry.ExpiresAt.Value - DateTime.UtcNow).TotalSeconds;
            if (remaining <= 0)
            {
                _store.TryRemove(key, out _);
                return Task.FromResult(-1L);
            }
            return Task.FromResult((long)remaining);
        }
        return Task.FromResult(-1L);
    }

    public Task<(long Count, long TtlSeconds)> IncrementWithTtlAsync(string key, TimeSpan expiry, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entry = _store.AddOrUpdate(
            key,
            _ => new CacheEntry { Value = "1", ExpiresAt = now.Add(expiry) },
            (_, existing) =>
            {
                if (existing.ExpiresAt.HasValue && existing.ExpiresAt.Value <= now)
                {
                    return new CacheEntry { Value = "1", ExpiresAt = now.Add(expiry) };
                }

                if (long.TryParse(existing.Value, out var current))
                {
                    existing.Value = (current + 1).ToString();
                }
                else
                {
                    existing.Value = "1";
                }
                return existing;
            });

        var count = long.Parse(entry.Value);
        var ttl = entry.ExpiresAt.HasValue ? (long)(entry.ExpiresAt.Value - now).TotalSeconds : (long)expiry.TotalSeconds;
        return Task.FromResult((count, Math.Max(0, ttl)));
    }

    public Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan expiry, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var newEntry = new CacheEntry { Value = value, ExpiresAt = now.Add(expiry) };

        if (_store.TryGetValue(key, out var existing))
        {
            if (existing.ExpiresAt.HasValue && existing.ExpiresAt.Value <= now)
            {
                _store[key] = newEntry;
                return Task.FromResult(true);
            }
            return Task.FromResult(false);
        }

        var added = _store.TryAdd(key, newEntry);
        return Task.FromResult(added);
    }
}
