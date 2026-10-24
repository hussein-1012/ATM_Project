using System.Text.Json.Serialization;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Common.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Maneuver
{
    DEPART,
    STRAIGHT,
    TURN_LEFT,
    TURN_RIGHT,
    SLIGHT_LEFT,
    SLIGHT_RIGHT,
    UTURN,
    ARRIVE
}

public record LatLng(double Lat, double Lng);

public record RouteStep(
    Maneuver Maneuver,
    string? StreetName,
    int DistanceMeters,
    int DurationSeconds,
    LatLng Location
);

public record RouteGeometry(
    string Type,
    List<double[]> Coordinates
);

public record RouteResult(
    int DistanceMeters,
    int DurationSeconds,
    bool Approximate,
    RouteGeometry Polyline,
    List<RouteStep> Steps
);
