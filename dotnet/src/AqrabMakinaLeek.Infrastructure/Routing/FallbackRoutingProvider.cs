using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;

namespace AqrabMakinaLeek.Infrastructure.Routing;

public class FallbackRoutingProvider : IRoutingProvider
{
    private const double WalkMetersPerMinute = 80.0;
    private const double DriveMetersPerMinute = 500.0;

    public string Name => "fallback";

    public Task<RouteResult> RouteAsync(LatLng from, LatLng to, TravelMode mode, CancellationToken ct = default)
    {
        var distanceMeters = (int)Math.Round(GeoUtil.HaversineMeters(from.Lat, from.Lng, to.Lat, to.Lng));
        var metersPerMinute = mode == TravelMode.Walk ? WalkMetersPerMinute : DriveMetersPerMinute;
        var durationSeconds = (int)Math.Round((distanceMeters / metersPerMinute) * 60);

        var polyline = new RouteGeometry(
            "LineString",
            [
                [from.Lng, from.Lat],
                [to.Lng, to.Lat]
            ]);

        var steps = new List<RouteStep>
        {
            new(
                Maneuver.DEPART,
                null,
                distanceMeters,
                durationSeconds,
                new LatLng(from.Lat, from.Lng)),
            new(
                Maneuver.ARRIVE,
                null,
                0,
                0,
                new LatLng(to.Lat, to.Lng))
        };

        var result = new RouteResult(
            distanceMeters,
            durationSeconds,
            Approximate: true,
            polyline,
            steps);

        return Task.FromResult(result);
    }
}
