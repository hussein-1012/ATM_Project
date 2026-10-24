using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Exceptions;

namespace AqrabMakinaLeek.WebApi.Middleware;

public record ErrorResponse(int StatusCode, string Code, string Message);

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        int statusCode = StatusCodes.Status500InternalServerError;
        string code = "INTERNAL_ERROR";
        string message = "Internal server error";

        if (exception is AppException appEx)
        {
            statusCode = appEx.StatusCode;
            code = appEx.Code;
            message = appEx.Message;

            if (appEx is ReportCooldownException cooldownEx)
            {
                context.Response.Headers["Retry-After"] = cooldownEx.RetryAfterSeconds.ToString();
            }
        }
        else if (exception is BadHttpRequestException badHttpEx)
        {
            statusCode = StatusCodes.Status400BadRequest;
            code = "VALIDATION_ERROR";
            message = badHttpEx.Message;
        }
        else
        {
            var reqId = context.Items["RequestId"] ?? "unknown";
            _logger.LogError(exception, "[ReqId: {RequestId}] Unhandled exception: {Message}", reqId, exception.Message);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = new ErrorResponse(statusCode, code, message);
        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
