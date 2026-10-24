using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AqrabMakinaLeek.Infrastructure.Routing;

public class OrsRoutingProvider : IRoutingProvider
{
    private readonly HttpClient _httpClient;
    private readonly RoutingOptions _options;
    private readonly ILogger<OrsRoutingProvider> _logger;

    public OrsRoutingProvider(
        HttpClient httpClient,
        IOptions<RoutingOptions> options,
        ILogger<OrsRoutingProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public string Name => "ors";

    public async Task<RouteResult> RouteAsync(LatLng from, LatLng to, TravelMode mode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.OrsApiKey))
        {
            throw new InvalidOperationException("ORS: missing API key");
        }

        var profile = mode == TravelMode.Walk ? "foot-walking" : "driving-car";
        var baseUrl = _options.OrsUrl.TrimEnd('/');
        var url = $"{baseUrl}/v2/directions/{profile}/geojson";

        var payload = new
        {
            coordinates = new[]
            {
                new[] { from.Lng, from.Lat },
                new[] { to.Lng, to.Lat }
            }
        };

        var jsonPayload = JsonSerializer.Serialize(payload);
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("Authorization", _options.OrsApiKey);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(_options.TimeoutMs));

        using var response = await _httpClient.SendAsync(request, cts.Token);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"ORS request failed with status code {response.StatusCode}");
        }

        var json = await response.Content.ReadAsStringAsync(cts.Token);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("features", out var featuresElement) || featuresElement.GetArrayLength() == 0)
        {
            throw new InvalidOperationException("ORS: no features returned");
        }

        var feature = featuresElement[0];
        var geometry = feature.GetProperty("geometry");
        var coordsElement = geometry.GetProperty("coordinates");
        var coordinates = new List<double[]>();
        foreach (var coord in coordsElement.EnumerateArray())
        {
            coordinates.Add([coord[0].GetDouble(), coord[1].GetDouble()]);
        }

        if (coordinates.Count < 2)
        {
            throw new InvalidOperationException("ORS: malformed route geometry");
        }

        var properties = feature.GetProperty("properties");
        var summary = properties.GetProperty("summary");
        var distance = (int)Math.Round(summary.GetProperty("distance").GetDouble());
        var duration = (int)Math.Round(summary.GetProperty("duration").GetDouble());

        var steps = new List<RouteStep>();
        if (properties.TryGetProperty("segments", out var segmentsElement) && segmentsElement.GetArrayLength() > 0)
        {
            var firstSegment = segmentsElement[0];
            if (firstSegment.TryGetProperty("steps", out var stepsElement))
            {
                foreach (var step in stepsElement.EnumerateArray())
                {
                    steps.Add(ParseStep(step, coordinates));
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

    private static RouteStep ParseStep(JsonElement step, List<double[]> coordinates)
    {
        var distance = step.TryGetProperty("distance", out var dist) ? (int)Math.Round(dist.GetDouble()) : 0;
        var duration = step.TryGetProperty("duration", out var dur) ? (int)Math.Round(dur.GetDouble()) : 0;
        var streetName = step.TryGetProperty("name", out var nameProp) && !string.IsNullOrWhiteSpace(nameProp.GetString())
            ? nameProp.GetString()
            : null;

        var instructionType = step.TryGetProperty("type", out var typeProp) ? typeProp.GetInt32() : -1;

        double lat = 0;
        double lng = 0;
        if (step.TryGetProperty("way_points", out var waypoints) && waypoints.GetArrayLength() > 0)
        {
            var index = waypoints[0].GetInt32();
            if (index >= 0 && index < coordinates.Count)
            {
                lng = coordinates[index][0];
                lat = coordinates[index][1];
            }
        }

        return new RouteStep(
            MapInstruction(instructionType),
            streetName,
            distance,
            duration,
            new LatLng(lat, lng));
    }

    private static Maneuver MapInstruction(int type)
    {
        return type switch
        {
            0 or 2 => Maneuver.TURN_LEFT,
            1 or 3 => Maneuver.TURN_RIGHT,
            4 => Maneuver.SLIGHT_LEFT,
            5 => Maneuver.SLIGHT_RIGHT,
            9 => Maneuver.UTURN,
            10 => Maneuver.ARRIVE,
            11 => Maneuver.DEPART,
            _ => Maneuver.STRAIGHT
        };
    }
}
