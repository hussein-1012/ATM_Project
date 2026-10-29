using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.WebApi.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("v1/me/recent-searches")]
public class RecentSearchesController : ControllerBase
{
    private readonly RecentSearchesService _searchesService;

    public RecentSearchesController(RecentSearchesService searchesService)
    {
        _searchesService = searchesService;
    }

    [HttpGet]
    public async Task<ActionResult<RecentSearchListDto>> List(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var list = await _searchesService.ListAsync(userId, ct);
        return Ok(list);
    }

    [HttpPost]
    public async Task<ActionResult<RecentSearchResponseDto>> Add(
        [FromBody] CreateRecentSearchRequest request,
        CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var item = await _searchesService.AddAsync(userId, request.Query, ct);
        return StatusCode(StatusCodes.Status201Created, item);
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        await _searchesService.ClearAsync(userId, ct);
        return NoContent();
    }
}
