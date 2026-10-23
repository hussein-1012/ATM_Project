namespace AqrabMakinaLeek.Domain.ValueObjects;

public record OpeningHoursInterval(string Open, string Close);

public class OpeningHours : Dictionary<string, List<OpeningHoursInterval>>
{
    public OpeningHours() : base(StringComparer.OrdinalIgnoreCase) { }

    public OpeningHours(IDictionary<string, List<OpeningHoursInterval>> dictionary)
        : base(dictionary, StringComparer.OrdinalIgnoreCase) { }
}
