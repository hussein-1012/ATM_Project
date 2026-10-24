using AqrabMakinaLeek.Domain.Common;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Domain.Entities;

public class User : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public TravelMode PreferredTravelMode { get; set; } = TravelMode.Walk;
    public bool VoiceGuidance { get; set; } = true;
    public string Language { get; set; } = "ar";
    public DateTime? DeletedAt { get; set; }

    public bool IsDeleted => DeletedAt.HasValue;
}
