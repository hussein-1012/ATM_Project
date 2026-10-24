using System.Text.Json.Serialization;

namespace AqrabMakinaLeek.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AtmReportStatus
{
    WORKING,
    OUT_OF_CASH,
    OUT_OF_SERVICE
}
