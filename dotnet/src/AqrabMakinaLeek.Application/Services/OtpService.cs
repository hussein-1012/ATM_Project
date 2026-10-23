using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;

namespace AqrabMakinaLeek.Application.Services;

public record OtpRecord(string Hash, int Attempts);

public class OtpService
{
    private readonly ICacheService _cache;
    private const int TtlSeconds = 600;
    private const int CooldownSeconds = 60;
    private const int MaxAttempts = 5;

    public OtpService(ICacheService cache)
    {
        _cache = cache;
    }

    private static string OtpKey(string email) => $"otp:{email.Trim().ToLowerInvariant()}";
    private static string CooldownKey(string email) => $"otp:cooldown:{email.Trim().ToLowerInvariant()}";

    private static string HashCode(string code)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(code));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task<(bool Sent, string? Code)> RequestAsync(string email, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var cooldown = await _cache.GetAsync(CooldownKey(normalizedEmail), ct);
        if (cooldown is not null)
        {
            return (false, null);
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var record = new OtpRecord(HashCode(code), 0);
        var json = JsonSerializer.Serialize(record);

        await _cache.SetAsync(OtpKey(normalizedEmail), json, TimeSpan.FromSeconds(TtlSeconds), ct);
        await _cache.SetAsync(CooldownKey(normalizedEmail), "1", TimeSpan.FromSeconds(CooldownSeconds), ct);

        return (true, code);
    }

    public async Task VerifyAsync(string email, string code, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var raw = await _cache.GetAsync(OtpKey(normalizedEmail), ct);
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw new UnauthorizedException("Invalid or expired OTP", "OTP_INVALID");
        }

        OtpRecord? record;
        try
        {
            record = JsonSerializer.Deserialize<OtpRecord>(raw);
            if (record is null) throw new InvalidOperationException();
        }
        catch
        {
            await _cache.DeleteAsync(ct, OtpKey(normalizedEmail));
            throw new UnauthorizedException("Invalid or expired OTP", "OTP_INVALID");
        }

        if (record.Attempts >= MaxAttempts)
        {
            await _cache.DeleteAsync(ct, OtpKey(normalizedEmail));
            throw new UnauthorizedException("Too many OTP attempts; request a new code", "OTP_MAX_ATTEMPTS");
        }

        if (record.Hash != HashCode(code))
        {
            var updated = record with { Attempts = record.Attempts + 1 };
            var remainingTtl = await _cache.GetTtlSecondsAsync(OtpKey(normalizedEmail), ct);
            var ttl = remainingTtl > 0 ? TimeSpan.FromSeconds(remainingTtl) : TimeSpan.FromSeconds(TtlSeconds);

            await _cache.SetAsync(OtpKey(normalizedEmail), JsonSerializer.Serialize(updated), ttl, ct);
            throw new UnauthorizedException("Invalid or expired OTP", "OTP_INVALID");
        }

        await _cache.DeleteAsync(ct, OtpKey(normalizedEmail), CooldownKey(normalizedEmail));
    }
}
