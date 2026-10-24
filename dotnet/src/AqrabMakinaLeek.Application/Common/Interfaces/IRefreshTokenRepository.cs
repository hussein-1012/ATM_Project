using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task InsertAsync(RefreshToken token, CancellationToken ct = default);
    Task RevokeByIdAsync(string id, CancellationToken ct = default);
    Task RevokeFamilyAsync(string familyId, CancellationToken ct = default);
    Task RevokeAllUserTokensAsync(string userId, CancellationToken ct = default);
}
