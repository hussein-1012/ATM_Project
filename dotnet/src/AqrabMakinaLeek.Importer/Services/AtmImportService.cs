using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Utilities;

namespace AqrabMakinaLeek.Importer.Services;

public record DuplicatePair(
    string Bank,
    double DistanceMeters,
    string NameA,
    double LatA,
    double LngA,
    string NameB,
    double LatB,
    double LngB
);

public class ImportSummary
{
    public string File { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public bool DryRun { get; set; }
    public string SourceFetchedAt { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public Dictionary<SkipReason, int> SkippedByReason { get; set; } = new();
    public List<DuplicatePair> Duplicates { get; set; } = [];
}

public class AtmImportService
{
    private const double NearDuplicateMeters = 15.0;
    private const int BatchSize = 500;

    private readonly IAtmRepository _atmRepo;

    public AtmImportService(IAtmRepository atmRepo)
    {
        _atmRepo = atmRepo;
    }

    public async Task<ImportSummary> ImportFileAsync(
        string filePath,
        string source = "google_places",
        bool dryRun = false,
        CancellationToken ct = default)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"Import file not found at: {filePath}");
        }

        var json = await File.ReadAllTextAsync(filePath, ct);
        using var jsonDoc = JsonDocument.Parse(json);

        List<RawAtmRecord> rawRecords = [];
        DateTime sourceFetchedAt;

        if (jsonDoc.RootElement.ValueKind == JsonValueKind.Array)
        {
            rawRecords = JsonSerializer.Deserialize<List<RawAtmRecord>>(json) ?? [];
            sourceFetchedAt = File.GetLastWriteTimeUtc(filePath);
        }
        else
        {
            if (jsonDoc.RootElement.TryGetProperty("records", out var recordsElem))
            {
                rawRecords = JsonSerializer.Deserialize<List<RawAtmRecord>>(recordsElem.GetRawText()) ?? [];
            }

            if (jsonDoc.RootElement.TryGetProperty("fetchedAt", out var fetchedAtElem) &&
                DateTime.TryParse(fetchedAtElem.GetString(), out var parsedFetchedAt))
            {
                sourceFetchedAt = parsedFetchedAt.ToUniversalTime();
            }
            else
            {
                sourceFetchedAt = File.GetLastWriteTimeUtc(filePath);
            }
        }

        var mapper = new AtmJsonMapper(source);
        var summary = new ImportSummary
        {
            File = filePath,
            Source = source,
            DryRun = dryRun,
            SourceFetchedAt = sourceFetchedAt.ToString("o"),
            Total = rawRecords.Count
        };

        var validAtms = new List<Atm>();

        foreach (var raw in rawRecords)
        {
            var result = mapper.Map(raw);
            if (result.Ok && result.Value is not null)
            {
                result.Value.SourceFetchedAt = sourceFetchedAt;
                validAtms.Add(result.Value);
            }
            else
            {
                summary.Skipped++;
                var reason = result.Reason ?? SkipReason.INVALID_RECORD;
                summary.SkippedByReason[reason] = summary.SkippedByReason.GetValueOrDefault(reason) + 1;
            }
        }

        summary.Duplicates = FindNearDuplicates(validAtms);

        if (!dryRun)
        {
            for (int i = 0; i < validAtms.Count; i += BatchSize)
            {
                var batch = validAtms.Skip(i).Take(BatchSize).ToList();
                await _atmRepo.UpsertManyAsync(batch, ct);
            }

            summary.Inserted = validAtms.Count;
        }

        return summary;
    }

    private static List<DuplicatePair> FindNearDuplicates(List<Atm> atms)
    {
        var duplicates = new List<DuplicatePair>();

        for (int i = 0; i < atms.Count; i++)
        {
            for (int j = i + 1; j < atms.Count; j++)
            {
                var a = atms[i];
                var b = atms[j];

                if (a.Bank != b.Bank) continue;

                var dist = GeoUtil.HaversineMeters(
                    a.Location.Latitude,
                    a.Location.Longitude,
                    b.Location.Latitude,
                    b.Location.Longitude);

                if (dist <= NearDuplicateMeters)
                {
                    duplicates.Add(new DuplicatePair(
                        a.Bank.ToString(),
                        Math.Round(dist, 1),
                        a.Name,
                        a.Location.Latitude,
                        a.Location.Longitude,
                        b.Name,
                        b.Location.Latitude,
                        b.Location.Longitude));
                }
            }
        }

        return duplicates;
    }
}
