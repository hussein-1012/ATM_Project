using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Utilities;

public class ReportSummaryCalculatorTests
{
    private readonly DateTime _now = new(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc);
    private readonly DateTime _startOfDay = new(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
    private const double FreshHours = 6.0;

    private static AtmReport MakeReport(AtmReportStatus status, DateTime createdAt) => new()
    {
        Status = status,
        CreatedAt = createdAt
    };

    [Fact]
    public void Summarize_ShouldReturnUnknownWithNoReports()
    {
        var result = ReportSummaryCalculator.Summarize([], _now, FreshHours, _startOfDay);
        result.Status.Should().Be("UNKNOWN");
        result.ReportedAt.Should().BeNull();
        result.ReportsToday.Should().Be(0);
    }

    [Fact]
    public void Summarize_ShouldEchoSingleStatus()
    {
        var reportTime = _now.AddHours(-1);
        var reports = new List<AtmReport> { MakeReport(AtmReportStatus.WORKING, reportTime) };

        var result = ReportSummaryCalculator.Summarize(reports, _now, FreshHours, _startOfDay);
        result.Status.Should().Be("WORKING");
        result.ReportedAt.Should().Be(reportTime.ToString("o"));
        result.ReportsToday.Should().Be(1);
    }

    [Fact]
    public void Summarize_ShouldWeightNewerReportHigherWithinFreshnessWindow()
    {
        var reports = new List<AtmReport>
        {
            MakeReport(AtmReportStatus.WORKING, _now.AddHours(-1)),
            MakeReport(AtmReportStatus.OUT_OF_CASH, _now.AddHours(-5))
        };

        var result = ReportSummaryCalculator.Summarize(reports, _now, FreshHours, _startOfDay);
        result.Status.Should().Be("WORKING");
        result.ReportsToday.Should().Be(2);
    }

    [Fact]
    public void Summarize_ShouldReturnUnknownWhenStatusesTieOnWeight()
    {
        var reports = new List<AtmReport>
        {
            MakeReport(AtmReportStatus.WORKING, _now.AddHours(-3)),
            MakeReport(AtmReportStatus.OUT_OF_CASH, _now.AddHours(-3))
        };

        var result = ReportSummaryCalculator.Summarize(reports, _now, FreshHours, _startOfDay);
        result.Status.Should().Be("UNKNOWN");
    }

    [Fact]
    public void Summarize_ShouldIgnoreReportsOlderThanFreshnessWindowForStatus()
    {
        var reports = new List<AtmReport>
        {
            MakeReport(AtmReportStatus.OUT_OF_SERVICE, _now.AddHours(-20))
        };

        var result = ReportSummaryCalculator.Summarize(reports, _now, FreshHours, _startOfDay);
        result.Status.Should().Be("UNKNOWN");
        result.ReportsToday.Should().Be(0);
    }
}
