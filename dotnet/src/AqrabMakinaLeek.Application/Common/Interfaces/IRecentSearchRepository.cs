using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IRecentSearchRepository
{
    Task<IReadOnlyList<RecentSearch>> GetUserSearchesAsync(string userId, int limit = 10, CancellationToken ct = default);
    Task<RecentSearch> AddAsync(string userId, string query, int keepCount = 10, CancellationToken ct = default);
    Task ClearUserSearchesAsync(string userId, CancellationToken ct = default);
}
