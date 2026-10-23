using AqrabMakinaLeek.Domain.Utilities;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Utilities;

public class ArabicNormalizeUtilTests
{
    [Fact]
    public void NormalizeArabic_ShouldLowercaseLatinText()
    {
        ArabicNormalizeUtil.NormalizeArabic("NBE ATM").Should().Be("nbe atm");
    }

    [Fact]
    public void NormalizeArabic_ShouldUnifyAlefVariants()
    {
        ArabicNormalizeUtil.NormalizeArabic("البنك الأهلي").Should().Be("البنك الاهلي");
        ArabicNormalizeUtil.NormalizeArabic("إطسا").Should().Be("اطسا");
        ArabicNormalizeUtil.NormalizeArabic("آدم").Should().Be("ادم");
    }

    [Fact]
    public void NormalizeArabic_ShouldMapTaaMarbutaAndYaa()
    {
        ArabicNormalizeUtil.NormalizeArabic("مدينة").Should().Be("مدينه");
        ArabicNormalizeUtil.NormalizeArabic("مصطفى").Should().Be("مصطفي");
    }

    [Fact]
    public void NormalizeArabic_ShouldStripHarakatAndTatweel()
    {
        ArabicNormalizeUtil.NormalizeArabic("مَكْتَبَة").Should().Be("مكتبه");
        ArabicNormalizeUtil.NormalizeArabic("مـكـتـب").Should().Be("مكتب");
    }

    [Fact]
    public void NormalizeArabic_ShouldCollapseWhitespaceAndTrim()
    {
        ArabicNormalizeUtil.NormalizeArabic("  بنك   مصر  ").Should().Be("بنك مصر");
    }

    [Fact]
    public void NormalizeArabic_ShouldKeepMixedArabicAndLatin()
    {
        ArabicNormalizeUtil.NormalizeArabic("QNB فرع الفيوم").Should().Be("qnb فرع الفيوم");
    }

    [Fact]
    public void BuildSearchText_ShouldJoinNonEmptyPartsWithNormalization()
    {
        var parts = new string?[] { "NBE ATM", null, "بنك الأهلي", null, "" };
        ArabicNormalizeUtil.BuildSearchText(parts).Should().Be("nbe atm بنك الاهلي");
    }

    [Fact]
    public void BuildSearchText_ShouldReturnEmptyWhenNothingToJoin()
    {
        var parts = new string?[] { null, null };
        ArabicNormalizeUtil.BuildSearchText(parts).Should().Be(string.Empty);
    }
}
