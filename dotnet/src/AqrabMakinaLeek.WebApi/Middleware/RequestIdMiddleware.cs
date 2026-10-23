namespace AqrabMakinaLeek.WebApi.Middleware;

public class RequestIdMiddleware
{
    private const string RequestIdHeader = "X-Request-Id";
    private readonly RequestDelegate _next;

    public RequestIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(RequestIdHeader, out var requestId) || string.IsNullOrWhiteSpace(requestId))
        {
            requestId = Guid.NewGuid().ToString();
        }

        context.Items["RequestId"] = requestId.ToString();
        context.Response.Headers[RequestIdHeader] = requestId;

        await _next(context);
    }
}
