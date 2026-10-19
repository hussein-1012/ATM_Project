import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LatLng } from '../../../common/utils/geo.util';
import { fetchJson } from './fetch-json';
import type {
  Maneuver,
  RouteResult,
  RouteStep,
  RoutingProvider,
  TravelMode,
} from './routing-provider.interface';

interface OsrmStep {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: { type?: string; modifier?: string; location?: [number, number] };
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: { type?: string; coordinates?: [number, number][] };
  legs?: Array<{ steps?: OsrmStep[] }>;
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

function toManeuver(type: string | undefined, modifier: string | undefined): Maneuver {
  if (type === 'depart') return 'DEPART';
  if (type === 'arrive') return 'ARRIVE';
  switch (modifier) {
    case 'left':
    case 'sharp left':
      return 'TURN_LEFT';
    case 'right':
    case 'sharp right':
      return 'TURN_RIGHT';
    case 'slight left':
      return 'SLIGHT_LEFT';
    case 'slight right':
      return 'SLIGHT_RIGHT';
    case 'uturn':
      return 'UTURN';
    default:
      return 'STRAIGHT';
  }
}

/** OSRM (`/route/v1`) provider. Throws on any malformed response so the caller can fall back. */
@Injectable()
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = 'osrm';

  constructor(private readonly config: ConfigService) {}

  private profile(mode: TravelMode): string {
    return mode === 'walk' ? 'foot' : 'driving';
  }

  async route(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult> {
    const base = (this.config.get<string>('routing.osrmUrl') ?? 'https://router.project-osrm.org').replace(
      /\/$/,
      '',
    );
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `${base}/route/v1/${this.profile(mode)}/${coords}?overview=full&geometries=geojson&steps=true`;
    const timeoutMs = this.config.get<number>('routing.timeoutMs') ?? 5000;

    const body = await fetchJson<OsrmResponse>(url, { headers: { accept: 'application/json' } }, timeoutMs);
    const route = body.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('OSRM: malformed route');
    }

    return {
      distanceMeters: Math.round(route.distance ?? 0),
      durationSeconds: Math.round(route.duration ?? 0),
      approximate: false,
      polyline: { type: 'LineString', coordinates },
      steps: (route.legs?.[0]?.steps ?? []).map((step) => this.toStep(step)),
    };
  }

  private toStep(step: OsrmStep): RouteStep {
    const location = step.maneuver?.location ?? [0, 0];
    return {
      maneuver: toManeuver(step.maneuver?.type, step.maneuver?.modifier),
      streetName: step.name && step.name.trim() ? step.name : null,
      distanceMeters: Math.round(step.distance ?? 0),
      durationSeconds: Math.round(step.duration ?? 0),
      location: { lat: location[1], lng: location[0] },
    };
  }
}
