import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper around one shared ioredis connection.
 * Used for OTP storage, route cache and rate-limit counters.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('redisUrl') ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    this.client.on('error', (err) => {
      // Never crash the process on transient Redis errors; log via console (pino may not be up yet).
      console.error('[redis] connection error:', err.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit().catch(() => undefined);
  }

  get redis(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /** INCR + EXPIRE in one script-free sequence; returns the new counter and its TTL. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);
    const ttl = await this.client.ttl(key);
    return { count, ttl };
  }

  /** SET key value NX EX — returns true when acquired. */
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }
}
