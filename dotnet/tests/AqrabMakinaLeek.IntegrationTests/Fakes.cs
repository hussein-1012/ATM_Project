using System.Collections.Concurrent;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;
using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.IntegrationTests;

public class FakeAtmRepository : IAtmRepository
{
    private readonly ConcurrentDictionary<string, Atm> _atms = new();

    public FakeAtmRepository()
    {
        // Seed default ATM for Fayoum
        var defaultAtm = new Atm
        {
            Id = "60c72b2f9b1d8b001c8e4d1a",
            Name = "البنك الأهلي المصري - فرع الفيوم",
            Bank = AtmBank.NBE,
            Address = "شارع الجمهورية، الفيوم",
            Location = new GeoPoint(30.8428, 29.3084),
            Is24h = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _atms[defaultAtm.Id] = defaultAtm;
    }

    public Task<Atm?> GetByIdAsync(string id, (double Lat, double Lng)? refLocation = null, CancellationToken ct = default)
    {
        _atms.TryGetValue(id, out var atm);
        return Task.FromResult(atm);
    }

    public Task<AtmWithDistance?> GetByIdWithDistanceAsync(string id, double refLat, double refLng, CancellationToken ct = default)
    {
        if (_atms.TryGetValue(id, out var atm))
        {
            var dist = GeoUtil.HaversineMeters(refLat, refLng, atm.Location.Coordinates[1], atm.Location.Coordinates[0]);
            return Task.FromResult<AtmWithDistance?>(new AtmWithDistance(atm, dist));
        }
        return Task.FromResult<AtmWithDistance?>(null);
    }

    public Task<bool> ExistsAsync(string id, CancellationToken ct = default)
    {
        return Task.FromResult(_atms.ContainsKey(id));
    }

    public Task<IReadOnlyList<AtmWithDistance>> GetNearbyAsync(NearbyFilterParams parameters, CancellationToken ct = default)
    {
        var list = new List<AtmWithDistance>();

        foreach (var atm in _atms.Values)
        {
            var dist = GeoUtil.HaversineMeters(parameters.Lat, parameters.Lng, atm.Location.Coordinates[1], atm.Location.Coordinates[0]);
            if (dist <= parameters.RadiusMeters)
            {
                list.Add(new AtmWithDistance(atm, dist));
            }
        }

        list.Sort((a, b) => (a.DistanceMeters ?? 0).CompareTo(b.DistanceMeters ?? 0));
        var result = list.Take(parameters.Limit).ToList();
        return Task.FromResult<IReadOnlyList<AtmWithDistance>>(result);
    }

    public Task<IReadOnlyList<AtmWithDistance>> SearchRowsAsync(AtmSearchParams parameters, CancellationToken ct = default)
    {
        var query = parameters.Filters.Query ?? "";
        var normQuery = ArabicNormalizeUtil.NormalizeArabic(query).ToLowerInvariant();
        var queryTokens = normQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var list = new List<AtmWithDistance>();

        foreach (var atm in _atms.Values)
        {
            if (parameters.Filters.Bank.HasValue && atm.Bank != parameters.Filters.Bank.Value)
                continue;

            if (queryTokens.Length > 0)
            {
                var normName = ArabicNormalizeUtil.NormalizeArabic(atm.Name).ToLowerInvariant();
                var normAddress = ArabicNormalizeUtil.NormalizeArabic(atm.Address).ToLowerInvariant();

                if (!queryTokens.All(t => normName.Contains(t) || normAddress.Contains(t)))
                    continue;
            }

            double? dist = null;
            if (parameters.Filters.Lat.HasValue && parameters.Filters.Lng.HasValue)
            {
                dist = GeoUtil.HaversineMeters(parameters.Filters.Lat.Value, parameters.Filters.Lng.Value, atm.Location.Coordinates[1], atm.Location.Coordinates[0]);
            }

            list.Add(new AtmWithDistance(atm, dist));
        }

        var result = list.Skip(parameters.Offset).Take(parameters.Limit).ToList();
        return Task.FromResult<IReadOnlyList<AtmWithDistance>>(result);
    }

    public Task<long> SearchCountAsync(AtmSearchFilters filters, CancellationToken ct = default)
    {
        var query = filters.Query ?? "";
        var normQuery = ArabicNormalizeUtil.NormalizeArabic(query).ToLowerInvariant();
        var queryTokens = normQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        long count = 0;
        foreach (var atm in _atms.Values)
        {
            if (filters.Bank.HasValue && atm.Bank != filters.Bank.Value)
                continue;

            if (queryTokens.Length > 0)
            {
                var normName = ArabicNormalizeUtil.NormalizeArabic(atm.Name).ToLowerInvariant();
                var normAddress = ArabicNormalizeUtil.NormalizeArabic(atm.Address).ToLowerInvariant();

                if (!queryTokens.All(t => normName.Contains(t) || normAddress.Contains(t)))
                    continue;
            }

            count++;
        }
        return Task.FromResult(count);
    }

    public Task<IReadOnlyList<AtmWithDistance>> FindManyByIdsAsync(IEnumerable<string> ids, (double Lat, double Lng)? refLocation = null, CancellationToken ct = default)
    {
        var idSet = ids.ToHashSet();
        var list = new List<AtmWithDistance>();

        foreach (var atm in _atms.Values.Where(a => idSet.Contains(a.Id)))
        {
            double? dist = null;
            if (refLocation.HasValue)
            {
                dist = GeoUtil.HaversineMeters(refLocation.Value.Lat, refLocation.Value.Lng, atm.Location.Coordinates[1], atm.Location.Coordinates[0]);
            }
            list.Add(new AtmWithDistance(atm, dist));
        }

        return Task.FromResult<IReadOnlyList<AtmWithDistance>>(list);
    }

    public Task<Atm?> GetBySourceAsync(string source, string sourceId, CancellationToken ct = default)
    {
        var atm = _atms.Values.FirstOrDefault(a => a.Source == source && a.SourceId == sourceId);
        return Task.FromResult(atm);
    }

    public Task InsertAsync(Atm atm, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(atm.Id))
            atm.Id = Guid.NewGuid().ToString("N")[..24];
        _atms[atm.Id] = atm;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Atm atm, CancellationToken ct = default)
    {
        _atms[atm.Id] = atm;
        return Task.CompletedTask;
    }

