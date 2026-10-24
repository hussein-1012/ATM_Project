using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Infrastructure.Email;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AqrabMakinaLeek.UnitTests.Email;

public class EmailServiceTests
{
    [Fact]
    public async Task ConsoleEmailService_LogsWithoutThrowing()
    {
        var logger = NullLogger<ConsoleEmailService>.Instance;
        var service = new ConsoleEmailService(logger);

        var message = new EmailMessage(
            "test@example.com",
            "Test Subject",
            "Hello world plaintext",
            "<p>Hello world html</p>"
        );

        var act = async () => await service.SendAsync(message);

        await act.Should().NotThrowAsync();
    }
}
