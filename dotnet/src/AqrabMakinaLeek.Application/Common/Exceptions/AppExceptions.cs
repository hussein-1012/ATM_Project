namespace AqrabMakinaLeek.Application.Common.Exceptions;

public abstract class AppException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }

    protected AppException(string message, string code, int statusCode) : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message = "Resource not found", string code = "NOT_FOUND")
        : base(message, code, 404)
    {
    }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Unauthorized", string code = "UNAUTHORIZED")
        : base(message, code, 401)
    {
    }
}

public class BadRequestException : AppException
{
    public BadRequestException(string message = "Bad request", string code = "BAD_REQUEST")
        : base(message, code, 400)
    {
    }
}

public class ConflictException : AppException
{
    public ConflictException(string message = "Conflict", string code = "CONFLICT")
        : base(message, code, 409)
    {
    }
}

public class ReportCooldownException : AppException
{
    public int RetryAfterSeconds { get; }

    public ReportCooldownException(int retryAfterSeconds)
        : base($"You can report this ATM again in {Math.Ceiling(retryAfterSeconds / 60.0)} min", "REPORT_COOLDOWN", 429)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}
