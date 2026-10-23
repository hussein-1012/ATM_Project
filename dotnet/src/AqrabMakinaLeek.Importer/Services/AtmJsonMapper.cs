using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;
using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.Importer.Services;

public enum SkipReason
{
    INVALID_RECORD,
    EMPTY_NAME,
    MISSING_LOCATION,
    INVALID_COORDINATES,
    OUTSIDE_EGYPT,
    NOT_ATM_CATEGORY,
    PERMANENTLY_CLOSED
}

public record MapResult(
    bool Ok,
    Atm? Value,
    SkipReason? Reason = null,
    string? Detail = null
);

public class AtmJsonMapper
{
    private readonly string _source;

    private static readonly Regex BankCategoryRegex = new(
        @"(^|\s)(bank|banks|savings bank|public sector bank|investment bank|trust bank|cooperative bank)(\s|$)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex BranchRegex = new(@"فرع|branch", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private record BankRule(AtmBank Bank, Regex[] Patterns);

    private static readonly BankRule[] BankRules =
    [
        new(AtmBank.CIB, [new(@"\bcib\b"), new(@"commercial international"), new(@"البنك التجاري الدولي")]),
        new(AtmBank.QNB, [new(@"\bqnb\b"), new(@"qnb alahli"), new(@"قطر الوطني")]),
        new(AtmBank.AAIB, [new(@"\baaib\b"), new(@"arab african"), new(@"العربي الافريقي")]),
        new(AtmBank.BANQUE_DU_CAIRE, [new(@"banque du caire"), new(@"بنك القاهره")]),
        new(AtmBank.NBE, [new(@"\bnbe\b"), new(@"national bank of egypt"), new(@"natioal bank of egypt"), new(@"البنك الاهلي"), new(@"الاهلي المصري"), new(@"بنك الاهلي")]),
        new(AtmBank.BANQUE_MISR, [new(@"banque misr"), new(@"بنك مصر")]),
        new(AtmBank.ALEXANDRIA_BANK, [new(@"alexandria"), new(@"بنك الاسكندريه")]),
        new(AtmBank.AGRICULTURAL_BANK, [new(@"agricultural bank"), new(@"البنك الزراعي")]),
        new(AtmBank.EGBANK, [new(@"egbank")]),
        new(AtmBank.HOUSING_DEVELOPMENT, [new(@"housing (and|&) development"), new(@"\bhdb\b"), new(@"بنك التعمير")]),
        new(AtmBank.FAISAL_ISLAMIC, [new(@"faisal islamic"), new(@"بنك فيصل")]),
        new(AtmBank.AL_BARAKA, [new(@"al ?baraka"), new(@"بنك البركه")]),
        new(AtmBank.BANK_NXT, [new(@"bank nxt")]),
        new(AtmBank.ADCB, [new(@"\badcb\b")]),
        new(AtmBank.CREDIT_AGRICOLE, [new(@"credit agricole"), new(@"كريدي اجريكول")]),
        new(AtmBank.POSTAL, [new(@"البريد المصري"), new(@"egypt post"), new(@"post office")])
    ];

    public AtmJsonMapper(string source = "google_places")
    {
        _source = source;
    }

    public MapResult Map(RawAtmRecord? record)
    {
        if (record is null)
        {
            return new MapResult(false, null, SkipReason.INVALID_RECORD, "Record is null");
        }

        var name = (record.Title ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name))
        {
            return new MapResult(false, null, SkipReason.EMPTY_NAME);
        }

        if (record.Location?.Lat is null || record.Location?.Lng is null)
        {
            return new MapResult(false, null, SkipReason.MISSING_LOCATION);
        }

        var lat = record.Location.Lat.Value;
        var lng = record.Location.Lng.Value;

        if (double.IsNaN(lat) || double.IsInfinity(lat) || double.IsNaN(lng) || double.IsInfinity(lng))
        {
            return new MapResult(false, null, SkipReason.INVALID_COORDINATES);
        }

        if (!GeoUtil.IsInEgypt(lat, lng))
        {
            return new MapResult(false, null, SkipReason.OUTSIDE_EGYPT, $"{lat},{lng}");
        }

        var categories = record.Categories ?? [];
        if (!IsAtmLike(categories))
        {
            return new MapResult(false, null, SkipReason.NOT_ATM_CATEGORY, string.Join("|", categories));
        }

        if (record.PermanentlyClosed == true)
        {
            return new MapResult(false, null, SkipReason.PERMANENTLY_CLOSED);
        }

        var address = BuildAddress(record);
        var bank = DetectBank(record);
        var normalizedTitle = ArabicNormalizeUtil.NormalizeArabic(name);
        var isBranch = categories.Any(c => BankCategoryRegex.IsMatch(ArabicNormalizeUtil.NormalizeArabic(c))) ||
                       BranchRegex.IsMatch(normalizedTitle);

        var (openingHours, is24h) = ParseOpeningHours(record);
        var bankLabel = AtmBankMetadata.BankLabels.GetValueOrDefault(bank, string.Empty);
        var searchText = ArabicNormalizeUtil.BuildSearchText([name, address, bankLabel]);

        var atm = new Atm
        {
            Source = _source,
            SourceId = BuildSourceId(record, name, lat, lng),
            Name = name,
            Bank = bank,
            Address = address,
            Location = new GeoPoint(lat, lng),
            IsBranch = isBranch,
            OpeningHours = openingHours,
            Is24h = is24h,
            WheelchairAccessible = null,
            SearchText = searchText,
            SourceFetchedAt = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        return new MapResult(true, atm);
    }

    private static bool IsAtmLike(List<string> categories)
    {
        return categories.Any(c =>
        {
            var n = ArabicNormalizeUtil.NormalizeArabic(c);
            return n == "atm" || n.Contains("atm") || BankCategoryRegex.IsMatch(n);
        });
    }

    private static string BuildAddress(RawAtmRecord record)
    {
        var address = (record.Address ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(address)) return address;

        var parts = new[] { record.Street, record.Neighborhood, record.City, record.State }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p!.Trim());

        return string.Join(", ", parts);
    }

