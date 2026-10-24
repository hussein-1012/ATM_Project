using System.Text.Json.Serialization;

namespace AqrabMakinaLeek.Importer.Services;

public class RawAtmLocation
{
    [JsonPropertyName("lat")]
    public double? Lat { get; set; }

    [JsonPropertyName("lng")]
    public double? Lng { get; set; }
}

public class RawAtmOpeningHours
{
    [JsonPropertyName("day")]
    public string? Day { get; set; }

    [JsonPropertyName("hours")]
    public string? Hours { get; set; }
}

public class RawAtmRecord
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("street")]
    public string? Street { get; set; }

    [JsonPropertyName("neighborhood")]
    public string? Neighborhood { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("state")]
    public string? State { get; set; }

    [JsonPropertyName("countryCode")]
    public string? CountryCode { get; set; }

    [JsonPropertyName("location")]
    public RawAtmLocation? Location { get; set; }

    [JsonPropertyName("categories")]
    public List<string>? Categories { get; set; }

    [JsonPropertyName("openingHours")]
    public List<RawAtmOpeningHours>? OpeningHours { get; set; }

    [JsonPropertyName("placeId")]
    public string? PlaceId { get; set; }

    [JsonPropertyName("permanentlyClosed")]
    public bool? PermanentlyClosed { get; set; }

    [JsonPropertyName("temporarilyClosed")]
    public bool? TemporarilyClosed { get; set; }

    [JsonPropertyName("scrapedAt")]
    public string? ScrapedAt { get; set; }
}
