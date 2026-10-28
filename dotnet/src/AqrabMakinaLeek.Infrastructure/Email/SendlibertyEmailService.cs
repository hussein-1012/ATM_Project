using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AqrabMakinaLeek.Infrastructure.Email;

/// <summary>
/// Sends transactional emails through the Sendliberty REST API.
/// Endpoint: POST https://sendliberty.com/api/send
/// Auth:     Authorization: Bearer {ApiKey}
/// Docs:     https://sendliberty.com/docs
/// </summary>
public class SendlibertyEmailService : IEmailService
{
    private const string ApiEndpoint = "https://sendliberty.com/api/send";

    private readonly HttpClient _http;
    private readonly SendlibertyOptions _options;
    private readonly ILogger<SendlibertyEmailService> _logger;

    public SendlibertyEmailService(
        HttpClient http,
        IOptions<SendlibertyOptions> options,
        ILogger<SendlibertyEmailService> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning("Sendliberty API key is not configured. Email to {To} was NOT sent.", message.To);
            return;
        }

        // Build the JSON payload exactly as documented:
        // { from?, to, subject, html, text? }
        var payload = new Dictionary<string, object?>
        {
            ["to"]      = message.To,
            ["subject"] = message.Subject,
            ["html"]    = message.BodyHtml,
        };

        // Only include "text" when provided
        if (!string.IsNullOrWhiteSpace(message.BodyText))
            payload["text"] = message.BodyText;

        // "from" is optional on Sendliberty when you have exactly one sender account
        if (!string.IsNullOrWhiteSpace(_options.From))
            payload["from"] = _options.From;

        var json = JsonSerializer.Serialize(payload);

        using var request = new HttpRequestMessage(HttpMethod.Post, ApiEndpoint)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HTTP error while sending email via Sendliberty to {To}", message.To);
            throw;
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError(
                "Sendliberty API returned {Status} for email to {To}. Response: {Body}",
                (int)response.StatusCode, message.To, body);
            throw new InvalidOperationException(
                $"Sendliberty API error {(int)response.StatusCode}: {body}");
        }

        _logger.LogInformation("Email sent via Sendliberty to {To} — Subject: {Subject}", message.To, message.Subject);
    }
}
