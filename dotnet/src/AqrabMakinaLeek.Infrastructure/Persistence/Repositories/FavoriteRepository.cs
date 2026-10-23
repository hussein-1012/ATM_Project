using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class FavoriteRepository : IFavoriteRepository
{
    private readonly MongoDbContext _context;

    public FavoriteRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<Favorite?> FindAsync(string userId, string atmId, CancellationToken ct = default)
    {
        var filter = Builders<Favorite>.Filter.And(
            Builders<Favorite>.Filter.Eq(f => f.UserId, userId),
            Builders<Favorite>.Filter.Eq(f => f.AtmId, atmId)
        );

        return await _context.Favorites.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<Favorite>> GetUserFavoritesAsync(string userId, CancellationToken ct = default)
    {
        return await _context.Favorites
            .Find(f => f.UserId == userId)
            .SortByDescending(f => f.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<Favorite> InsertAsync(Favorite favorite, CancellationToken ct = default)
    {
        favorite.CreatedAt = DateTime.UtcNow;
        favorite.UpdatedAt = DateTime.UtcNow;
        await _context.Favorites.InsertOneAsync(favorite, cancellationToken: ct);
        return favorite;
    }

    public async Task<bool> DeleteAsync(string userId, string atmId, CancellationToken ct = default)
    {
        var filter = Builders<Favorite>.Filter.And(
            Builders<Favorite>.Filter.Eq(f => f.UserId, userId),
            Builders<Favorite>.Filter.Eq(f => f.AtmId, atmId)
        );

        var result = await _context.Favorites.DeleteOneAsync(filter, ct);
        return result.DeletedCount > 0;
    }

    public async Task DeleteByAtmIdAsync(string atmId, CancellationToken ct = default)
    {
        await _context.Favorites.DeleteManyAsync(f => f.AtmId == atmId, ct);
    }
}
