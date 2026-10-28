namespace AqrabMakinaLeek.Infrastructure.Email;

public class SendlibertyOptions
{
    public const string SectionName = "Sendliberty";

    /// <summary>
    /// API key from the Sendliberty dashboard.
    /// Set via Sendliberty__ApiKey in .env or environment.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Optional sender override ("Name &lt;email@gmail.com&gt;").
    /// Leave empty to use the default account connected on the Sendliberty dashboard.
    /// </summary>
    public string? From { get; set; }
}
