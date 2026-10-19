import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Logger } from 'nestjs-pino';
import { NavigationService } from './navigation.service';
import type { RedisService } from '../../common/redis/redis.service';
import type { AtmsRepository } from '../atms/atms.repository';
import type { FallbackRoutingProvider } from './routing/fallback.provider';
import type { OsrmRoutingProvider } from './routing/osrm.provider';
import type { OrsRoutingProvider } from './routing/ors.provider';
import type { RouteResult, RoutingProvider } from './routing/routing-provider.interface';

const result = (over: Partial<RouteResult> = {}): RouteResult => ({
  distanceMeters: 100,
  durationSeconds: 60,
  approximate: false,
  polyline: {
    type: 'LineString',
    coordinates: [
      [30.8, 29.3],
      [30.9, 29.4],
    ],
  },
  steps: [],
  ...over,
});

function stubProvider(name: string): RoutingProvider & { route: jest.Mock } {
  return { name, route: jest.fn() };
}

describe('NavigationService', () => {
  let configValues: Record<string, unknown>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let atms: { findById: jest.Mock };
  let fallback: RoutingProvider & { route: jest.Mock };
  let osrm: RoutingProvider & { route: jest.Mock };
  let ors: RoutingProvider & { route: jest.Mock };
  let logger: { warn: jest.Mock };
  let service: NavigationService;

  const input = { from: { lat: 29.3, lng: 30.8 }, atmId: 'atm-1', mode: 'drive' as const };

  beforeEach(() => {
    configValues = {
      'routing.provider': 'osrm',
      'routing.cacheTtlSeconds': 60,
    };
    const config = { get: (key: string) => configValues[key] } as unknown as ConfigService;
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    atms = { findById: jest.fn().mockResolvedValue({ lat: 29.4, lng: 30.9 }) };
    fallback = stubProvider('fallback');
    osrm = stubProvider('osrm');
    ors = stubProvider('ors');
    logger = { warn: jest.fn() };

    service = new NavigationService(
      config,
      redis as unknown as RedisService,
      atms as unknown as AtmsRepository,
      fallback as unknown as FallbackRoutingProvider,
      osrm as unknown as OsrmRoutingProvider,
      ors as unknown as OrsRoutingProvider,
      logger as unknown as Logger,
    );
  });

  it('routes with the configured provider and caches the result', async () => {
    osrm.route.mockResolvedValue(result());

    const route = await service.route(input);

    expect(osrm.route).toHaveBeenCalledWith({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive');
    expect(route.distanceMeters).toBe(100);
    expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('route:osrm:drive:'), expect.any(String), 60);
  });

  it('throws 404 ATM_NOT_FOUND for an unknown ATM', async () => {
    atms.findById.mockResolvedValue(null);

    await expect(service.route(input)).rejects.toBeInstanceOf(NotFoundException);
    expect(osrm.route).not.toHaveBeenCalled();
  });

  it('returns a cached route without calling the provider', async () => {
    const cached = result({ distanceMeters: 42, approximate: true });
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const route = await service.route(input);

    expect(route).toEqual(cached);
    expect(osrm.route).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('falls back to a straight line when the provider fails, and logs it', async () => {
    osrm.route.mockRejectedValue(new Error('timeout'));
    const fallbackResult = result({ approximate: true, distanceMeters: 555 });
    fallback.route.mockResolvedValue(fallbackResult);

    const route = await service.route(input);

    expect(logger.warn).toHaveBeenCalled();
    expect(fallback.route).toHaveBeenCalledWith({ lat: 29.3, lng: 30.8 }, { lat: 29.4, lng: 30.9 }, 'drive');
    expect(route).toEqual(fallbackResult);
    expect(route.approximate).toBe(true);
  });

  it('uses the fallback provider directly when configured', async () => {
    configValues['routing.provider'] = 'fallback';
    fallback.route.mockResolvedValue(result({ approximate: true }));

    await service.route(input);

    expect(fallback.route).toHaveBeenCalled();
    expect(osrm.route).not.toHaveBeenCalled();
  });

  it('selects the ORS provider when configured', async () => {
    configValues['routing.provider'] = 'ors';
    ors.route.mockResolvedValue(result());

    await service.route(input);

    expect(ors.route).toHaveBeenCalled();
    expect(osrm.route).not.toHaveBeenCalled();
  });

  it('rounds coordinates in the cache key and ignores cache failures', async () => {
    osrm.route.mockResolvedValue(result());
    redis.get.mockRejectedValue(new Error('redis down'));

    await service.route({ from: { lat: 29.30837123, lng: 30.84278123 }, atmId: 'atm-1', mode: 'walk' });

    expect(redis.get).toHaveBeenCalledWith('route:osrm:walk:29.3084,30.8428:29.4,30.9');
  });
});
