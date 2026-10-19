import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { RedisService } from '../../common/redis/redis.service';
import { roundCoord, type LatLng } from '../../common/utils/geo.util';
import { AtmsRepository } from '../atms/atms.repository';
import { FallbackRoutingProvider } from './routing/fallback.provider';
import { OrsRoutingProvider } from './routing/ors.provider';
import { OsrmRoutingProvider } from './routing/osrm.provider';
import type {
  RouteResult,
  RoutingProvider,
  TravelMode,
} from './routing/routing-provider.interface';

@Injectable()
export class NavigationService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly atms: AtmsRepository,
    private readonly fallback: FallbackRoutingProvider,
    private readonly osrm: OsrmRoutingProvider,
    private readonly ors: OrsRoutingProvider,
    private readonly logger: Logger,
  ) {}

  private provider(): RoutingProvider {
    switch (this.config.get<string>('routing.provider')) {
      case 'osrm':
        return this.osrm;
      case 'ors':
        return this.ors;
      default:
        return this.fallback;
    }
  }

  /**
   * Resolves the destination ATM, then routes with the configured provider.
   * Any provider error (timeout, non-200, bad body) downgrades to the
   * straight-line fallback so the endpoint always answers. Results are cached
   * in Redis for `ROUTE_CACHE_TTL_SECONDS` on coordinates rounded to ~11 m.
   */
  async route(input: {
    from: LatLng;
    atmId: string;
    mode: TravelMode;
  }): Promise<RouteResult> {
    const atm = await this.atms.findById(input.atmId);
    if (!atm) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }

    const from = { lat: input.from.lat, lng: input.from.lng };
    const to = { lat: atm.lat, lng: atm.lng };
    const provider = this.provider();

    const cacheKey = this.cacheKey(provider.name, from, to, input.mode);
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    let result: RouteResult;
    try {
      result = await provider.route(from, to, input.mode);
    } catch (error) {
      this.logger.warn(
        { err: error, provider: provider.name },
        'Routing provider failed; using straight-line fallback',
      );
      result = await this.fallback.route(from, to, input.mode);
    }

    await this.cacheSet(cacheKey, result);
    return result;
  }

  private cacheKey(provider: string, from: LatLng, to: LatLng, mode: TravelMode): string {
    const c = (v: number) => `${roundCoord(v)}`;
    return `route:${provider}:${mode}:${c(from.lat)},${c(from.lng)}:${c(to.lat)},${c(to.lng)}`;
  }

  private async cacheGet(key: string): Promise<RouteResult | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as RouteResult) : null;
    } catch (error) {
      this.logger.warn({ err: error }, 'Route cache read failed');
      return null;
    }
  }

  private async cacheSet(key: string, result: RouteResult): Promise<void> {
    try {
      const ttl = this.config.get<number>('routing.cacheTtlSeconds') ?? 60;
      await this.redis.set(key, JSON.stringify(result), ttl);
    } catch (error) {
      this.logger.warn({ err: error }, 'Route cache write failed');
    }
  }
}
