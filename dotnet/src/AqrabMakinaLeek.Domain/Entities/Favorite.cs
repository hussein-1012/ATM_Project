using AqrabMakinaLeek.Domain.Common;

namespace AqrabMakinaLeek.Domain.Entities;

public class Favorite : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string AtmId { get; set; } = string.Empty;
}
