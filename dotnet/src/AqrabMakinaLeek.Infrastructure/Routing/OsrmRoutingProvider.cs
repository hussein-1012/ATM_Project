using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AqrabMakinaLeek.Infrastructure.Routing;

public class OsrmRoutingProvider : IRoutingProvider
{
    private readonly HttpClient _httpClient;
    private readonly RoutingOptions _options;
    private readonly ILogger<OsrmRoutingProvider> _logger;

    public OsrmRoutingProvider(
        HttpClient httpClient,
        IOptions<RoutingOptions> options,
        ILogger<OsrmRoutingProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public string Name => "osrm";

    public async Task<RouteResult> RouteAsync(LatLng from, LatLng to, TravelMode mode, CancellationToken ct = default)
    {
        var profile = mode == TravelMode.Walk ? "foot" : "driving";
        var baseUrl = _options.OsrmUrl.TrimEnd('/');
        var coords = $"{from.Lng},{from.Lat};{to.Lng},{to.Lat}";
        var url = $"{baseUrl}/route/v1/{profile}/{coords}?overview=full&geometries=geojson&steps=true";

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(_options.TimeoutMs));

        using var response = await _httpClient.GetAsync(url, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"OSRM request failed with status code {response.StatusCode}");
        }

        var json = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("routes", out var routesElement) || routesElement.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("OSRM: no routes found");
        }

        var route = routesElement[0];
        var distance = (int)Math.Round(route.GetProperty("distance").GetDouble());
        var duration = (int)Math.Round(route.GetProperty("duration").GetDouble());

        var geometryElement = route.GetProperty("geometry");
        var coordsElement = geometryElement.GetProperty("coordinates");
        var coordinates = new List<double[]>();
        foreach (var coord in coordsElement.EnumerateArray())
        {
            coordinates.Add([coord[0].GetDouble(), coord[1].GetDouble()]);
        }

        if (coordinates.Count < 2)
        {
            throw new InvalidOperationException("OSRM: malformed route geometry");
        }

        var steps = new List<RouteStep>();
        if (route.TryGetProperty("legs", out var legsElement) && legsElement.GetArrayLength() > 0)
        {
            var firstLeg = legsElement[0];
            if (firstLeg.TryGetProperty("steps", out var stepsElement))
            {
                foreach (var step in stepsElement.EnumerateArray())
                {
                    steps.Add(ParseStep(step));
                }
            }
        }

        return new RouteResult(
            distance,
            duration,
            Approximate: false,
            new RouteGeometry("LineString", coordinates),
            steps);
    }

    private static RouteStep ParseStep(JsonElement step)
    {
        var distance = step.TryGetProperty("distance", out var dist) ? (int)Math.Round(dist.GetDouble()) : 0;
        var duration = step.TryGetProperty("duration", out var dur) ? (int)Math.Round(dur.GetDouble()) : 0;
        var streetName = step.TryGetProperty("name", out var nameProp) && !string.IsNullOrWhiteSpace(nameProp.GetString())
            ? nameProp.GetString()
            : null;

        string? maneuverType = null;
        string? modifier = null;
        double lat = 0;
        double lng = 0;

        if (step.TryGetProperty("maneuver", out var maneuverElem))
        {
            if (maneuverElem.TryGetProperty("type", out var typeProp)) maneuverType = typeProp.GetString();
            if (maneuverElem.TryGetProperty("modifier", out var modProp)) modifier = modProp.GetString();
            if (maneuverElem.TryGetProperty("location", out var locElem) && locElem.GetArrayLength() >= 2)
            {
                lng = locElem[0].GetDouble();
                lat = locElem[1].GetDouble();
            }
        }

        return new RouteStep(
            ToManeuver(maneuverType, modifier),
            streetName,
            distance,
            duration,
            new LatLng(lat, lng));
    }

    private static Maneuver ToManeuver(string? type, string? modifier)
    {
        if (type == "depart") return Maneuver.DEPART;
        if (type == "arrive") return Maneuver.ARRIVE;

        return modifier switch
        {
            "left" or "sharp left" => Maneuver.TURN_LEFT,
            "right" or "sharp right" => Maneuver.TURN_RIGHT,
            "slight left" => Maneuver.SLIGHT_LEFT,
            "slight right" => Maneuver.SLIGHT_RIGHT,
            "uturn" => Maneuver.UTURN,
            _ => Maneuver.STRAIGHT
        };
    }
}
