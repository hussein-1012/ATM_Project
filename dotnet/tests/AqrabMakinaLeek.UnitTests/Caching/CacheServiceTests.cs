using AqrabMakinaLeek.Infrastructure.Caching;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Caching;

public class CacheServiceTests
{
    [Fact]
    public async Task GetAsync_ReturnsNull_WhenKeyDoesNotExist()
    {
        var cache = new InMemoryCacheService();
        var result = await cache.GetAsync("non-existent");
        result.Should().BeNull();
    }

    [Fact]
    public async Task SetAndGetAsync_StoresAndRetrievesValue()
    {
        var cache = new InMemoryCacheService();
        await cache.SetAsync("user:123", "data", TimeSpan.FromMinutes(5));

        var result = await cache.GetAsync("user:123");
        result.Should().Be("data");
    }

    [Fact]
    public async Task GetAsync_ReturnsNull_WhenEntryExpired()
    {
        var cache = new InMemoryCacheService();
        await cache.SetAsync("temp", "val", TimeSpan.FromMilliseconds(50));

        await Task.Delay(100);

        var result = await cache.GetAsync("temp");
        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_RemovesKey()
    {
        var cache = new InMemoryCacheService();
        await cache.SetAsync("key1", "val1");
        await cache.DeleteAsync(CancellationToken.None, "key1");

        var result = await cache.GetAsync("key1");
        result.Should().BeNull();
    }

    [Fact]
    public async Task IncrementWithTtlAsync_IncrementsCounterCorrectly()
    {
        var cache = new InMemoryCacheService();
        var (count1, ttl1) = await cache.IncrementWithTtlAsync("counter", TimeSpan.FromMinutes(1));
        count1.Should().Be(1);
        ttl1.Should().BeGreaterThan(0);

        var (count2, _) = await cache.IncrementWithTtlAsync("counter", TimeSpan.FromMinutes(1));
        count2.Should().Be(2);
    }

    [Fact]
    public async Task SetIfNotExistsAsync_SetsOnlyWhenKeyNotPresent()
    {
        var cache = new InMemoryCacheService();
        var first = await cache.SetIfNotExistsAsync("lock", "locked", TimeSpan.FromMinutes(1));
        var second = await cache.SetIfNotExistsAsync("lock", "locked-again", TimeSpan.FromMinutes(1));

        first.Should().BeTrue();
        second.Should().BeFalse();

        var value = await cache.GetAsync("lock");
        value.Should().Be("locked");
    }
}
