using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;
using AqrabMakinaLeek.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Utilities;

public class OpenNowEvaluatorTests
{
    private static CairoClock MakeClock(string weekday, string hhmm)
    {
        var parts = hhmm.Split(':');
        var minutes = int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
        return new CairoClock(weekday, minutes);
    }

    [Fact]
    public void Evaluate_ShouldBeOpenWhen24HIsTrue()
    {
        OpenNowEvaluator.Evaluate(null, true, MakeClock("monday", "03:00"))
            .Should().Be(OpenStatus.OPEN);

        var hours = new OpeningHours
        {
            ["monday"] = [new OpeningHoursInterval("09:00", "17:00")]
        };
        OpenNowEvaluator.Evaluate(hours, true, MakeClock("monday", "23:00"))
            .Should().Be(OpenStatus.OPEN);
    }

    [Fact]
    public void Evaluate_ShouldBeUnknownWhenHoursMissingOrEmpty()
    {
        OpenNowEvaluator.Evaluate(null, false, MakeClock("monday", "10:00"))
            .Should().Be(OpenStatus.UNKNOWN);
        OpenNowEvaluator.Evaluate(new OpeningHours(), null, MakeClock("monday", "10:00"))
            .Should().Be(OpenStatus.UNKNOWN);
    }

    [Fact]
    public void Evaluate_ShouldHandleSameDayWindowCorrectly()
    {
        var hours = new OpeningHours
        {
            ["monday"] = [new OpeningHoursInterval("09:00", "17:00")]
        };

        // OPEN within window (inclusive start)
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "09:00")).Should().Be(OpenStatus.OPEN);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "12:30")).Should().Be(OpenStatus.OPEN);

        // CLOSED before and at/after close (exclusive end)
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "08:59")).Should().Be(OpenStatus.CLOSED);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "17:00")).Should().Be(OpenStatus.CLOSED);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "23:59")).Should().Be(OpenStatus.CLOSED);

        // CLOSED on another day with no hours
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("tuesday", "12:00")).Should().Be(OpenStatus.CLOSED);
    }

    [Fact]
    public void Evaluate_ShouldHandleOvernightWindowWrappingPastMidnight()
    {
        // Monday 22:00 -> Tuesday 02:00
        var hours = new OpeningHours
        {
            ["monday"] = [new OpeningHoursInterval("22:00", "02:00")]
        };

        // Monday night (open inclusive)
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "22:00")).Should().Be(OpenStatus.OPEN);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("monday", "23:59")).Should().Be(OpenStatus.OPEN);

        // Tuesday early morning (overnight tail)
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("tuesday", "00:00")).Should().Be(OpenStatus.OPEN);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("tuesday", "01:59")).Should().Be(OpenStatus.OPEN);
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("tuesday", "02:00")).Should().Be(OpenStatus.CLOSED);

        // Tuesday evening
        OpenNowEvaluator.Evaluate(hours, null, MakeClock("tuesday", "21:00")).Should().Be(OpenStatus.CLOSED);
    }
}
