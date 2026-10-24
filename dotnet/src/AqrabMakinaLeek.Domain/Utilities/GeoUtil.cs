using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.Domain.Utilities;

public static class GeoUtil
{
    private const double EarthRadiusMeters = 6371008.8;

    // Egypt geographic bounding box
    public const double EgyptMinLat = 21.9;
    public const double EgyptMaxLat = 31.8;
    public const double EgyptMinLng = 24.6;
    public const double EgyptMaxLng = 37.1;

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    /// <summary>
    /// Great-circle distance between two points in meters using the Haversine formula.
    /// </summary>
    public static double HaversineMeters(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var rLat1 = ToRadians(lat1);
        var rLat2 = ToRadians(lat2);

        var h = Math.Pow(Math.Sin(dLat / 2.0), 2) +
                Math.Cos(rLat1) * Math.Cos(rLat2) * Math.Pow(Math.Sin(dLng / 2.0), 2);

        return 2.0 * EarthRadiusMeters * Math.Asin(Math.Min(1.0, Math.Sqrt(h)));
    }

    public static double HaversineMeters(GeoPoint a, GeoPoint b)
        => HaversineMeters(a.Latitude, a.Longitude, b.Latitude, b.Longitude);

    public static bool IsValidLatLng(double lat, double lng)
        => !double.IsNaN(lat) && !double.IsInfinity(lat) &&
           !double.IsNaN(lng) && !double.IsInfinity(lng) &&
           lat >= -90.0 && lat <= 90.0 &&
           lng >= -180.0 && lng <= 180.0;

    public static bool IsInEgypt(double lat, double lng)
        => IsValidLatLng(lat, lng) &&
           lat >= EgyptMinLat && lat <= EgyptMaxLat &&
           lng >= EgyptMinLng && lng <= EgyptMaxLng;

    /// <summary>
    /// Round a coordinate to 4 decimal places (~11 meters) for stable cache keys.
    /// </summary>
    public static double RoundCoord(double val, int decimals = 4)
    {
        var factor = Math.Pow(10, decimals);
        return Math.Round(val * factor) / factor;
    }
}
