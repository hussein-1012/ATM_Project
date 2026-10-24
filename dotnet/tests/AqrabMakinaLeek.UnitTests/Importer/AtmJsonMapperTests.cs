using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Importer.Services;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Importer;

public class AtmJsonMapperTests
{
    private readonly AtmJsonMapper _mapper = new("google_places");

    [Fact]
    public void Map_MapsValidAtmRecordSuccessfully()
    {
        var raw = new RawAtmRecord
        {
            Title = "CIB ATM Smart Village",
            Address = "Smart Village, Cairo",
            Location = new RawAtmLocation { Lat = 30.0732, Lng = 31.0184 },
            Categories = ["ATM", "Bank"],
            OpeningHours = [new RawAtmOpeningHours { Day = "Monday", Hours = "Open 24 hours" }]
        };

        var result = _mapper.Map(raw);

        result.Ok.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Bank.Should().Be(AtmBank.CIB);
        result.Value.IsBranch.Should().BeTrue();
        result.Value.Is24h.Should().BeTrue();
        result.Value.SearchText.Should().Contain("cib");
    }

    [Fact]
    public void Map_SkipsRecord_OutsideEgypt()
    {
        var raw = new RawAtmRecord
        {
            Title = "ATM in London",
            Address = "London, UK",
            Location = new RawAtmLocation { Lat = 51.5074, Lng = -0.1278 },
            Categories = ["ATM"]
        };

        var result = _mapper.Map(raw);

        result.Ok.Should().BeFalse();
        result.Reason.Should().Be(SkipReason.OUTSIDE_EGYPT);
    }

    [Fact]
    public void Map_SkipsRecord_PermanentlyClosed()
    {
        var raw = new RawAtmRecord
        {
            Title = "Closed NBE ATM",
            Location = new RawAtmLocation { Lat = 30.0444, Lng = 31.2357 },
            Categories = ["ATM"],
            PermanentlyClosed = true
        };

        var result = _mapper.Map(raw);

        result.Ok.Should().BeFalse();
        result.Reason.Should().Be(SkipReason.PERMANENTLY_CLOSED);
    }

    [Fact]
    public void Map_SkipsRecord_MissingLocation()
    {
        var raw = new RawAtmRecord
        {
            Title = "No Location ATM",
            Location = null,
            Categories = ["ATM"]
        };

        var result = _mapper.Map(raw);

        result.Ok.Should().BeFalse();
        result.Reason.Should().Be(SkipReason.MISSING_LOCATION);
    }
}
