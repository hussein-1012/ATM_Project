using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.WebApi.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("v1/favorites")]
public class FavoritesController : ControllerBase
{
    private readonly FavoritesService _favoritesService;

    public FavoritesController(FavoritesService favoritesService)
    {
        _favoritesService = favoritesService;
    }

    [HttpGet]
    public async Task<ActionResult<FavoriteListDto>> List(
        [FromQuery] double? refLat,
        [FromQuery] double? refLng,
        CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var favorites = await _favoritesService.ListAsync(userId, refLat, refLng, ct);
        return Ok(favorites);
    }

    [HttpPost("{atmId}")]
    public async Task<ActionResult<AddFavoriteResponseDto>> Add(
        [FromRoute] string atmId,
        CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var result = await _favoritesService.AddAsync(userId, atmId, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpDelete("{atmId}")]
    public async Task<IActionResult> Remove(
        [FromRoute] string atmId,
        CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        await _favoritesService.RemoveAsync(userId, atmId, ct);
        return NoContent();
    }
}
