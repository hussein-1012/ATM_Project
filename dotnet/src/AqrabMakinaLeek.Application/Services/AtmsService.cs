using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.Utilities;

namespace AqrabMakinaLeek.Application.Services;

public class AtmsService
{
    private const double WalkMetersPerMinute = 80.0;
    private const double DriveMetersPerMinute = 500.0;
    private const int FreshHours = 6;

    private readonly IAtmRepository _atmRepo;
    private readonly IAtmReportRepository _reportRepo;

    public AtmsService(IAtmRepository atmRepo, IAtmReportRepository reportRepo)
    {
        _atmRepo = atmRepo;
        _reportRepo = reportRepo;
    }

    public async Task<NearbyResponseDto> GetNearbyAsync(NearbyQueryDto dto, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var filterParams = new NearbyFilterParams(dto.Lat, dto.Lng, dto.Radius, dto.Limit);
        var rows = await _atmRepo.GetNearbyAsync(filterParams, ct);

        var items = rows.Select(r => MapToDto(r.Atm, now, r.DistanceMeters)).ToList();
        var meta = new NearbyMetaDto(dto.Lat, dto.Lng, dto.Radius, dto.Limit, items.Count);
        return new NearbyResponseDto(items, meta);
    }

    public async Task<SearchResponseDto> SearchAsync(SearchQueryDto dto, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        if (dto.MaxDistance.HasValue && (!dto.Lat.HasValue || !dto.Lng.HasValue))
        {
            throw new BadRequestException("maxDistance requires lat and lng", "MAX_DISTANCE_REQUIRES_LOCATION");
        }

        var filters = new AtmSearchFilters(
            Query: dto.Q,
            Bank: dto.Bank,
            WheelchairOnly: dto.Wheelchair,
            MaxDistanceMeters: dto.MaxDistance,
            Lat: dto.Lat,
            Lng: dto.Lng);

        if (dto.OpenNow)
        {
            var searchParams = new AtmSearchParams(filters, Limit: 10000, Offset: 0);
            var candidates = await _atmRepo.SearchRowsAsync(searchParams, ct);

            var openCandidates = candidates
                .Where(c => c.Atm.Is24h == true || c.Atm.OpeningHours is not null)
                .Where(c => OpenNowEvaluator.Evaluate(c.Atm.OpeningHours, c.Atm.Is24h, CairoTimeUtil.GetCairoClock(now)) == OpenStatus.OPEN)
                .ToList();

            var start = (dto.Page - 1) * dto.Limit;
            var paged = openCandidates
                .Skip(start)
                .Take(dto.Limit)
                .Select(c => MapToDto(c.Atm, now, c.DistanceMeters))
                .ToList();

            return new SearchResponseDto(paged, new SearchMetaDto(dto.Page, dto.Limit, openCandidates.Count));
        }

        var offset = (dto.Page - 1) * dto.Limit;
        var total = await _atmRepo.SearchCountAsync(filters, ct);
        var rows = await _atmRepo.SearchRowsAsync(new AtmSearchParams(filters, dto.Limit, offset), ct);

        var items = rows.Select(r => MapToDto(r.Atm, now, r.DistanceMeters)).ToList();
        return new SearchResponseDto(items, new SearchMetaDto(dto.Page, dto.Limit, total));
    }

