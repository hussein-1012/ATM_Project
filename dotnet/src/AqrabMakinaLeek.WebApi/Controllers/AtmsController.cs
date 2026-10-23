using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Route("v1/atms")]
public class AtmsController : ControllerBase
{
    private readonly AtmsService _atmsService;

    public AtmsController(AtmsService atmsService)
    {
        _atmsService = atmsService;
    }

    [HttpGet("nearby")]
    public async Task<ActionResult<NearbyResponseDto>> GetNearby([FromQuery] NearbyQueryDto query, CancellationToken ct)
    {
        var response = await _atmsService.GetNearbyAsync(query, ct);
        return Ok(response);
    }

    [HttpGet("search")]
    public async Task<ActionResult<SearchResponseDto>> Search([FromQuery] SearchQueryDto query, CancellationToken ct)
    {
        var response = await _atmsService.SearchAsync(query, ct);
        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AtmDetailResponseDto>> GetDetail(
        [FromRoute] string id,
        [FromQuery] double? refLat,
        [FromQuery] double? refLng,
        CancellationToken ct)
    {
        var response = await _atmsService.GetDetailAsync(id, refLat, refLng, ct);
        return Ok(response);
    }
}
