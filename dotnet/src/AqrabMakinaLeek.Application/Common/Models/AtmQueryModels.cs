using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Common.Models;

public record AtmWithDistance(
    Atm Atm,
    double? DistanceMeters = null
);

public record NearbyFilterParams(
    double Lat,
    double Lng,
    double RadiusMeters,
    int Limit
);

public record AtmSearchFilters(
    string? Query = null,
    AtmBank? Bank = null,
    bool? WheelchairOnly = null,
    double? MaxDistanceMeters = null,
    double? Lat = null,
    double? Lng = null
);

public record AtmSearchParams(
    AtmSearchFilters Filters,
    int Limit,
    int Offset
);
