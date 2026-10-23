using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Services;

public class AccountService
{
    private readonly IUserRepository _userRepo;
    private readonly RefreshTokenService _refreshTokens;
    private readonly IPasswordHasher _hasher;

    public AccountService(
        IUserRepository userRepo,
        RefreshTokenService refreshTokens,
        IPasswordHasher hasher)
    {
        _userRepo = userRepo;
        _refreshTokens = refreshTokens;
        _hasher = hasher;
    }

    public async Task<UserResponseDto> GetProfileAsync(string userId, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new NotFoundException("User not found", "USER_NOT_FOUND");
        }

        return AuthService.MapToUserDto(user);
    }

    public async Task<UserResponseDto> UpdateProfileAsync(string userId, UpdateProfileDto dto, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new NotFoundException("User not found", "USER_NOT_FOUND");
        }

        if (!string.IsNullOrWhiteSpace(dto.Name))
        {
            user.Name = dto.Name.Trim();
        }

        if (dto.PreferredTravelMode.HasValue)
        {
            user.PreferredTravelMode = dto.PreferredTravelMode.Value;
        }

        if (dto.VoiceGuidance.HasValue)
        {
            user.VoiceGuidance = dto.VoiceGuidance.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.Language))
        {
            user.Language = dto.Language.Trim();
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user, ct);

        return AuthService.MapToUserDto(user);
    }

    public async Task<bool> DeleteAccountAsync(string userId, string password, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new NotFoundException("User not found", "USER_NOT_FOUND");
        }

        if (!_hasher.Verify(user.PasswordHash, password))
        {
            throw new UnauthorizedException("Current password is incorrect", "INVALID_CURRENT_PASSWORD");
        }

        user.DeletedAt = DateTime.UtcNow;
        user.Name = "Deleted user";
        user.Email = $"deleted+{user.Id}@invalid.local";
        user.PasswordHash = _hasher.Hash($"{user.Id}-{DateTime.UtcNow.Ticks}-erased");
        user.VoiceGuidance = false;
        user.Language = "ar";
        user.PreferredTravelMode = TravelMode.Walk;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepo.UpdateAsync(user, ct);
        await _refreshTokens.RevokeAllForUserAsync(user.Id, ct);

        return true;
    }
}
