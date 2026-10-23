using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Entities;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Services;

public class ReportsService
{
    private const int CooldownMinutes = 30;

    private readonly IAtmReportRepository _reportRepo;
    private readonly AtmsService _atmsService;

    public ReportsService(IAtmReportRepository reportRepo, AtmsService atmsService)
    {
        _reportRepo = reportRepo;
        _atmsService = atmsService;
    }

    public async Task<AtmReportResponseDto> CreateAsync(
        string userId,
        string atmId,
        AtmReportStatus status,
        CancellationToken ct = default)
    {
        if (!await _atmsService.ExistsAsync(atmId, ct))
        {
            throw new NotFoundException("ATM not found", "ATM_NOT_FOUND");
        }

        var recent = await _reportRepo.GetLatestUserReportAsync(atmId, userId, ct);
        if (recent is not null)
        {
            var cooldownExpiry = recent.CreatedAt.AddMinutes(CooldownMinutes);
            if (cooldownExpiry > DateTime.UtcNow)
            {
                var retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((cooldownExpiry - DateTime.UtcNow).TotalSeconds));
                throw new ReportCooldownException(retryAfterSeconds);
            }
        }

        var report = new AtmReport
        {
            AtmId = atmId,
            UserId = userId,
            Status = status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _reportRepo.InsertAsync(report, ct);

        return new AtmReportResponseDto(report.Id, report.AtmId, report.Status, report.CreatedAt);
    }

    public async Task<IReadOnlyList<AtmReportResponseDto>> ListAsync(
        string atmId,
        int limit,
        CancellationToken ct = default)
    {
        if (!await _atmsService.ExistsAsync(atmId, ct))
        {
            throw new NotFoundException("ATM not found", "ATM_NOT_FOUND");
        }

        var reports = await _reportRepo.GetReportsListAsync(atmId, limit, ct);
        return reports.Select(r => new AtmReportResponseDto(r.Id, r.AtmId, r.Status, r.CreatedAt)).ToList();
    }
}