    public Task UpsertManyAsync(IEnumerable<Atm> atms, CancellationToken ct = default)
    {
        foreach (var atm in atms)
        {
            if (string.IsNullOrEmpty(atm.Id))
                atm.Id = Guid.NewGuid().ToString("N")[..24];
            _atms[atm.Id] = atm;
        }
        return Task.CompletedTask;
    }

    public Task<long> CountAsync(CancellationToken ct = default)
    {
        return Task.FromResult((long)_atms.Count);
    }
}

public class FakeUserRepository : IUserRepository
{
    private readonly ConcurrentDictionary<string, User> _usersById = new();
    private readonly ConcurrentDictionary<string, string> _idByEmail = new(StringComparer.OrdinalIgnoreCase);

    public Task<User?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        _usersById.TryGetValue(id, out var user);
        return Task.FromResult(user);
    }

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        if (_idByEmail.TryGetValue(email, out var id) && _usersById.TryGetValue(id, out var user))
        {
            return Task.FromResult<User?>(user);
        }
        return Task.FromResult<User?>(null);
    }

    public Task InsertAsync(User user, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(user.Id))
            user.Id = Guid.NewGuid().ToString("N")[..24];

        _usersById[user.Id] = user;
        _idByEmail[user.Email] = user.Id;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(User user, CancellationToken ct = default)
    {
        _usersById[user.Id] = user;
        _idByEmail[user.Email] = user.Id;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken ct = default)
    {
        if (_usersById.TryRemove(id, out var user))
        {
            _idByEmail.TryRemove(user.Email, out _);
        }
        return Task.CompletedTask;
    }
}

public class FakeRefreshTokenRepository : IRefreshTokenRepository
{
    private readonly ConcurrentDictionary<string, RefreshToken> _tokens = new();

    public Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default)
    {
        _tokens.TryGetValue(tokenHash, out var token);
        return Task.FromResult(token);
    }

    public Task InsertAsync(RefreshToken token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token.Id))
            token.Id = Guid.NewGuid().ToString("N")[..24];

        _tokens[token.TokenHash] = token;
        return Task.CompletedTask;
    }

    public Task RevokeByIdAsync(string id, CancellationToken ct = default)
    {
        var token = _tokens.Values.FirstOrDefault(t => t.Id == id);
        if (token != null)
        {
            token.RevokedAt = DateTime.UtcNow;
        }
        return Task.CompletedTask;
    }

    public Task RevokeFamilyAsync(string familyId, CancellationToken ct = default)
    {
        foreach (var t in _tokens.Values.Where(x => x.FamilyId == familyId))
        {
            t.RevokedAt = DateTime.UtcNow;
        }
        return Task.CompletedTask;
    }

    public Task RevokeAllUserTokensAsync(string userId, CancellationToken ct = default)
    {
        foreach (var t in _tokens.Values.Where(x => x.UserId == userId))
        {
            t.RevokedAt = DateTime.UtcNow;
        }
        return Task.CompletedTask;
    }
}

