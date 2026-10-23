namespace AqrabMakinaLeek.Infrastructure.Email;

public class EmailOptions
{
    public const string SectionName = "Resend";

    public string ApiKey { get; set; } = string.Empty;
    public string From { get; set; } = "Aqrab Makina Leek <onboarding@resend.dev>";
}
