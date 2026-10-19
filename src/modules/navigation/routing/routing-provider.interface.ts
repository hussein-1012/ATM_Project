import type { LatLng } from '../../../common/utils/geo.util';

export type TravelMode = 'walk' | 'drive';

export type Maneuver =
  | 'DEPART'
  | 'STRAIGHT'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'SLIGHT_LEFT'
  | 'SLIGHT_RIGHT'
  | 'UTURN'
  | 'ARRIVE';

export interface RouteStep {
  maneuver: Maneuver;
  streetName: string | null;
  distanceMeters: number;
  durationSeconds: number;
  location: LatLng;
}

/** GeoJSON LineString in [lng, lat] order (as required by RFC 7946). */
export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  /** true when produced by the straight-line fallback rather than real routing. */
  approximate: boolean;
  polyline: RouteGeometry;
  steps: RouteStep[];
}

/**
 * A routing backend. Implementations must either return a complete result or
 * throw; NavigationService downgrades any throw to the straight-line fallback.
 */
export interface RoutingProvider {
  readonly name: string;
  route(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult>;
}
