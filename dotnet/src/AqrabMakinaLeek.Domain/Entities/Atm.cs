using AqrabMakinaLeek.Domain.Common;
using AqrabMakinaLeek.Domain.Enums;
using AqrabMakinaLeek.Domain.ValueObjects;

namespace AqrabMakinaLeek.Domain.Entities;

public class Atm : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public AtmBank Bank { get; set; } = AtmBank.OTHER;
    public string Address { get; set; } = string.Empty;
    public GeoPoint Location { get; set; } = default!;
    public bool IsBranch { get; set; } = false;
    public OpeningHours? OpeningHours { get; set; }
    public bool? Is24h { get; set; }
    public bool? WheelchairAccessible { get; set; }
    public string Source { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public DateTime? SourceFetchedAt { get; set; }
    public string SearchText { get; set; } = string.Empty;
}
