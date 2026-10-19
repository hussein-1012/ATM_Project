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

interface OrsStep {
  distance?: number;
  duration?: number;
  /** ORS numeric instruction type (see mapInstruction). */
  type?: number;
  name?: string;
  way_points?: number[];
}

interface OrsSegment {
  distance?: number;
  duration?: number;
  steps?: OrsStep[];
}

interface OrsFeature {
  geometry?: { type?: string; coordinates?: [number, number][] };
  properties?: {
    summary?: { distance?: number; duration?: number };
    segments?: OrsSegment[];
  };
}

interface OrsResponse {
  features?: OrsFeature[];
}

/** ORS instruction codes → our neutral maneuver enum. */
function mapInstruction(type: number | undefined): Maneuver {
  switch (type) {
    case 0:
    case 2:
      return 'TURN_LEFT';
    case 1:
    case 3:
      return 'TURN_RIGHT';
    case 4:
      return 'SLIGHT_LEFT';
    case 5:
      return 'SLIGHT_RIGHT';
    case 9:
      return 'UTURN';
    case 10:
      return 'ARRIVE';
    case 11:
      return 'DEPART';
    default:
      return 'STRAIGHT';
  }
}

/** OpenRouteService provider. Requires `ORS_API_KEY`; throws so the caller can fall back. */
@Injectable()
export class OrsRoutingProvider implements RoutingProvider {
  readonly name = 'ors';

  constructor(private readonly config: ConfigService) {}

  private profile(mode: TravelMode): string {
    return mode === 'walk' ? 'foot-walking' : 'driving-car';
  }

  async route(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult> {
    const apiKey = this.config.get<string>('routing.orsApiKey');
    if (!apiKey) throw new Error('ORS: missing API key');

    const base = (this.config.get<string>('routing.orsUrl') ?? 'https://api.openrouteservice.org').replace(
      /\/$/,
      '',
    );
    const timeoutMs = this.config.get<number>('routing.timeoutMs') ?? 5000;
    const url = `${base}/v2/directions/${this.profile(mode)}/geojson`;
    const body = await fetchJson<OrsResponse>(
      url,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: apiKey,
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      },
      timeoutMs,
    );

    const feature = body.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    const summary = feature?.properties?.summary;
    if (!feature || !Array.isArray(coordinates) || coordinates.length < 2 || !summary) {
      throw new Error('ORS: malformed route');
    }

    const steps = feature.properties?.segments?.[0]?.steps ?? [];
    return {
      distanceMeters: Math.round(summary.distance ?? 0),
      durationSeconds: Math.round(summary.duration ?? 0),
      approximate: false,
      polyline: { type: 'LineString', coordinates },
      steps: steps.map((step) => this.toStep(step, coordinates)),
    };
  }

  private toStep(step: OrsStep, coordinates: [number, number][]): RouteStep {
    const index = step.way_points?.[0] ?? 0;
    const point = coordinates[index] ?? coordinates[0] ?? [0, 0];
    return {
      maneuver: mapInstruction(step.type),
      streetName: step.name && step.name.trim() ? step.name : null,
      distanceMeters: Math.round(step.distance ?? 0),
      durationSeconds: Math.round(step.duration ?? 0),
      location: { lat: point[1], lng: point[0] },
    };
  }
}
