using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Route("v1/navigation")]
public class NavigationController : ControllerBase
{
    private readonly NavigationService _navigationService;

    public NavigationController(NavigationService navigationService)
    {
        _navigationService = navigationService;
    }

    [HttpGet("route/{atmId}")]
    public async Task<ActionResult<RouteResult>> Route(
        [FromRoute] string atmId,
        [FromQuery] double fromLat,
        [FromQuery] double fromLng,
        [FromQuery] TravelMode mode = TravelMode.Walk,
        CancellationToken ct = default)
    {
        var result = await _navigationService.RouteAsync(fromLat, fromLng, atmId, mode, ct);
        return Ok(result);
    }
}
