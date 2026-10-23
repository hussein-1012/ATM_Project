using System.Text.RegularExpressions;

namespace AqrabMakinaLeek.Domain.Utilities;

public static partial class ArabicNormalizeUtil
{
    // Harakat/tashkeel: fathatan..superscript alef (U+064B..U+0652), superscript alef (U+0670), Quranic marks U+06D6..U+06ED
    private static readonly Regex DiacriticsRegex = new(@"[\u064B-\u0652\u0670\u06D6-\u06ED]", RegexOptions.Compiled);
    private static readonly Regex TatweelRegex = new(@"ـ", RegexOptions.Compiled);
    private static readonly Regex MultipleSpacesRegex = new(@"\s+", RegexOptions.Compiled);

    private static readonly Dictionary<char, char> LetterMap = new()
    {
        ['أ'] = 'ا',
        ['إ'] = 'ا',
        ['آ'] = 'ا',
        ['ٱ'] = 'ا',
        ['ة'] = 'ه',
        ['ى'] = 'ي',
        ['ؤ'] = 'و',
        ['ئ'] = 'ي',
    };

    /// <summary>
    /// Lowercase, strip diacritics/tatweel, unify Arabic letter variants, collapse whitespace.
    /// </summary>
    public static string NormalizeArabic(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var lower = input.ToLowerInvariant();
        var withoutDiacritics = DiacriticsRegex.Replace(lower, string.Empty);
        var withoutTatweel = TatweelRegex.Replace(withoutDiacritics, string.Empty);

        var chars = withoutTatweel.ToCharArray();
        for (int i = 0; i < chars.Length; i++)
        {
            if (LetterMap.TryGetValue(chars[i], out var mapped))
            {
                chars[i] = mapped;
            }
        }

        var normalizedLetters = new string(chars);
        return MultipleSpacesRegex.Replace(normalizedLetters, " ").Trim();
    }

    /// <summary>
    /// Build the denormalized search blob stored on the Atm row.
    /// Combines name + address + bank label so a single substring/text query covers all three.
    /// </summary>
    public static string BuildSearchText(IEnumerable<string?> parts)
    {
        var validParts = parts.Where(p => !string.IsNullOrWhiteSpace(p));
        return NormalizeArabic(string.Join(" ", validParts));
    }
}