    private static AtmBank DetectBank(RawAtmRecord record)
    {
        var titleText = ArabicNormalizeUtil.NormalizeArabic(record.Title ?? string.Empty);
        foreach (var rule in BankRules)
        {
            if (rule.Patterns.Any(p => p.IsMatch(titleText)))
            {
                return rule.Bank;
            }
        }

        var addressText = ArabicNormalizeUtil.NormalizeArabic(record.Address ?? string.Empty);
        foreach (var rule in BankRules)
        {
            if (rule.Patterns.Any(p => p.IsMatch(addressText)))
            {
                return rule.Bank;
            }
        }

        return AtmBank.OTHER;
    }

    private static string BuildSourceId(RawAtmRecord record, string name, double lat, double lng)
    {
        var placeId = (record.PlaceId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(placeId))
        {
            return placeId.Length > 255 ? placeId[..255] : placeId;
        }

        var rawIdentity = $"{ArabicNormalizeUtil.NormalizeArabic(name)}|{lat:F5}|{lng:F5}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawIdentity))).ToLowerInvariant();
        return $"gen_{hash[..Math.Min(48, hash.Length)]}";
    }

    private static (OpeningHours? OpeningHours, bool? Is24h) ParseOpeningHours(RawAtmRecord record)
    {
        var days = record.OpeningHours;
        if (days is null || days.Count == 0) return (null, null);

        var validDays = days.Where(d => !string.IsNullOrWhiteSpace(d.Day)).ToList();
        if (validDays.Count == 0) return (null, null);

        var all24h = validDays.All(d => Regex.IsMatch(d.Hours ?? string.Empty, "open 24 hours", RegexOptions.IgnoreCase));
        if (all24h) return (null, true);

        var openingHours = new OpeningHours();
        var parsedAny = false;

        foreach (var entry in validDays)
        {
            var dayKey = entry.Day!.Trim().ToLowerInvariant();
            var intervals = ParseDayHours(entry.Hours ?? string.Empty);
            if (intervals is null) continue;

            openingHours[dayKey] = intervals;
            parsedAny = true;
        }

        if (!parsedAny) return (null, null);
        return (openingHours, false);
    }

    private static List<OpeningHoursInterval>? ParseDayHours(string hours)
    {
        var text = hours.Trim();
        if (string.IsNullOrEmpty(text)) return null;
        if (Regex.IsMatch(text, "^closed$", RegexOptions.IgnoreCase)) return [];
        if (Regex.IsMatch(text, "open 24 hours", RegexOptions.IgnoreCase))
        {
            return [new OpeningHoursInterval("00:00", "23:59")];
        }

        var parts = Regex.Split(text, @"\s+to\s+", RegexOptions.IgnoreCase);
        if (parts.Length != 2) return null;

        var open = ParseTime(parts[0], parts[1]);
        var close = ParseTime(parts[1], parts[0]);
        if (open is null || close is null) return null;

        return [new OpeningHoursInterval(FormatHm(open.Value), FormatHm(close.Value))];
    }

    private static int? ParseTime(string value, string sibling)
    {
        var m = Regex.Match(value.Trim(), @"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", RegexOptions.IgnoreCase);
        if (!m.Success) return null;

        if (!int.TryParse(m.Groups[1].Value, out var hour)) return null;
        var minute = m.Groups[2].Success && int.TryParse(m.Groups[2].Value, out var min) ? min : 0;
        if (hour > 23 || minute > 59) return null;

        string? meridiem = m.Groups[3].Success ? m.Groups[3].Value.ToLowerInvariant() : null;
        if (string.IsNullOrEmpty(meridiem))
        {
            var sib = Regex.Match(sibling, "(am|pm)", RegexOptions.IgnoreCase);
            if (sib.Success) meridiem = sib.Groups[1].Value.ToLowerInvariant();
        }

        if (meridiem == "pm" && hour < 12) hour += 12;
        if (meridiem == "am" && hour == 12) hour = 0;

        return hour * 60 + minute;
    }

    private static string FormatHm(int minutes)
    {
        var h = (minutes / 60) % 24;
        var m = minutes % 60;
        return $"{h:D2}:{m:D2}";
    }
}
