namespace AqrabMakinaLeek.Application.Common.Interfaces;

public record EmailMessage(
    string To,
    string Subject,
    string BodyText,
    string? BodyHtml = null
);

public interface IEmailService
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
