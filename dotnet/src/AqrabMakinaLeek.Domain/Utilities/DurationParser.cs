using System.Text.RegularExpressions;

namespace AqrabMakinaLeek.Domain.Utilities;

public static class DurationParser
{
    private static readonly Regex DurationRegex = new(@"^(\d+)\s*([a-zA-Z]+)$", RegexOptions.Compiled);

    public static TimeSpan Parse(string input, TimeSpan fallback)
    {
        if (string.IsNullOrWhiteSpace(input))
            return fallback;

        var match = DurationRegex.Match(input.Trim());
        if (!match.Success)
            return fallback;

        if (!double.TryParse(match.Groups[1].Value, out var val))
            return fallback;

        var unit = match.Groups[2].Value.ToLowerInvariant();

        return unit switch
        {
            "ms" => TimeSpan.FromMilliseconds(val),
            "s" => TimeSpan.FromSeconds(val),
            "m" => TimeSpan.FromMinutes(val),
            "h" => TimeSpan.FromHours(val),
            "d" => TimeSpan.FromDays(val),
            "w" => TimeSpan.FromDays(val * 7),
            _ => fallback
        };
    }
}
