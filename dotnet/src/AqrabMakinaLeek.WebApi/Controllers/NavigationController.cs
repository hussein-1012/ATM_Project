using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

// Request body shape that the frontend sends
public record NavigateByBodyRequest(
    NavigateFrom From,
    string AtmId,
    string Mode = "walk"
);
public record NavigateFrom(double Lat, double Lng);

[ApiController]
[Route("v1/navigation")]
public class NavigationController : ControllerBase
{
    private readonly NavigationService _navigationService;

    public NavigationController(NavigationService navigationService)
    {
        _navigationService = navigationService;
    }

    // GET endpoint (used by integration tests and Flutter)
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

    // POST endpoint for the frontend dashboard (sends JSON body)
    [HttpPost("route")]
    public async Task<ActionResult<RouteResult>> RouteByBody(
        [FromBody] NavigateByBodyRequest request,
        CancellationToken ct = default)
    {
        var mode = Enum.TryParse<TravelMode>(request.Mode, ignoreCase: true, out var parsed)
            ? parsed
            : TravelMode.Walk;

        var result = await _navigationService.RouteAsync(
            request.From.Lat,
            request.From.Lng,
            request.AtmId,
            mode,
            ct);

        return Ok(result);
    }
}
