using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.Application.DTOs;

// --- Auth & Account DTOs ---
public record RegisterRequest(string Name, string Email, string Password);
public record LoginRequest(string Email, string Password, string? DeviceInfo = null);
public record AuthResponseDto(string AccessToken, string RefreshToken, UserResponseDto User);
public record RefreshTokenRequest(string RefreshToken);
public record ForgotPasswordRequest(string Email);
public record VerifyOtpRequest(string Email, string Otp);
public record ResetPasswordRequest(string ResetToken, string NewPassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record DeleteAccountRequest(string Password);

// --- User DTOs ---
public record UserResponseDto(
    string Id,
    string Name,
    string Email,
    TravelMode PreferredTravelMode,
    bool VoiceGuidance,
    string Language,
    DateTime CreatedAt
);

public record UpdateProfileDto(
    string? Name = null,
    TravelMode? PreferredTravelMode = null,
    bool? VoiceGuidance = null,
    string? Language = null
);

// --- ATM DTOs ---
public record AtmLocationDto(double Lat, double Lng);

public record AtmResponseDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public AtmBank Bank { get; init; }
    public string Address { get; init; } = string.Empty;
    public AtmLocationDto Location { get; init; } = new(0, 0);
    public bool IsBranch { get; init; }
    public OpeningHours? OpeningHours { get; init; }
    public bool? Is24h { get; init; }
    public bool? WheelchairAccessible { get; init; }
    public string? SourceFetchedAt { get; init; }
    public OpenStatus OpenNow { get; init; }
    public bool TravelTimesAreEstimates { get; init; } = true;
    public int? DistanceMeters { get; init; }
    public int? WalkMinutes { get; init; }
    public int? DriveMinutes { get; init; }
}

public record ReportSummaryDto(
    string Status,
    string? ReportedAt,
    int ReportsToday
);

public record AtmDetailResponseDto : AtmResponseDto
{
    public ReportSummaryDto ReportSummary { get; init; } = new("UNKNOWN", null, 0);
}

public record NearbyQueryDto(double Lat, double Lng, double Radius = 2000, int Limit = 50);
public record NearbyMetaDto(double Lat, double Lng, double Radius, int Limit, int Count);
public record NearbyResponseDto(IReadOnlyList<AtmResponseDto> Items, NearbyMetaDto Meta);

public record SearchQueryDto(
    string? Q = null,
    AtmBank? Bank = null,
    bool? Wheelchair = null,
    double? MaxDistance = null,
    double? Lat = null,
    double? Lng = null,
    bool OpenNow = false,
    int Page = 1,
    int Limit = 20
);
public record SearchMetaDto(int Page, int Limit, long Total);
public record SearchResponseDto(IReadOnlyList<AtmResponseDto> Items, SearchMetaDto Meta);

// --- Report DTOs ---
public record CreateReportRequest(AtmReportStatus Status);
public record AtmReportResponseDto(string Id, string AtmId, AtmReportStatus Status, DateTime CreatedAt);

// --- Favorite DTOs ---
public record FavoriteMetaDto(int Count);
public record FavoriteListDto(IReadOnlyList<AtmResponseDto> Items, FavoriteMetaDto Meta);
public record AddFavoriteResponseDto(string AtmId, DateTime CreatedAt);

// --- Recent Search DTOs ---
public record CreateRecentSearchRequest(string Query);
public record RecentSearchResponseDto(string Id, string Query, DateTime CreatedAt);
public record RecentSearchListDto(IReadOnlyList<RecentSearchResponseDto> Items);

// --- Navigation DTOs ---
public record RouteQueryDto(double FromLat, double FromLng, TravelMode Mode = TravelMode.Walk);
