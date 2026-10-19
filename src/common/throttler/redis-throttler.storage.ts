import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';

/** Mirror of @nestjs/throttler's ThrottlerStorageRecord (not exported by the package). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed throttler storage so rate-limit counters survive restarts
 * and are shared across API replicas.
 *
 * Instantiated directly by ThrottlerModule.forRootAsync (not via DI), so the
 * RedisService reference is bound statically once the container is up.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private static redisService: RedisService | null = null;

  /** Wired once at module init from the DI container. */
  static bind(redis: RedisService): void {
    RedisThrottlerStorage.redisService = redis;
  }

  private get redis() {
    const svc = RedisThrottlerStorage.redisService;
    if (!svc) throw new Error('RedisThrottlerStorage not bound to RedisService');
    return svc.redis;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const msTtl = Math.max(ttl, 1000);
    const totalHits = await this.redis.incr(key);
    if (totalHits === 1) {
      await this.redis.pexpire(key, msTtl);
    }
    const pttl = await this.redis.pttl(key);
    const timeToExpire = Math.max(Math.round((pttl >= 0 ? pttl : msTtl) / 1000), 1);
    const isBlocked = totalHits > limit;
    const blockMs = Math.max(blockDuration, 1000);
    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked
        ? Math.max(Math.round(blockMs / 1000), 1)
        : 0,
    };
  }
}
