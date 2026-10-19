import { ConfigService } from '@nestjs/config';
import { OsrmRoutingProvider } from './osrm.provider';

describe('OsrmRoutingProvider', () => {
  const config = {
    get: (key: string) =>
      ({ 'routing.osrmUrl': 'https://osrm.test', 'routing.timeoutMs': 1000 })[key],
  } as unknown as ConfigService;

  let provider: OsrmRoutingProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new OsrmRoutingProvider(config);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(response: { ok: boolean; status?: number; body?: unknown }): jest.Mock {
    const fn = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    });
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it('requests the OSRM route endpoint with the GeoJSON options', async () => {
    const fetchMock = mockFetch({ ok: true, body: { routes: [] } });

    await provider.route({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive').catch(() => undefined);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'https://osrm.test/route/v1/driving/30.8,29.3;30.9,29.4?overview=full&geometries=geojson&steps=true',
    );
  });

  it('uses the foot profile for walking', async () => {
    const fetchMock = mockFetch({ ok: true, body: { routes: [] } });

    await provider.route({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'walk').catch(() => undefined);

    expect(fetchMock.mock.calls[0][0] as string).toContain('/route/v1/foot/');
  });

  it('parses a route into our neutral result', async () => {
    mockFetch({
      ok: true,
      body: {
        code: 'Ok',
        routes: [
          {
            distance: 1234.6,
            duration: 99.4,
            geometry: {
              type: 'LineString',
              coordinates: [
                [30.8, 29.3],
                [30.9, 29.4],
              ],
            },
            legs: [
              {
                steps: [
                  { name: '', distance: 10, duration: 5, maneuver: { type: 'depart', location: [30.8, 29.3] } },
                  {
                    name: 'شارع الحرية',
                    distance: 1200,
                    duration: 90,
                    maneuver: { type: 'turn', modifier: 'left', location: [30.85, 29.35] },
                  },
                  { name: '', distance: 0, duration: 0, maneuver: { type: 'arrive', location: [30.9, 29.4] } },
                ],
              },
            ],
          },
        ],
      },
    });

    const route = await provider.route({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive');

    expect(route.approximate).toBe(false);
    expect(route.distanceMeters).toBe(1235);
    expect(route.durationSeconds).toBe(99);
    expect(route.polyline.type).toBe('LineString');
    expect(route.steps.map((s) => s.maneuver)).toEqual(['DEPART', 'TURN_LEFT', 'ARRIVE']);
    expect(route.steps[1]).toMatchObject({ streetName: 'شارع الحرية', location: { lat: 29.35, lng: 30.85 } });
  });

  it('throws on a non-2xx response so the caller can fall back', async () => {
    mockFetch({ ok: false, status: 503 });
    await expect(
      provider.route({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive'),
    ).rejects.toThrow(/503/);
  });

  it('throws on a malformed/empty route', async () => {
    mockFetch({ ok: true, body: { code: 'NoRoute', routes: [] } });
    await expect(
      provider.route({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive'),
    ).rejects.toThrow(/malformed/);
  });
});
