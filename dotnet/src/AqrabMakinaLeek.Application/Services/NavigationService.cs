using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;
using Microsoft.Extensions.Logging;

namespace AqrabMakinaLeek.Application.Services;

public class NavigationService
{
    private const int DefaultCacheTtlSeconds = 60;

    private readonly IAtmRepository _atmsRepo;
    private readonly IRoutingProvider _routingProvider;
    private readonly ICacheService _cache;
    private readonly ILogger<NavigationService> _logger;

    public NavigationService(
        IAtmRepository atmsRepo,
        IRoutingProvider routingProvider,
        ICacheService cache,
        ILogger<NavigationService> logger)
    {
        _atmsRepo = atmsRepo;
        _routingProvider = routingProvider;
        _cache = cache;
        _logger = logger;
    }

    public async Task<RouteResult> RouteAsync(
        double fromLat,
        double fromLng,
        string atmId,
        TravelMode mode,
        CancellationToken ct = default)
    {
        var atm = await _atmsRepo.GetByIdAsync(atmId, ct: ct);
        if (atm is null)
        {
            throw new NotFoundException("ATM not found", "ATM_NOT_FOUND");
        }

        var from = new LatLng(fromLat, fromLng);
        var to = new LatLng(atm.Location.Latitude, atm.Location.Longitude);

        var cFromLat = GeoUtil.RoundCoord(from.Lat);
        var cFromLng = GeoUtil.RoundCoord(from.Lng);
        var cToLat = GeoUtil.RoundCoord(to.Lat);
        var cToLng = GeoUtil.RoundCoord(to.Lng);
        var cacheKey = $"route:{_routingProvider.Name}:{mode.ToString().ToLowerInvariant()}:{cFromLat},{cFromLng}:{cToLat},{cToLng}";

        // 1. Check Cache
        try
        {
            var cachedJson = await _cache.GetAsync(cacheKey, ct);
            if (!string.IsNullOrWhiteSpace(cachedJson))
            {
                var cachedRoute = JsonSerializer.Deserialize<RouteResult>(cachedJson);
                if (cachedRoute is not null)
                {
                    return cachedRoute;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read route from cache");
        }

        // 2. Route via primary provider with automatic fallback
        RouteResult result;
        try
        {
            result = await _routingProvider.RouteAsync(from, to, mode, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Routing provider {Provider} failed; using straight-line fallback", _routingProvider.Name);
            result = StraightLineFallback(from, to, mode);
        }

        // 3. Save to Cache
        try
        {
            var json = JsonSerializer.Serialize(result);
            await _cache.SetAsync(cacheKey, json, TimeSpan.FromSeconds(DefaultCacheTtlSeconds), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to cache calculated route");
        }

        return result;
    }

    private static RouteResult StraightLineFallback(LatLng from, LatLng to, TravelMode mode)
    {
        const double walkSpeed = 80.0;
        const double driveSpeed = 500.0;

        var distanceMeters = (int)Math.Round(GeoUtil.HaversineMeters(from.Lat, from.Lng, to.Lat, to.Lng));
        var speed = mode == TravelMode.Walk ? walkSpeed : driveSpeed;
        var durationSeconds = (int)Math.Round((distanceMeters / speed) * 60);

        var polyline = new RouteGeometry(
            "LineString",
            [
                [from.Lng, from.Lat],
                [to.Lng, to.Lat]
            ]);

        var steps = new List<RouteStep>
        {
            new(Maneuver.DEPART, null, distanceMeters, durationSeconds, new LatLng(from.Lat, from.Lng)),
            new(Maneuver.ARRIVE, null, 0, 0, new LatLng(to.Lat, to.Lng))
        };

        return new RouteResult(distanceMeters, durationSeconds, Approximate: true, polyline, steps);
    }
}
