using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IAtmRepository
{
    Task<Atm?> GetByIdAsync(string id, (double Lat, double Lng)? refLocation = null, CancellationToken ct = default);
    Task<AtmWithDistance?> GetByIdWithDistanceAsync(string id, double refLat, double refLng, CancellationToken ct = default);
    Task<bool> ExistsAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<AtmWithDistance>> GetNearbyAsync(NearbyFilterParams parameters, CancellationToken ct = default);
    Task<IReadOnlyList<AtmWithDistance>> SearchRowsAsync(AtmSearchParams parameters, CancellationToken ct = default);
    Task<long> SearchCountAsync(AtmSearchFilters filters, CancellationToken ct = default);
    Task<IReadOnlyList<AtmWithDistance>> FindManyByIdsAsync(IEnumerable<string> ids, (double Lat, double Lng)? refLocation = null, CancellationToken ct = default);
    Task<Atm?> GetBySourceAsync(string source, string sourceId, CancellationToken ct = default);
    Task InsertAsync(Atm atm, CancellationToken ct = default);
    Task UpdateAsync(Atm atm, CancellationToken ct = default);
    Task UpsertManyAsync(IEnumerable<Atm> atms, CancellationToken ct = default);
    Task<long> CountAsync(CancellationToken ct = default);
}
