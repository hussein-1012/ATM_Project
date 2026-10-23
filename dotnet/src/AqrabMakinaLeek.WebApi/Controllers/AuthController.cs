using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.WebApi.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Route("v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var user = await _authService.RegisterAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { user });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var response = await _authService.LoginAsync(request, ct);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        var response = await _authService.RefreshAsync(request.RefreshToken, ct);
        return Ok(response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken ct)
    {
        await _authService.LogoutAsync(request.RefreshToken, ct);
        return Ok(new { revoked = true });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        await _authService.ForgotPasswordAsync(request.Email, ct);
        return Ok(new { sent = true });
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request, CancellationToken ct)
    {
        var resetToken = await _authService.VerifyOtpAsync(request.Email, request.Otp, ct);
        return Ok(new { resetToken });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        await _authService.ResetPasswordAsync(request.ResetToken, request.NewPassword, ct);
        return Ok(new { reset = true });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword, ct);
        return Ok(new { changed = true });
    }
}
