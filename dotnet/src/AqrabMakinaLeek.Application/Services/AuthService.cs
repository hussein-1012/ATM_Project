using System.Security.Claims;
using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Services;

public class AuthService
{
    private readonly IUserRepository _userRepo;
    private readonly RefreshTokenService _refreshTokens;
    private readonly OtpService _otp;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenGenerator _jwtGenerator;
    private readonly IEmailService _mailService;

    public AuthService(
        IUserRepository userRepo,
        RefreshTokenService refreshTokens,
        OtpService otp,
        IPasswordHasher hasher,
        IJwtTokenGenerator jwtGenerator,
        IEmailService mailService)
    {
        _userRepo = userRepo;
        _refreshTokens = refreshTokens;
        _otp = otp;
        _hasher = hasher;
        _jwtGenerator = jwtGenerator;
        _mailService = mailService;
    }

    public async Task<UserResponseDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var existing = await _userRepo.GetByEmailAsync(request.Email, ct);
        if (existing is not null)
        {
            throw new ConflictException("Email is already registered", "EMAIL_TAKEN");
        }

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = _hasher.Hash(request.Password),
            PreferredTravelMode = TravelMode.Walk,
            VoiceGuidance = true,
            Language = "ar",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _userRepo.InsertAsync(user, ct);
        return MapToUserDto(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null || !_hasher.Verify(user.PasswordHash, request.Password))
        {
            throw new UnauthorizedException("Invalid email or password", "INVALID_CREDENTIALS");
        }

        return await IssueSessionAsync(user, request.DeviceInfo, ct);
    }

    public async Task<AuthResponseDto> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var (newToken, userId) = await _refreshTokens.RotateAsync(refreshToken, ct);
        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new UnauthorizedException("User not found", "UNAUTHORIZED");
        }

        var accessToken = _jwtGenerator.GenerateAccessToken(user.Id, user.Email);
        return new AuthResponseDto(accessToken, newToken, MapToUserDto(user));
    }

    public async Task<bool> LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        await _refreshTokens.RevokeAsync(refreshToken, ct);
        return true;
    }

    public async Task<bool> ForgotPasswordAsync(string email, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByEmailAsync(email, ct);
        if (user is null)
        {
            return true; // Silent response to prevent account enumeration
        }

        var (sent, code) = await _otp.RequestAsync(user.Email, ct);
        if (sent && code is not null)
        {
            var html = $@"
              <div style=""font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;"">
                <h2 style=""color: #0f172a; text-align: center; margin-bottom: 8px;"">Aqrab Makina Leek</h2>
                <p style=""text-align: center; color: #64748b; margin-top: 0;"">أقرب ماكينة ليك — إعادة تعيين كلمة المرور</p>
                <p style=""color: #334155; font-size: 15px;"">Hello <strong>{user.Name}</strong>,</p>
                <p style=""color: #334155; font-size: 15px;"">You requested a password reset. Use the following 6-digit verification code to complete the process:</p>
                <div style=""background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0284c7; margin: 24px 0;"">
                  {code}
                </div>
                <p style=""color: #64748b; font-size: 14px;"">This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
                <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"" />
                <p style=""color: #94a3b8; font-size: 12px; margin: 0;"">If you did not request a password reset, you can safely ignore this email.</p>
              </div>";

            await _mailService.SendAsync(
                new EmailMessage(
                    user.Email,
                    "Aqrab Makina Leek — Password Reset Code",
                    $"Your password reset code is {code}. It expires in 10 minutes. If you did not request this, please ignore this message.",
                    html),
                ct);
        }

        return true;
    }

    public async Task<string> VerifyOtpAsync(string email, string code, CancellationToken ct = default)
    {
        await _otp.VerifyAsync(email, code, ct);
        var user = await _userRepo.GetByEmailAsync(email, ct);
        if (user is null)
        {
            throw new UnauthorizedException("Invalid or expired OTP", "OTP_INVALID");
        }

        return _jwtGenerator.GenerateResetToken(user.Id, user.Email);
    }

    public async Task<bool> ResetPasswordAsync(string resetToken, string newPassword, CancellationToken ct = default)
    {
        var principal = _jwtGenerator.ValidateToken(resetToken, "reset");
        if (principal is null)
        {
            throw new UnauthorizedException("Invalid or expired reset token", "INVALID_RESET_TOKEN");
        }

        var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedException("Invalid or expired reset token", "INVALID_RESET_TOKEN");
        }

        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new UnauthorizedException("Invalid or expired reset token", "INVALID_RESET_TOKEN");
        }

        user.PasswordHash = _hasher.Hash(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user, ct);

        await _refreshTokens.RevokeAllForUserAsync(user.Id, ct);
        return true;
    }

    public async Task<bool> ChangePasswordAsync(
        string userId,
        string currentPassword,
        string newPassword,
        CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(userId, ct);
        if (user is null)
        {
            throw new NotFoundException("User not found", "USER_NOT_FOUND");
        }

        if (!_hasher.Verify(user.PasswordHash, currentPassword))
        {
            throw new UnauthorizedException("Current password is incorrect", "INVALID_CURRENT_PASSWORD");
        }

        user.PasswordHash = _hasher.Hash(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user, ct);

        await _refreshTokens.RevokeAllForUserAsync(user.Id, ct);
        return true;
    }

    private async Task<AuthResponseDto> IssueSessionAsync(User user, string? deviceInfo, CancellationToken ct)
    {
        var (refreshToken, _) = await _refreshTokens.IssueAsync(user.Id, deviceInfo, ct: ct);
        var accessToken = _jwtGenerator.GenerateAccessToken(user.Id, user.Email);
        return new AuthResponseDto(accessToken, refreshToken, MapToUserDto(user));
    }

    public static UserResponseDto MapToUserDto(User user)
    {
        return new UserResponseDto(
            user.Id,
            user.Name,
            user.Email,
            user.PreferredTravelMode,
            user.VoiceGuidance,
            user.Language,
            user.CreatedAt);
    }
}
