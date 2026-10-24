using System.Text.Json.Serialization;

namespace AqrabMakinaLeek.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OpenStatus
{
    OPEN,
    CLOSED,
    UNKNOWN
}
