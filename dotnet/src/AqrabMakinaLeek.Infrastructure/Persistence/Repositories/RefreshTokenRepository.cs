using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly MongoDbContext _context;

    public RefreshTokenRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default)
    {
        return await _context.RefreshTokens.Find(r => r.TokenHash == tokenHash).FirstOrDefaultAsync(ct);
    }

    public async Task InsertAsync(RefreshToken token, CancellationToken ct = default)
    {
        token.CreatedAt = DateTime.UtcNow;
        token.UpdatedAt = DateTime.UtcNow;
        await _context.RefreshTokens.InsertOneAsync(token, cancellationToken: ct);
    }

    public async Task RevokeByIdAsync(string id, CancellationToken ct = default)
    {
        var filter = BuildIdFilter(id);
        var update = Builders<RefreshToken>.Update
            .Set(r => r.RevokedAt, DateTime.UtcNow)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _context.RefreshTokens.UpdateOneAsync(filter, update, cancellationToken: ct);
    }

    public async Task RevokeFamilyAsync(string familyId, CancellationToken ct = default)
    {
        var filter = Builders<RefreshToken>.Filter.And(
            Builders<RefreshToken>.Filter.Eq(r => r.FamilyId, familyId),
            Builders<RefreshToken>.Filter.Eq(r => r.RevokedAt, null)
        );

        var update = Builders<RefreshToken>.Update
            .Set(r => r.RevokedAt, DateTime.UtcNow)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _context.RefreshTokens.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task RevokeAllUserTokensAsync(string userId, CancellationToken ct = default)
    {
        var filter = Builders<RefreshToken>.Filter.And(
            Builders<RefreshToken>.Filter.Eq(r => r.UserId, userId),
            Builders<RefreshToken>.Filter.Eq(r => r.RevokedAt, null)
        );

        var update = Builders<RefreshToken>.Update
            .Set(r => r.RevokedAt, DateTime.UtcNow)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _context.RefreshTokens.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    private static FilterDefinition<RefreshToken> BuildIdFilter(string id)
    {
        if (ObjectId.TryParse(id, out var oid))
        {
            return Builders<RefreshToken>.Filter.Eq("_id", oid);
        }
        return Builders<RefreshToken>.Filter.Eq("_id", id);
    }
}
