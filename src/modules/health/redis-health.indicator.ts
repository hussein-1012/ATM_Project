import { Injectable } from '@nestjs/common';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';
import type { HealthIndicatorResult } from '@nestjs/terminus';

/** Minimal Redis health indicator (PING). */
@Injectable()
export class RedisHealth {
  constructor(private readonly redis: RedisService) {}

  async isUp(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.redis.ping();
      if (pong !== 'PONG') throw new Error(`unexpected reply: ${pong}`);
      return { [key]: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError(`${key} check failed`, err as Error);
    }
  }
}
