using AqrabMakinaLeek.Application.Common.Models;
using AqrabMakinaLeek.Domain.Enums;

namespace AqrabMakinaLeek.Application.Common.Interfaces;

public interface IRoutingProvider
{
    string Name { get; }
    Task<RouteResult> RouteAsync(LatLng from, LatLng to, TravelMode mode, CancellationToken ct = default);
}
