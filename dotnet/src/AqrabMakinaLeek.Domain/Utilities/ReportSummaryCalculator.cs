using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Domain.Utilities;

public record ReportSummaryResult(string Status, string? ReportedAt, int ReportsToday);

public static class ReportSummaryCalculator
{
    private const double WeightEpsilon = 1e-9;

    /// <summary>
    /// Recency-weighted consensus over the reports in the freshness window.
    /// weight = 2 - ageHours / freshHours (newest report has up to 2x weight).
    /// Highest total weight wins; tie => UNKNOWN; no reports => UNKNOWN.
    /// </summary>
    public static ReportSummaryResult Summarize(
        IReadOnlyList<AtmReport> reports,
        DateTime nowUtc,
        double freshHours,
        DateTime cairoStartOfDayUtc)
    {
        var freshSince = nowUtc.AddHours(-freshHours);
        var weights = new Dictionary<AtmReportStatus, double>();

        foreach (var report in reports)
        {
            if (report.CreatedAt < freshSince)
                continue;

            var ageHours = (nowUtc - report.CreatedAt).TotalHours;
            var weight = 2.0 - (ageHours / freshHours);

            weights[report.Status] = weights.GetValueOrDefault(report.Status) + weight;
        }

        var reportsToday = reports.Count(r => r.CreatedAt >= cairoStartOfDayUtc);
        var newest = reports.OrderByDescending(r => r.CreatedAt).FirstOrDefault()?.CreatedAt;

        var ranked = weights.OrderByDescending(kv => kv.Value).ToList();
        var status = "UNKNOWN";

        if (ranked.Count > 0)
        {
            var bestWeight = ranked[0].Value;
            var tied = ranked.Count(kv => Math.Abs(kv.Value - bestWeight) < WeightEpsilon) > 1;
            status = tied ? "UNKNOWN" : ranked[0].Key.ToString();
        }

        return new ReportSummaryResult(
            status,
            newest?.ToString("o"),
            reportsToday
        );
    }
}
