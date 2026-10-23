using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.Domain.Utilities;

public static class OpenNowEvaluator
{
    private static readonly string[] Weekdays =
    [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    private static string PreviousWeekday(string day)
    {
        var idx = Array.IndexOf(Weekdays, day.ToLowerInvariant());
        if (idx == -1) idx = 0;
        return Weekdays[(idx + Weekdays.Length - 1) % Weekdays.Length];
    }

    private static bool IsIntervalOpenAt(OpeningHoursInterval interval, int minutes)
    {
        var open = CairoTimeUtil.ParseHhMm(interval.Open);
        var close = CairoTimeUtil.ParseHhMm(interval.Close);
        if (open == null || close == null) return false;

        if (close > open)
        {
            // Ordinary same-day window: [open, close)
            return minutes >= open.Value && minutes < close.Value;
        }

        // Overnight window (close <= open): spans to the end of the day.
        return minutes >= open.Value;
    }

    private static bool IsOvernightTailOpenAt(OpeningHoursInterval interval, int minutes)
    {
        var open = CairoTimeUtil.ParseHhMm(interval.Open);
        var close = CairoTimeUtil.ParseHhMm(interval.Close);
        if (open == null || close == null) return false;
        if (close > open) return false; // Not an overnight interval

        // Overnight tail continues on next day: [0, close)
        return minutes < close.Value;
    }

    /// <summary>
    /// Pure open/closed decision for a given Cairo wall clock.
    /// Handles 24h, ordinary intervals, and overnight intervals extending into next day.
    /// </summary>
    public static OpenStatus Evaluate(OpeningHours? openingHours, bool? is24H, CairoClock clock)
    {
        if (is24H == true)
            return OpenStatus.OPEN;

        if (openingHours == null || openingHours.Count == 0)
            return OpenStatus.UNKNOWN;

        var todayKey = clock.Weekday.ToLowerInvariant();
        openingHours.TryGetValue(todayKey, out var todayIntervals);
        todayIntervals ??= [];

        var yesterdayKey = PreviousWeekday(todayKey);
        openingHours.TryGetValue(yesterdayKey, out var yesterdayIntervals);
        yesterdayIntervals ??= [];

        var openToday = todayIntervals.Any(interval => IsIntervalOpenAt(interval, clock.Minutes));
        var overnightTail = yesterdayIntervals.Any(interval => IsOvernightTailOpenAt(interval, clock.Minutes));

        return (openToday || overnightTail) ? OpenStatus.OPEN : OpenStatus.CLOSED;
    }
}
