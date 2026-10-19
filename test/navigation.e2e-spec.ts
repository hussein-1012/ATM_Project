import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OsrmRoutingProvider } from '../src/modules/navigation/routing/osrm.provider';

/**
 * Phase 6 acceptance: the routing endpoint with the provider mocked, and the
 * straight-line fallback path when the provider fails.
 *
 * Requires the docker-compose postgres + redis (and an imported ATM). This spec
 * lives alongside auth.e2e-spec.ts and is run by `pnpm test:e2e`.
 */
describe('Navigation (e2e)', () => {
  let app: INestApplication;
  let server: unknown;
  let dataSource: DataSource;
  let atmId: string;

  const providerRoute = jest.fn();

  const post = (path: string): request.Test => request(server as never).post(`/v1${path}`);

  beforeAll(async () => {
    process.env.ROUTING_PROVIDER = 'osrm';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(OsrmRoutingProvider)
      .useValue({ name: 'osrm', route: providerRoute })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, { docs: false });
    await app.init();

    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    const rows: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM atms ORDER BY id LIMIT 1',
    );
    atmId = rows[0]?.id;
  });

  afterAll(async () => {
    delete process.env.ROUTING_PROVIDER;
    await app.close();
  });

  const mockRoute = {
    distanceMeters: 1500,
    durationSeconds: 360,
    approximate: false,
    polyline: {
      type: 'LineString' as const,
      coordinates: [
        [30.8428, 29.3084],
        [30.843, 29.309],
      ] as [number, number][],
    },
    steps: [
      {
        maneuver: 'DEPART' as const,
        streetName: null,
        distanceMeters: 1500,
        durationSeconds: 360,
        location: { lat: 29.3084, lng: 30.8428 },
      },
    ],
  };

  it('returns the routing provider result', async () => {
    providerRoute.mockResolvedValueOnce(mockRoute);

    const res = await post('/navigation/route')
      .send({ from: { lat: 29.3084, lng: 30.8428 }, atmId, mode: 'drive' })
      .expect(200);

    expect(res.body).toMatchObject({ distanceMeters: 1500, approximate: false });
    expect(res.body.polyline.type).toBe('LineString');
    expect(res.body.steps[0].maneuver).toBe('DEPART');
  });

  it('falls back to a straight line when the provider fails', async () => {
    providerRoute.mockRejectedValueOnce(new Error('provider down'));

    const res = await post('/navigation/route')
      .send({ from: { lat: 29.31, lng: 30.84 }, atmId, mode: 'walk' })
      .expect(200);

    expect(res.body.approximate).toBe(true);
    expect(res.body.distanceMeters).toBeGreaterThan(0);
    expect(res.body.steps.map((s: { maneuver: string }) => s.maneuver)).toEqual(['DEPART', 'ARRIVE']);
  });

  it('rejects an unknown ATM with 404', async () => {
    const res = await post('/navigation/route')
      .send({ from: { lat: 29.31, lng: 30.84 }, atmId: '00000000-0000-4000-8000-000000000000', mode: 'drive' })
      .expect(404);
    expect(res.body).toMatchObject({ code: 'ATM_NOT_FOUND' });
  });

  it('rejects an invalid body with 400', async () => {
    const res = await post('/navigation/route')
      .send({ from: { lat: 29.31, lng: 30.84 }, mode: 'drive' })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
