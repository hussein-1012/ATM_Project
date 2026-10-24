using System.Text.Json.Serialization;

namespace AqrabMakinaLeek.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TravelMode
{
    Walk,
    Drive
}
