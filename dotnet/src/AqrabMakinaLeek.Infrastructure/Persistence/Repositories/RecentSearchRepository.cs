using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class RecentSearchRepository : IRecentSearchRepository
{
    private readonly MongoDbContext _context;

    public RecentSearchRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<RecentSearch>> GetUserSearchesAsync(string userId, int limit = 10, CancellationToken ct = default)
    {
        return await _context.RecentSearches
            .Find(s => s.UserId == userId)
            .SortByDescending(s => s.CreatedAt)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public async Task<RecentSearch> AddAsync(string userId, string query, int keepCount = 10, CancellationToken ct = default)
    {
        var trimmed = query.Trim();

        // 1. Delete any existing duplicate query for this user (so new one moves to top)
        var duplicateFilter = Builders<RecentSearch>.Filter.And(
            Builders<RecentSearch>.Filter.Eq(s => s.UserId, userId),
            Builders<RecentSearch>.Filter.Eq(s => s.Query, trimmed)
        );
        await _context.RecentSearches.DeleteManyAsync(duplicateFilter, ct);

        // 2. Insert new search
        var search = new RecentSearch
        {
            UserId = userId,
            Query = trimmed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _context.RecentSearches.InsertOneAsync(search, cancellationToken: ct);

        // 3. Trim to keep only the latest keepCount entries
        var staleDocs = await _context.RecentSearches
            .Find(s => s.UserId == userId)
            .SortByDescending(s => s.CreatedAt)
            .Skip(keepCount)
            .ToListAsync(ct);

        if (staleDocs.Count > 0)
        {
            var staleIds = staleDocs.Select(s => s.Id).ToList();
            var staleFilter = Builders<RecentSearch>.Filter.In(s => s.Id, staleIds);
            await _context.RecentSearches.DeleteManyAsync(staleFilter, ct);
        }

        return search;
    }

    public async Task ClearUserSearchesAsync(string userId, CancellationToken ct = default)
    {
        await _context.RecentSearches.DeleteManyAsync(s => s.UserId == userId, ct);
    }
}
