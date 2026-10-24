using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Infrastructure.Routing;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Routing;

public class RoutingTests
{
    private readonly FallbackRoutingProvider _fallback = new();

    [Fact]
    public async Task FallbackRouting_CalculatesWalkDurationAccurately()
    {
        // 800m walk at 80 m/min -> 10 min -> 600 seconds
        var from = new LatLng(30.0444, 31.2357);
        // Approx 800m offset
        var to = new LatLng(30.0516, 31.2357);

        var result = await _fallback.RouteAsync(from, to, TravelMode.Walk);

        result.Approximate.Should().BeTrue();
        result.DistanceMeters.Should().BeInRange(790, 810);
        result.DurationSeconds.Should().BeInRange(590, 610);
        result.Polyline.Type.Should().Be("LineString");
        result.Polyline.Coordinates.Should().HaveCount(2);
        result.Steps.Should().HaveCount(2);
        result.Steps[0].Maneuver.Should().Be(Maneuver.DEPART);
        result.Steps[1].Maneuver.Should().Be(Maneuver.ARRIVE);
    }

    [Fact]
    public async Task FallbackRouting_CalculatesDriveDurationAccurately()
    {
        // 5000m drive at 500 m/min -> 10 min -> 600 seconds
        var from = new LatLng(30.0444, 31.2357);
        var to = new LatLng(30.0894, 31.2357);

        var result = await _fallback.RouteAsync(from, to, TravelMode.Drive);

        result.Approximate.Should().BeTrue();
        result.DistanceMeters.Should().BeInRange(4900, 5100);
        result.DurationSeconds.Should().BeInRange(580, 620);
    }
}
