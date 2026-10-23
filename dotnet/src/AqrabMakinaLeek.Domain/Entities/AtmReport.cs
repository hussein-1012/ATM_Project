using AqrabMakinaLeek.Domain.Common;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Domain.Entities;

public class AtmReport : BaseEntity
{
    public string AtmId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public AtmReportStatus Status { get; set; } = AtmReportStatus.WORKING;
}
