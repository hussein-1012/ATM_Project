using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.WebApi.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("v1/me")]
public class AccountController : ControllerBase
{
    private readonly AccountService _accountService;

    public AccountController(AccountService accountService)
    {
        _accountService = accountService;
    }

    [HttpGet]
    public async Task<ActionResult<UserResponseDto>> GetProfile(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var profile = await _accountService.GetProfileAsync(userId, ct);
        return Ok(profile);
    }

    [HttpPatch]
    public async Task<ActionResult<UserResponseDto>> UpdateProfile([FromBody] UpdateProfileDto dto, CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var updated = await _accountService.UpdateProfileAsync(userId, dto, ct);
        return Ok(updated);
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountRequest request, CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        await _accountService.DeleteAccountAsync(userId, request.Password, ct);
        return Ok(new { deleted = true });
    }
}
