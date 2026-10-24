using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using MongoDB.Driver;

namespace AqrabMakinaLeek.Infrastructure.Persistence.Repositories;

public class AtmReportRepository : IAtmReportRepository
{
    private readonly MongoDbContext _context;

    public AtmReportRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<AtmReport>> GetReportsForAtmAsync(string atmId, DateTime sinceUtc, CancellationToken ct = default)
    {
        var filter = Builders<AtmReport>.Filter.And(
            Builders<AtmReport>.Filter.Eq(r => r.AtmId, atmId),
            Builders<AtmReport>.Filter.Gte(r => r.CreatedAt, sinceUtc)
        );

        return await _context.AtmReports
            .Find(filter)
            .SortByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<AtmReport?> GetLatestReportForAtmAsync(string atmId, CancellationToken ct = default)
    {
        return await _context.AtmReports
            .Find(r => r.AtmId == atmId)
            .SortByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<AtmReport?> GetLatestUserReportAsync(string atmId, string userId, CancellationToken ct = default)
    {
        var filter = Builders<AtmReport>.Filter.And(
            Builders<AtmReport>.Filter.Eq(r => r.AtmId, atmId),
            Builders<AtmReport>.Filter.Eq(r => r.UserId, userId)
        );

        return await _context.AtmReports
            .Find(filter)
            .SortByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<AtmReport>> GetReportsListAsync(string atmId, int limit, CancellationToken ct = default)
    {
        return await _context.AtmReports
            .Find(r => r.AtmId == atmId)
            .SortByDescending(r => r.CreatedAt)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public async Task InsertAsync(AtmReport report, CancellationToken ct = default)
    {
        report.CreatedAt = DateTime.UtcNow;
        report.UpdatedAt = DateTime.UtcNow;
        await _context.AtmReports.InsertOneAsync(report, cancellationToken: ct);
    }
}