public class FakeAtmReportRepository : IAtmReportRepository
{
    private readonly List<AtmReport> _reports = new();
    private readonly object _lock = new();

    public Task<IReadOnlyList<AtmReport>> GetReportsForAtmAsync(string atmId, DateTime sinceUtc, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var list = _reports.Where(r => r.AtmId == atmId && r.CreatedAt >= sinceUtc).ToList();
            return Task.FromResult<IReadOnlyList<AtmReport>>(list);
        }
    }

    public Task<AtmReport?> GetLatestReportForAtmAsync(string atmId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var report = _reports.Where(r => r.AtmId == atmId).OrderByDescending(r => r.CreatedAt).FirstOrDefault();
            return Task.FromResult(report);
        }
    }

    public Task<AtmReport?> GetLatestUserReportAsync(string atmId, string userId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var report = _reports.Where(r => r.AtmId == atmId && r.UserId == userId).OrderByDescending(r => r.CreatedAt).FirstOrDefault();
            return Task.FromResult(report);
        }
    }

    public Task<IReadOnlyList<AtmReport>> GetReportsListAsync(string atmId, int limit, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var list = _reports.Where(r => r.AtmId == atmId).OrderByDescending(r => r.CreatedAt).Take(limit).ToList();
            return Task.FromResult<IReadOnlyList<AtmReport>>(list);
        }
    }

    public Task InsertAsync(AtmReport report, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (string.IsNullOrEmpty(report.Id))
                report.Id = Guid.NewGuid().ToString("N")[..24];
            _reports.Add(report);
        }
        return Task.CompletedTask;
    }
}

public class FakeFavoriteRepository : IFavoriteRepository
{
    private readonly List<Favorite> _favorites = new();
    private readonly object _lock = new();

    public Task<Favorite?> FindAsync(string userId, string atmId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var fav = _favorites.FirstOrDefault(f => f.UserId == userId && f.AtmId == atmId);
            return Task.FromResult(fav);
        }
    }

    public Task<IReadOnlyList<Favorite>> GetUserFavoritesAsync(string userId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var list = _favorites.Where(f => f.UserId == userId).ToList();
            return Task.FromResult<IReadOnlyList<Favorite>>(list);
        }
    }

    public Task<Favorite> InsertAsync(Favorite favorite, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (string.IsNullOrEmpty(favorite.Id))
                favorite.Id = Guid.NewGuid().ToString("N")[..24];
            _favorites.Add(favorite);
            return Task.FromResult(favorite);
        }
    }

    public Task<bool> DeleteAsync(string userId, string atmId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            int removed = _favorites.RemoveAll(f => f.UserId == userId && f.AtmId == atmId);
            return Task.FromResult(removed > 0);
        }
    }

    public Task DeleteByAtmIdAsync(string atmId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _favorites.RemoveAll(f => f.AtmId == atmId);
        }
        return Task.CompletedTask;
    }
}

public class FakeRecentSearchRepository : IRecentSearchRepository
{
    private readonly List<RecentSearch> _searches = new();
    private readonly object _lock = new();

    public Task<IReadOnlyList<RecentSearch>> GetUserSearchesAsync(string userId, int limit = 10, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var list = _searches
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .Take(limit)
                .ToList();
            return Task.FromResult<IReadOnlyList<RecentSearch>>(list);
        }
    }

    public Task<RecentSearch> AddAsync(string userId, string query, int keepCount = 10, CancellationToken ct = default)
    {
        lock (_lock)
        {
            var item = new RecentSearch
            {
                Id = Guid.NewGuid().ToString("N")[..24],
                UserId = userId,
                Query = query,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _searches.Add(item);
            return Task.FromResult(item);
        }
    }

    public Task ClearUserSearchesAsync(string userId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _searches.RemoveAll(s => s.UserId == userId);
        }
        return Task.CompletedTask;
    }
}
