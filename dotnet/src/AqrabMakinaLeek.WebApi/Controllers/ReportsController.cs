using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Application.Services;
using AqrabMakinaLeek.WebApi.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AqrabMakinaLeek.WebApi.Controllers;

[ApiController]
[Route("v1/atms/{atmId}/reports")]
public class ReportsController : ControllerBase
{
    private readonly ReportsService _reportsService;

    public ReportsController(ReportsService reportsService)
    {
        _reportsService = reportsService;
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<AtmReportResponseDto>> CreateReport(
        [FromRoute] string atmId,
        [FromBody] CreateReportRequest request,
        CancellationToken ct)
    {
        var userId = User.GetRequiredUserId();
        var report = await _reportsService.CreateAsync(userId, atmId, request.Status, ct);
        return StatusCode(StatusCodes.Status201Created, report);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AtmReportResponseDto>>> ListReports(
        [FromRoute] string atmId,
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var reports = await _reportsService.ListAsync(atmId, limit, ct);
        return Ok(reports);
    }
}
