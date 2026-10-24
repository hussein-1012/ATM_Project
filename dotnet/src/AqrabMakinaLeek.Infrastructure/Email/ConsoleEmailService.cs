using AqrabMakinaLeek.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace AqrabMakinaLeek.Infrastructure.Email;

public class ConsoleEmailService : IEmailService
{
    private readonly ILogger<ConsoleEmailService> _logger;

    public ConsoleEmailService(ILogger<ConsoleEmailService> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "[DEV MAILER] To: {To} | Subject: {Subject} | Body: {Body}",
            message.To,
            message.Subject,
            message.BodyText);

        return Task.CompletedTask;
    }
}
