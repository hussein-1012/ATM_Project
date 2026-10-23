using System.Security.Claims;
using AqrabMakinaLeek.Application.Common.Exceptions;

namespace AqrabMakinaLeek.WebApi.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst("sub")?.Value;
    }

    public static string GetRequiredUserId(this ClaimsPrincipal principal)
    {
        return principal.GetUserId()
            ?? throw new UnauthorizedException("User identity missing from token", "UNAUTHORIZED");
    }
}
