using AqrabMakinaLeek.Domain.Common;

namespace AqrabMakinaLeek.Domain.Entities;

public class RecentSearch : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Query { get; set; } = string.Empty;
}
