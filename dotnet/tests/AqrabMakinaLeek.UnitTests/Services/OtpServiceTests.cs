using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.Infrastructure.Caching;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Services;

public class OtpServiceTests
{
    private readonly InMemoryCacheService _cache = new();
    private readonly OtpService _service;

    public OtpServiceTests()
    {
        _service = new OtpService(_cache);
    }

    [Fact]
    public async Task RequestAsync_GeneratesSixDigitCode_AndEnforcesCooldown()
    {
        var email = "User@Example.com";
        var (sent1, code1) = await _service.RequestAsync(email);

        sent1.Should().BeTrue();
        code1.Should().NotBeNullOrWhiteSpace();
        code1!.Length.Should().Be(6);

        // Immediate subsequent request hits 60s cooldown
        var (sent2, code2) = await _service.RequestAsync(email);
        sent2.Should().BeFalse();
        code2.Should().BeNull();
    }

    [Fact]
    public async Task VerifyAsync_SucceedsWithCorrectCode()
    {
        var email = "test@example.com";
        var (_, code) = await _service.RequestAsync(email);

        var act = async () => await _service.VerifyAsync(email, code!);
        await act.Should().NotThrowAsync();

        // Second verification should fail as OTP is consumed
        var act2 = async () => await _service.VerifyAsync(email, code!);
        await act2.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Invalid or expired OTP*");
    }

    [Fact]
    public async Task VerifyAsync_LocksOutAfterMaxAttempts()
    {
        var email = "locked@example.com";
        var (_, code) = await _service.RequestAsync(email);

        // Fail 5 times
        for (int i = 0; i < 5; i++)
        {
            var act = async () => await _service.VerifyAsync(email, "000000");
            await act.Should().ThrowAsync<UnauthorizedException>()
                .WithMessage("*Invalid or expired OTP*");
        }

        // Subsequent attempt triggers lockout
        var finalAct = async () => await _service.VerifyAsync(email, "000000");
        await finalAct.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Too many OTP attempts*");
    }
}
