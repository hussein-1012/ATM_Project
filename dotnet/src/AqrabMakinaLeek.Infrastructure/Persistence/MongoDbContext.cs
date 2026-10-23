using AqrabMakinaLeek.Domain.Entities;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IOptions<MongoOptions> options)
    {
        MongoClassMapper.Register();

        var client = new MongoClient(options.Value.ConnectionString);
        _database = client.GetDatabase(options.Value.DatabaseName);
    }

    public MongoDbContext(IMongoDatabase database)
    {
        MongoClassMapper.Register();
        _database = database;
    }

    public IMongoDatabase Database => _database;

    public IMongoCollection<Atm> Atms => _database.GetCollection<Atm>("atms");
    public IMongoCollection<User> Users => _database.GetCollection<User>("users");
    public IMongoCollection<RefreshToken> RefreshTokens => _database.GetCollection<RefreshToken>("refresh_tokens");
    public IMongoCollection<AtmReport> AtmReports => _database.GetCollection<AtmReport>("atm_reports");
    public IMongoCollection<Favorite> Favorites => _database.GetCollection<Favorite>("favorites");
    public IMongoCollection<RecentSearch> RecentSearches => _database.GetCollection<RecentSearch>("recent_searches");

    public async Task InitializeIndicesAsync(CancellationToken ct = default)
    {
        // 1. ATMs
        var atmsBuilder = Builders<Atm>.IndexKeys;
        await Atms.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Atm>(atmsBuilder.Geo2DSphere(a => a.Location), new CreateIndexOptions { Name = "location_2dsphere" }),
                new CreateIndexModel<Atm>(atmsBuilder.Ascending(a => a.Source).Ascending(a => a.SourceId), new CreateIndexOptions { Unique = true, Name = "source_sourceId_unique" }),
                new CreateIndexModel<Atm>(atmsBuilder.Text(a => a.SearchText), new CreateIndexOptions { Name = "searchText_text" })
            ],
            ct);

        // 2. Users
        var usersBuilder = Builders<User>.IndexKeys;
        await Users.Indexes.CreateOneAsync(
            new CreateIndexModel<User>(usersBuilder.Ascending(u => u.Email), new CreateIndexOptions { Unique = true, Name = "email_unique" }),
            cancellationToken: ct);

        // 3. Refresh Tokens
        var refreshTokensBuilder = Builders<RefreshToken>.IndexKeys;
        await RefreshTokens.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<RefreshToken>(refreshTokensBuilder.Ascending(r => r.TokenHash), new CreateIndexOptions { Unique = true, Name = "tokenHash_unique" }),
                new CreateIndexModel<RefreshToken>(refreshTokensBuilder.Ascending(r => r.UserId), new CreateIndexOptions { Name = "userId_idx" }),
                new CreateIndexModel<RefreshToken>(refreshTokensBuilder.Ascending(r => r.FamilyId), new CreateIndexOptions { Name = "familyId_idx" })
            ],
            ct);

        // 4. ATM Reports
        var reportsBuilder = Builders<AtmReport>.IndexKeys;
        await AtmReports.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<AtmReport>(reportsBuilder.Ascending(r => r.AtmId).Descending(r => r.CreatedAt), new CreateIndexOptions { Name = "atmId_createdAt_idx" }),
                new CreateIndexModel<AtmReport>(reportsBuilder.Ascending(r => r.UserId).Ascending(r => r.AtmId).Descending(r => r.CreatedAt), new CreateIndexOptions { Name = "userId_atmId_createdAt_idx" })
            ],
            ct);

        // 5. Favorites
        var favoritesBuilder = Builders<Favorite>.IndexKeys;
        await Favorites.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Favorite>(favoritesBuilder.Ascending(f => f.UserId).Ascending(f => f.AtmId), new CreateIndexOptions { Unique = true, Name = "userId_atmId_unique" }),
                new CreateIndexModel<Favorite>(favoritesBuilder.Ascending(f => f.UserId).Descending(f => f.CreatedAt), new CreateIndexOptions { Name = "userId_createdAt_idx" })
            ],
            ct);

        // 6. Recent Searches
        var searchesBuilder = Builders<RecentSearch>.IndexKeys;
        await RecentSearches.Indexes.CreateOneAsync(
            new CreateIndexModel<RecentSearch>(searchesBuilder.Ascending(s => s.UserId).Descending(s => s.CreatedAt), new CreateIndexOptions { Name = "userId_createdAt_idx" }),
            cancellationToken: ct);
    }
}
