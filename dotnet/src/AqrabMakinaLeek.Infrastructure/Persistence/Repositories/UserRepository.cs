using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class UserRepository : IUserRepository
{
    private readonly MongoDbContext _context;

    public UserRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var filter = BuildActiveUserFilter(id);
        return await _context.Users.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var filter = Builders<User>.Filter.And(
            Builders<User>.Filter.Eq(u => u.Email, normalizedEmail),
            Builders<User>.Filter.Eq(u => u.DeletedAt, null)
        );

        return await _context.Users.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task InsertAsync(User user, CancellationToken ct = default)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.Users.InsertOneAsync(user, cancellationToken: ct);
    }

    public async Task UpdateAsync(User user, CancellationToken ct = default)
    {
        user.UpdatedAt = DateTime.UtcNow;
        var filter = BuildIdFilter(user.Id);
        await _context.Users.ReplaceOneAsync(filter, user, cancellationToken: ct);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var filter = BuildIdFilter(id);
        await _context.Users.DeleteOneAsync(filter, ct);
    }

    private static FilterDefinition<User> BuildIdFilter(string id)
    {
        if (ObjectId.TryParse(id, out var oid))
        {
            return Builders<User>.Filter.Eq("_id", oid);
        }
        return Builders<User>.Filter.Eq("_id", id);
    }

    private static FilterDefinition<User> BuildActiveUserFilter(string id)
    {
        var idFilter = BuildIdFilter(id);
        var notDeleted = Builders<User>.Filter.Eq(u => u.DeletedAt, null);
        return Builders<User>.Filter.And(idFilter, notDeleted);
    }
}
