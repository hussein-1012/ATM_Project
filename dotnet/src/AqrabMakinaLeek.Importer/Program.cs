using AqrabMakinaLeek.Importer.Services;
using AqrabMakinaLeek.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

Console.WriteLine("==================================================");
Console.WriteLine("Aqrab Makina Leek — ATM Dataset Importer Engine");
Console.WriteLine("==================================================");

var filePath = "data/atms.json";
if (!File.Exists(filePath))
{
    var altPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "data", "atms.json");
    if (File.Exists(altPath)) filePath = Path.GetFullPath(altPath);
}

var source = "google_places";
var dryRun = false;

for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--file" && i + 1 < args.Length) filePath = args[++i];
    else if (args[i] == "--source" && i + 1 < args.Length) source = args[++i];
    else if (args[i] == "--dry-run") dryRun = true;
}

Console.WriteLine($"File:    {filePath}");
Console.WriteLine($"Source:  {source}");
Console.WriteLine($"Dry-Run: {dryRun}");
Console.WriteLine();

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<AtmImportService>();

var host = builder.Build();
var importer = host.Services.GetRequiredService<AtmImportService>();

try
{
    var summary = await importer.ImportFileAsync(filePath, source, dryRun);

    Console.WriteLine("---------------- Import Summary ----------------");
    Console.WriteLine($"Total Records:       {summary.Total}");
    Console.WriteLine($"Valid (Upserted):    {summary.Inserted}");
    Console.WriteLine($"Skipped:             {summary.Skipped}");
    foreach (var (reason, count) in summary.SkippedByReason)
    {
        Console.WriteLine($"  - {reason}: {count}");
    }
    Console.WriteLine($"Near-Duplicates (<15m): {summary.Duplicates.Count}");
    Console.WriteLine("------------------------------------------------");
    Console.WriteLine("Import completed successfully!");
}
catch (Exception ex)
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"Error during import: {ex.Message}");
    Console.ResetColor();
    return 1;
}

return 0;