    public async Task<AtmDetailResponseDto> GetDetailAsync(
        string id,
        double? refLat = null,
        double? refLng = null,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        AtmWithDistance? atmWithDist = null;
        if (refLat.HasValue && refLng.HasValue)
        {
            atmWithDist = await _atmRepo.GetByIdWithDistanceAsync(id, refLat.Value, refLng.Value, ct);
        }
        else
        {
            var atmOnly = await _atmRepo.GetByIdAsync(id, ct: ct);
            if (atmOnly is not null)
            {
                atmWithDist = new AtmWithDistance(atmOnly, null);
            }
        }

        if (atmWithDist is null)
        {
            throw new NotFoundException("ATM not found", "ATM_NOT_FOUND");
        }

        var startOfDay = CairoTimeUtil.GetCairoStartOfDayUtc(now);
        var freshSince = now.AddHours(-FreshHours);
        var since = freshSince < startOfDay ? freshSince : startOfDay;

        var reports = await _reportRepo.GetReportsForAtmAsync(id, since, ct);
        var summaryResult = ReportSummaryCalculator.Summarize(reports, now, FreshHours, startOfDay);

        if (summaryResult.ReportedAt is null)
        {
            var latest = await _reportRepo.GetLatestReportForAtmAsync(id, ct);
            if (latest is not null)
            {
                summaryResult = summaryResult with { ReportedAt = latest.CreatedAt.ToString("o") };
            }
        }

        var baseDto = MapToDto(atmWithDist.Atm, now, atmWithDist.DistanceMeters);
        var reportSummary = new ReportSummaryDto(
            summaryResult.Status,
            summaryResult.ReportedAt,
            summaryResult.ReportsToday);

        return new AtmDetailResponseDto
        {
            Id = baseDto.Id,
            Name = baseDto.Name,
            Bank = baseDto.Bank,
            Address = baseDto.Address,
            Location = baseDto.Location,
            IsBranch = baseDto.IsBranch,
            OpeningHours = baseDto.OpeningHours,
            Is24h = baseDto.Is24h,
            WheelchairAccessible = baseDto.WheelchairAccessible,
            SourceFetchedAt = baseDto.SourceFetchedAt,
            OpenNow = baseDto.OpenNow,
            TravelTimesAreEstimates = baseDto.TravelTimesAreEstimates,
            DistanceMeters = baseDto.DistanceMeters,
            WalkMinutes = baseDto.WalkMinutes,
            DriveMinutes = baseDto.DriveMinutes,
            ReportSummary = reportSummary
        };
    }

    public async Task<bool> ExistsAsync(string id, CancellationToken ct = default)
    {
        return await _atmRepo.ExistsAsync(id, ct);
    }

    public async Task<IReadOnlyList<AtmResponseDto>> FindManyByIdsAsync(
        IEnumerable<string> ids,
        double? refLat = null,
        double? refLng = null,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var refLocation = refLat.HasValue && refLng.HasValue ? (refLat.Value, refLng.Value) : ((double, double)?)null;
        var rows = await _atmRepo.FindManyByIdsAsync(ids, refLocation, ct);
        return rows.Select(r => MapToDto(r.Atm, now, r.DistanceMeters)).ToList();
    }

    public static AtmResponseDto MapToDto(Atm atm, DateTime now, double? distanceMeters = null)
    {
        int? distance = distanceMeters.HasValue ? (int)Math.Round(distanceMeters.Value) : null;
        int? walkMin = distance.HasValue ? (int)Math.Ceiling(distance.Value / WalkMetersPerMinute) : null;
        int? driveMin = distance.HasValue ? (int)Math.Ceiling(distance.Value / DriveMetersPerMinute) : null;

        return new AtmResponseDto
        {
            Id = atm.Id,
            Name = atm.Name,
            Bank = atm.Bank,
            Address = atm.Address,
            Location = new AtmLocationDto(atm.Location.Latitude, atm.Location.Longitude),
            IsBranch = atm.IsBranch,
            OpeningHours = atm.OpeningHours,
            Is24h = atm.Is24h,
            WheelchairAccessible = atm.WheelchairAccessible,
            SourceFetchedAt = atm.SourceFetchedAt?.ToString("o"),
            OpenNow = OpenNowEvaluator.Evaluate(atm.OpeningHours, atm.Is24h, CairoTimeUtil.GetCairoClock(now)),
            TravelTimesAreEstimates = true,
            DistanceMeters = distance,
            WalkMinutes = walkMin,
            DriveMinutes = driveMin
        };
    }
}
