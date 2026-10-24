using System.Security.Cryptography;
using System.Text;
using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Services;

public class RefreshTokenService
{
    private readonly IRefreshTokenRepository _repo;
    private readonly TimeSpan _ttl = TimeSpan.FromDays(30);

    public RefreshTokenService(IRefreshTokenRepository repo)
    {
        _repo = repo;
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string GenerateRandomToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    public async Task<(string RawToken, RefreshToken Entity)> IssueAsync(
        string userId,
        string? deviceInfo = null,
        string? familyId = null,
        CancellationToken ct = default)
    {
        var token = GenerateRandomToken();
        var entity = new RefreshToken
        {
            UserId = userId,
            TokenHash = HashToken(token),
            FamilyId = familyId ?? Guid.NewGuid().ToString(),
            ExpiresAt = DateTime.UtcNow.Add(_ttl),
            RevokedAt = null,
            DeviceInfo = deviceInfo?.Length > 255 ? deviceInfo[..255] : deviceInfo,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _repo.InsertAsync(entity, ct);
        return (token, entity);
    }

    public async Task<(string NewToken, string UserId)> RotateAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = HashToken(rawToken);
        var found = await _repo.FindByTokenHashAsync(hash, ct);
        if (found is null)
        {
            throw new UnauthorizedException("Invalid refresh token", "INVALID_REFRESH_TOKEN");
        }

        if (found.RevokedAt.HasValue)
        {
            // Token reuse detected - revoke entire chain/family
            await _repo.RevokeFamilyAsync(found.FamilyId, ct);
            throw new UnauthorizedException(
                "Refresh token reuse detected; all sessions in this family were revoked",
                "TOKEN_REUSE_DETECTED");
        }

        if (found.ExpiresAt <= DateTime.UtcNow)
        {
            throw new UnauthorizedException("Refresh token expired", "REFRESH_TOKEN_EXPIRED");
        }

        await _repo.RevokeByIdAsync(found.Id, ct);
        var (newToken, _) = await IssueAsync(found.UserId, found.DeviceInfo, found.FamilyId, ct);
        return (newToken, found.UserId);
    }

    public async Task RevokeAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = HashToken(rawToken);
        var found = await _repo.FindByTokenHashAsync(hash, ct);
        if (found is not null && !found.RevokedAt.HasValue)
        {
            await _repo.RevokeByIdAsync(found.Id, ct);
        }
    }

    public async Task RevokeAllForUserAsync(string userId, CancellationToken ct = default)
    {
        await _repo.RevokeAllUserTokensAsync(userId, ct);
    }
}
