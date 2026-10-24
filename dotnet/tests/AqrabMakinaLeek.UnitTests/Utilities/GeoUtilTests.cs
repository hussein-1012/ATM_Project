using AqrabMakinaLeek.Domain.Utilities;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Utilities;

public class GeoUtilTests
{
    [Fact]
    public void HaversineMeters_ShouldReturnZeroForIdenticalPoints()
    {
        var d = GeoUtil.HaversineMeters(29.3, 30.8, 29.3, 30.8);
        d.Should().BeApproximately(0, 0.0001);
    }

    [Fact]
    public void HaversineMeters_ShouldMeasureKnownShortDistance()
    {
        var d = GeoUtil.HaversineMeters(29.3, 30.8, 29.301, 30.8);
        d.Should().BeInRange(105, 115);
    }

    [Fact]
    public void HaversineMeters_ShouldMeasureLongerDistanceAcrossFayoum()
    {
        var d = GeoUtil.HaversineMeters(29.3084, 30.8412, 29.3597, 30.6855);
        d.Should().BeInRange(14000, 19000);
    }

    [Fact]
    public void IsValidLatLng_ShouldAcceptValidCoordinates()
    {
        GeoUtil.IsValidLatLng(29.3, 30.8).Should().BeTrue();
    }

    [Fact]
    public void IsValidLatLng_ShouldRejectOutOfRangeCoordinates()
    {
        GeoUtil.IsValidLatLng(91.0, 30.0).Should().BeFalse();
        GeoUtil.IsValidLatLng(29.0, 181.0).Should().BeFalse();
        GeoUtil.IsValidLatLng(double.NaN, 30.0).Should().BeFalse();
    }

    [Fact]
    public void RoundCoord_ShouldRoundTo4DecimalsByDefault()
    {
        GeoUtil.RoundCoord(29.32533681).Should().Be(29.3253);
        GeoUtil.RoundCoord(30.836385).Should().Be(30.8364);
    }

    [Fact]
    public void IsInEgypt_ShouldValidateEgyptBounds()
    {
        GeoUtil.IsInEgypt(29.3084, 30.8412).Should().BeTrue(); // Fayoum
        GeoUtil.IsInEgypt(51.5074, -0.1278).Should().BeFalse(); // London
    }
}
