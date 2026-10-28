using System.Security.Claims;
using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace AqrabMakinaLeek.Application.Services;

public class AuthService
{
    private readonly IUserRepository _userRepo;
    private readonly RefreshTokenService _refreshTokens;
    private readonly OtpService _otp;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenGenerator _jwtGenerator;
    private readonly IEmailService _mailService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepo,
        RefreshTokenService refreshTokens,
        OtpService otp,
        IPasswordHasher hasher,
        IJwtTokenGenerator jwtGenerator,
        IEmailService mailService,
        ILogger<AuthService> logger)
    {
        _userRepo = userRepo;
        _refreshTokens = refreshTokens;
        _otp = otp;
        _hasher = hasher;
        _jwtGenerator = jwtGenerator;
        _mailService = mailService;
        _logger = logger;
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
            var html = $@"<!DOCTYPE html>
<html lang='ar' dir='ltr'>
<head>
  <meta charset='UTF-8' />
  <meta name='viewport' content='width=device-width, initial-scale=1.0' />
  <title>Aqrab Makina Leek — Password Reset Code</title>
</head>
<body style='margin:0;padding:0;background-color:#0f172a;font-family:Segoe UI,Arial,sans-serif;'>
  <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='background:#0f172a;padding:40px 16px;'>
    <tr>
      <td align='center'>
        <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='max-width:560px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;'>
          <tr>
            <td style='background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:32px 40px;text-align:center;'>
              <p style='margin:0;font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase;'>أقرب ماكينة ليك</p>
              <h1 style='margin:8px 0 0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;'>Aqrab Makina Leek</h1>
            </td>
          </tr>
          <tr>
            <td style='padding:36px 40px 28px;'>
              <p style='margin:0 0 8px;font-size:15px;color:#94a3b8;'>Hello {user.Name},</p>
              <h2 style='margin:0 0 20px;font-size:20px;font-weight:700;color:#f1f5f9;'>Your Password Reset Code</h2>
              <p style='margin:0 0 28px;font-size:15px;line-height:1.6;color:#94a3b8;'>
                We received a request to reset the password for <strong style='color:#e2e8f0;'>{user.Email}</strong>.
                Use the 6-digit code below to complete the process.
              </p>
              <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='margin-bottom:28px;'>
                <tr>
                  <td align='center' style='background:#0f172a;border:2px dashed #0ea5e9;border-radius:12px;padding:24px 16px;'>
                    <p style='margin:0 0 8px;font-size:12px;color:#64748b;letter-spacing:1px;text-transform:uppercase;'>Verification Code</p>
                    <p style='margin:0;font-size:42px;font-weight:900;letter-spacing:14px;color:#38bdf8;font-family:Courier New,monospace;'>{code}</p>
                  </td>
                </tr>
              </table>
              <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='margin-bottom:28px;'>
                <tr>
                  <td style='background:#1c2a3a;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;'>
                    <p style='margin:0;font-size:14px;color:#fbbf24;'>&#9201; This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
                  </td>
                </tr>
              </table>
              <p style='margin:0;font-size:14px;line-height:1.6;color:#64748b;'>
                If you did not request a password reset, you can safely ignore this email.
                Your account remains secure and no changes have been made.
              </p>
            </td>
          </tr>
          <tr>
            <td style='background:#0f172a;padding:20px 40px;border-top:1px solid #1e293b;'>
              <p style='margin:0;font-size:12px;color:#475569;text-align:center;'>&#169; 2026 Aqrab Makina Leek &#8212; &#1571;&#1602;&#1585;&#1576; &#1605;&#1575;&#1603;&#1610;&#1606;&#1577; &#1604;&#1610;&#1603; | Fayoum, Egypt</p>
              <p style='margin:6px 0 0;font-size:11px;color:#334155;text-align:center;'>This is an automated security email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

            try
            {
                await _mailService.SendAsync(
                    new EmailMessage(
                        user.Email,
                        "Aqrab Makina Leek — Your Password Reset Code",
                        $"Your Aqrab Makina Leek password reset code expires in 10 minutes. If you did not request this, please ignore this message.",
                        html),
                    ct);
            }
            catch (Exception ex)
            {
                // Email delivery failure is non-fatal. OTP is still valid in cache.
                _logger.LogError(ex, "Failed to send OTP email to {Email} — OTP is still valid in cache", user.Email);
            }
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
