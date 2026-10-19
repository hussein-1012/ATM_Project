import { FallbackRoutingProvider } from './fallback.provider';
import { haversineMeters } from '../../../common/utils/geo.util';

describe('FallbackRoutingProvider', () => {
  const provider = new FallbackRoutingProvider();
  const from = { lat: 29.30837, lng: 30.84278 };
  const to = { lat: 29.31837, lng: 30.85278 };

  it('returns a straight-line distance flagged approximate', async () => {
    const route = await provider.route(from, to, 'walk');
    expect(route.approximate).toBe(true);
    expect(route.distanceMeters).toBe(Math.round(haversineMeters(from, to)));
  });

  it('derives walking duration from the spec walk speed', async () => {
    const route = await provider.route(from, to, 'walk');
    expect(route.durationSeconds).toBe(Math.round((route.distanceMeters / 78) * 60));
  });

  it('derives driving duration from the 25 km/h urban speed', async () => {
    const route = await provider.route(from, to, 'drive');
    expect(route.durationSeconds).toBe(Math.round((route.distanceMeters / ((25 * 1000) / 60)) * 60));
    expect(route.durationSeconds).toBeLessThan(
      (await provider.route(from, to, 'walk')).durationSeconds,
    );
  });

  it('returns a two-point GeoJSON LineString in [lng, lat] order', async () => {
    const route = await provider.route(from, to, 'drive');
    expect(route.polyline).toEqual({
      type: 'LineString',
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    });
  });

  it('emits DEPART then ARRIVE steps', async () => {
    const route = await provider.route(from, to, 'walk');
    expect(route.steps.map((s) => s.maneuver)).toEqual(['DEPART', 'ARRIVE']);
    expect(route.steps[0].location).toEqual(from);
    expect(route.steps[1].location).toEqual(to);
  });
});
