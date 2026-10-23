namespace AqrabMakinaLeek.Domain.ValueObjects;

public record GeoPoint(double Longitude, double Latitude)
{
    public string Type { get; init; } = "Point";
    public double[] Coordinates { get; init; } = [Longitude, Latitude];

    public static GeoPoint FromLngLat(double longitude, double latitude) => new(longitude, latitude);
}
