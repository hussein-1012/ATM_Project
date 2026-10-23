using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IFavoriteRepository
{
    Task<Favorite?> FindAsync(string userId, string atmId, CancellationToken ct = default);
    Task<IReadOnlyList<Favorite>> GetUserFavoritesAsync(string userId, CancellationToken ct = default);
    Task<Favorite> InsertAsync(Favorite favorite, CancellationToken ct = default);
    Task<bool> DeleteAsync(string userId, string atmId, CancellationToken ct = default);
    Task DeleteByAtmIdAsync(string atmId, CancellationToken ct = default);
}
