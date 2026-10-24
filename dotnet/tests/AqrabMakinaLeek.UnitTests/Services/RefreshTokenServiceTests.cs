using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Services;

public class RefreshTokenServiceTests
{
    private class InMemoryRefreshTokenRepo : IRefreshTokenRepository
    {
        public readonly List<RefreshToken> Tokens = [];

        public Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default)
            => Task.FromResult(Tokens.FirstOrDefault(t => t.TokenHash == tokenHash));

        public Task InsertAsync(RefreshToken token, CancellationToken ct = default)
        {
            token.Id = Guid.NewGuid().ToString();
            Tokens.Add(token);
            return Task.CompletedTask;
        }

        public Task RevokeByIdAsync(string id, CancellationToken ct = default)
        {
            var found = Tokens.FirstOrDefault(t => t.Id == id);
            if (found is not null) found.RevokedAt = DateTime.UtcNow;
            return Task.CompletedTask;
        }

        public Task RevokeFamilyAsync(string familyId, CancellationToken ct = default)
        {
            foreach (var t in Tokens.Where(t => t.FamilyId == familyId && !t.RevokedAt.HasValue))
                t.RevokedAt = DateTime.UtcNow;
            return Task.CompletedTask;
        }

        public Task RevokeAllUserTokensAsync(string userId, CancellationToken ct = default)
        {
            foreach (var t in Tokens.Where(t => t.UserId == userId && !t.RevokedAt.HasValue))
                t.RevokedAt = DateTime.UtcNow;
            return Task.CompletedTask;
        }
    }

    private readonly InMemoryRefreshTokenRepo _repo = new();
    private readonly RefreshTokenService _service;

    public RefreshTokenServiceTests()
    {
        _service = new RefreshTokenService(_repo);
    }

    [Fact]
    public async Task IssueAsync_CreatesNewTokenRecord()
    {
        var (rawToken, entity) = await _service.IssueAsync("user123", "Chrome / Win");

        rawToken.Should().NotBeNullOrWhiteSpace();
        entity.UserId.Should().Be("user123");
        entity.DeviceInfo.Should().Be("Chrome / Win");
        entity.RevokedAt.Should().BeNull();
        _repo.Tokens.Should().ContainSingle();
    }

    [Fact]
    public async Task RotateAsync_RevokesOldToken_AndIssuesNewInSameFamily()
    {
        var (originalToken, originalEntity) = await _service.IssueAsync("user123");

        var (rotatedToken, userId) = await _service.RotateAsync(originalToken);

        rotatedToken.Should().NotBe(originalToken);
        userId.Should().Be("user123");

        originalEntity.RevokedAt.Should().NotBeNull();
        _repo.Tokens.Should().HaveCount(2);
        _repo.Tokens[1].FamilyId.Should().Be(originalEntity.FamilyId);
        _repo.Tokens[1].RevokedAt.Should().BeNull();
    }

    [Fact]
    public async Task RotateAsync_DetectsReuse_AndRevokesEntireFamily()
    {
        var (originalToken, _) = await _service.IssueAsync("user123");

        // Legitimate rotation
        var (secondToken, _) = await _service.RotateAsync(originalToken);

        // Attacker attempts to replay originalToken
        var act = async () => await _service.RotateAsync(originalToken);

        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("*Refresh token reuse detected*");

        // The entire family should now be revoked, including secondToken
        _repo.Tokens.Should().AllSatisfy(t => t.RevokedAt.Should().NotBeNull());

        // Attempting to use secondToken now fails
        var act2 = async () => await _service.RotateAsync(secondToken);
        await act2.Should().ThrowAsync<UnauthorizedException>();
    }
}
