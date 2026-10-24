using System.Security.Claims;
using AqrabMakinaLeek.Infrastructure.Security;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Security;

public class SecurityTests
{
    private readonly Argon2PasswordHasher _hasher = new();
    private readonly JwtTokenGenerator _jwtGenerator;

    public SecurityTests()
    {
        var options = Options.Create(new JwtOptions
        {
            AccessSecret = "super-secret-test-key-must-be-long-enough-for-hmac256!",
            AccessTtl = "15m",
            ResetTtl = "10m"
        });
        _jwtGenerator = new JwtTokenGenerator(options);
    }

    [Fact]
    public void Argon2Hasher_HashesAndVerifiesPassword()
    {
        var password = "SuperSecretPassword123!";
        var hash = _hasher.Hash(password);

        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().Contain("$argon2id$");

        _hasher.Verify(hash, password).Should().BeTrue();
        _hasher.Verify(hash, "WrongPassword").Should().BeFalse();
    }

    [Fact]
    public void JwtGenerator_CreatesAndValidatesAccessToken()
    {
        var userId = "64f1a2b3c4d5e6f7a8b9c0d1";
        var email = "test@example.com";

        var token = _jwtGenerator.GenerateAccessToken(userId, email);
        token.Should().NotBeNullOrWhiteSpace();

        var principal = _jwtGenerator.ValidateToken(token, "access");
        principal.Should().NotBeNull();
        principal!.FindFirst(ClaimTypes.NameIdentifier)?.Value.Should().Be(userId);
        principal.FindFirst("type")?.Value.Should().Be("access");
    }

    [Fact]
    public void JwtGenerator_RejectsResetTokenWhenExpectingAccessToken()
    {
        var userId = "64f1a2b3c4d5e6f7a8b9c0d1";
        var email = "test@example.com";

        var resetToken = _jwtGenerator.GenerateResetToken(userId, email);
        resetToken.Should().NotBeNullOrWhiteSpace();

        // Attempting to validate reset token as access token should fail
        var accessPrincipal = _jwtGenerator.ValidateToken(resetToken, "access");
        accessPrincipal.Should().BeNull();

        // Validating as reset should succeed
        var resetPrincipal = _jwtGenerator.ValidateToken(resetToken, "reset");
        resetPrincipal.Should().NotBeNull();
        resetPrincipal!.FindFirst(ClaimTypes.NameIdentifier)?.Value.Should().Be(userId);
    }

    [Fact]
    public void JwtGenerator_RejectsTamperedToken()
    {
        var token = _jwtGenerator.GenerateAccessToken("123", "test@example.com");
        var tampered = token[..^5] + "XXXXX";

        var result = _jwtGenerator.ValidateToken(tampered, "access");
        result.Should().BeNull();
    }
}
