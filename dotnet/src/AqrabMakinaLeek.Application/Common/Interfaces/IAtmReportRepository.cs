using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IAtmReportRepository
{
    Task<IReadOnlyList<AtmReport>> GetReportsForAtmAsync(string atmId, DateTime sinceUtc, CancellationToken ct = default);
    Task<AtmReport?> GetLatestReportForAtmAsync(string atmId, CancellationToken ct = default);
    Task<AtmReport?> GetLatestUserReportAsync(string atmId, string userId, CancellationToken ct = default);
    Task<IReadOnlyList<AtmReport>> GetReportsListAsync(string atmId, int limit, CancellationToken ct = default);
    Task InsertAsync(AtmReport report, CancellationToken ct = default);
}
