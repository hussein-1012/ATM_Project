using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AqrabMakinaLeek.Infrastructure.Email;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _httpClient;
    private readonly EmailOptions _options;
    private readonly ILogger<ResendEmailService> _logger;

    public ResendEmailService(
        HttpClient httpClient,
        IOptions<EmailOptions> options,
        ILogger<ResendEmailService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        try
        {
            var requestPayload = new
            {
                from = _options.From,
                to = new[] { message.To },
                subject = message.Subject,
                text = message.BodyText,
                html = message.BodyHtml
            };

            var json = JsonSerializer.Serialize(requestPayload);
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

            var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Failed to send email via Resend API: {StatusCode} {Body}", response.StatusCode, responseBody);
                throw new InvalidOperationException($"Resend API error: {response.StatusCode} - {responseBody}");
            }

            _logger.LogInformation("Email sent successfully to {To} via Resend", message.To);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while sending email to {To} via Resend", message.To);
            throw;
        }
    }
}
