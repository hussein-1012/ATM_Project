using System.Security.Claims;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    string GenerateAccessToken(string userId, string email);
    string GenerateResetToken(string userId, string email);
    ClaimsPrincipal? ValidateToken(string token, string expectedType);
}
