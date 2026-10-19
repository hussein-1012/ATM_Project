import { Injectable } from '@nestjs/common';
import {
  DRIVE_METERS_PER_MINUTE,
  WALK_METERS_PER_MINUTE,
} from '../../../common/constants';
import { haversineMeters, type LatLng } from '../../../common/utils/geo.util';
import type { RouteResult, RoutingProvider, TravelMode } from './routing-provider.interface';

/**
 * Straight-line "routing". Always available, always flagged `approximate:true`,
 * so the endpoint can answer even when OSRM/ORS are down or unconfigured.
 */
@Injectable()
export class FallbackRoutingProvider implements RoutingProvider {
  readonly name = 'fallback';

  async route(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult> {
    const distanceMeters = Math.round(haversineMeters(from, to));
    const metersPerMinute = mode === 'walk' ? WALK_METERS_PER_MINUTE : DRIVE_METERS_PER_MINUTE;
    const durationSeconds = Math.round((distanceMeters / metersPerMinute) * 60);

    return {
      distanceMeters,
      durationSeconds,
      approximate: true,
      polyline: {
        type: 'LineString',
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      },
      steps: [
        {
          maneuver: 'DEPART',
          streetName: null,
          distanceMeters,
          durationSeconds,
          location: { lat: from.lat, lng: from.lng },
        },
        {
          maneuver: 'ARRIVE',
          streetName: null,
          distanceMeters: 0,
          durationSeconds: 0,
          location: { lat: to.lat, lng: to.lng },
        },
      ],
    };
  }
}
