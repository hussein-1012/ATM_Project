namespace AqrabMakinaLeek.Domain.Utilities;

public record CairoClock(string Weekday, int Minutes);

public static class CairoTimeUtil
{
    private static readonly TimeZoneInfo CairoTz = ResolveCairoTimeZone();

    private static TimeZoneInfo ResolveCairoTimeZone()
    {
        // Try IANA first ("Africa/Cairo"), then Windows ID ("Egypt Standard Time")
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Africa/Cairo", out var ianaTz))
            return ianaTz;

        if (TimeZoneInfo.TryFindSystemTimeZoneById("Egypt Standard Time", out var winTz))
            return winTz;

        // Fallback to UTC+2 if OS database has neither
        return TimeZoneInfo.CreateCustomTimeZone("Africa/Cairo", TimeSpan.FromHours(2), "Cairo Time", "Cairo Standard Time");
    }

    public static TimeZoneInfo TimeZone => CairoTz;

    /// <summary>
    /// Converts a UTC instant to Cairo local time.
    /// </summary>
    public static DateTime ToCairoTime(DateTime utcDateTime)
    {
        var utc = utcDateTime.Kind == DateTimeKind.Utc ? utcDateTime : DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(utc, CairoTz);
    }

    /// <summary>
    /// Gets the current Cairo wall clock: lowercase English weekday ("sunday", "monday", etc.) and minutes since midnight (0..1439).
    /// </summary>
    public static CairoClock GetCairoClock(DateTime? utcNow = null)
    {
        var localCairo = ToCairoTime(utcNow ?? DateTime.UtcNow);
        var weekday = localCairo.DayOfWeek.ToString().ToLowerInvariant();
        var minutes = localCairo.Hour * 60 + localCairo.Minute;
        return new CairoClock(weekday, minutes);
    }

    /// <summary>
    /// Parses "HH:MM" into minutes since midnight (0..1439), or null if invalid.
    /// </summary>
    public static int? ParseHhMm(string? hhmm)
    {
        if (string.IsNullOrWhiteSpace(hhmm))
            return null;

        var parts = hhmm.Trim().Split(':');
        if (parts.Length != 2)
            return null;

        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m))
            return null;

        if (h < 0 || h > 23 || m < 0 || m > 59)
            return null;

        return h * 60 + m;
    }

    /// <summary>
    /// Midnight of "today" in Cairo, converted to a UTC instant (DST-aware).
    /// </summary>
    public static DateTime GetCairoStartOfDayUtc(DateTime? utcNow = null)
    {
        var localCairo = ToCairoTime(utcNow ?? DateTime.UtcNow);
        var localMidnight = new DateTime(localCairo.Year, localCairo.Month, localCairo.Day, 0, 0, 0, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, CairoTz);
    }
}
