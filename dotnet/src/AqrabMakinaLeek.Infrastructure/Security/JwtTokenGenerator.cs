using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Utilities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AqrabMakinaLeek.Infrastructure.Security;

public class JwtTokenGenerator : IJwtTokenGenerator
{
    private readonly JwtOptions _options;
    private readonly JwtSecurityTokenHandler _tokenHandler = new();

    public JwtTokenGenerator(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public string GenerateAccessToken(string userId, string email)
    {
        var ttl = DurationParser.Parse(_options.AccessTtl, TimeSpan.FromMinutes(15));
        return CreateToken(userId, email, "access", ttl);
    }

    public string GenerateResetToken(string userId, string email)
    {
        var ttl = DurationParser.Parse(_options.ResetTtl, TimeSpan.FromMinutes(10));
        return CreateToken(userId, email, "reset", ttl);
    }

    public ClaimsPrincipal? ValidateToken(string token, string expectedType)
    {
        try
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.AccessSecret));
            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.FromSeconds(5)
            };

            var principal = _tokenHandler.ValidateToken(token, parameters, out var securityToken);
            if (securityToken is not JwtSecurityToken jwtToken ||
                !jwtToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return null;
            }

            var typeClaim = principal.FindFirst("type")?.Value;
            if (typeClaim != expectedType)
            {
                return null;
            }

            return principal;
        }
        catch
        {
            return null;
        }
    }

    private string CreateToken(string userId, string email, string tokenType, TimeSpan ttl)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.AccessSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId),
            new(JwtRegisteredClaimNames.Email, email),
            new("type", tokenType),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.Add(ttl),
            SigningCredentials = credentials
        };

        var token = _tokenHandler.CreateToken(tokenDescriptor);
        return _tokenHandler.WriteToken(token);
    }
}
