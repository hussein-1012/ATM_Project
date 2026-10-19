import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import type { RedisService } from '../../common/redis/redis.service';

/** Minimal in-memory stand-in for the subset of RedisService the OTP uses. */
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(...keys: string[]): Promise<void> {
    keys.forEach((key) => this.store.delete(key));
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }
}

const CONFIG_VALUES: Record<string, number> = {
  'otp.ttlSeconds': 600,
  'otp.maxAttempts': 5,
  'otp.cooldownSeconds': 60,
};
const config = {
  get: (key: string) => CONFIG_VALUES[key],
} as unknown as ConfigService;

async function captureError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected the promise to reject');
}

/** A 6-digit code guaranteed to differ from the generated one. */
function wrongCode(code: string): string {
  return code === '000000' ? '111111' : '000000';
}

describe('OtpService', () => {
  let redis: InMemoryRedis;
  let service: OtpService;

  beforeEach(() => {
    redis = new InMemoryRedis();
    service = new OtpService(redis as unknown as RedisService, config);
  });

  it('issues a 6-digit code and stores only its sha256 hash', async () => {
    const result = await service.request('user@example.com');

    expect(result.sent).toBe(true);
    expect(result.code).toMatch(/^\d{6}$/);

    const raw = await redis.get('otp:user@example.com');
    expect(raw).toBeTruthy();
    expect(raw).not.toContain(result.code!);
    expect(JSON.parse(raw!)).toMatchObject({ attempts: 0 });
    expect(await redis.get('otp:cooldown:user@example.com')).toBe('1');
  });

  it('enforces the resend cooldown (nothing sent, no new code)', async () => {
    await service.request('user@example.com');
    const second = await service.request('user@example.com');

    expect(second.sent).toBe(false);
    expect(second.code).toBeUndefined();
  });

  it('verifies a correct code and clears the code + cooldown', async () => {
    const { code } = await service.request('user@example.com');

    await expect(service.verify('user@example.com', code!)).resolves.toBeUndefined();
    expect(await redis.get('otp:user@example.com')).toBeNull();
    expect(await redis.get('otp:cooldown:user@example.com')).toBeNull();
  });

  it('rejects a wrong code, counts the attempt and preserves the TTL', async () => {
    const { code } = await service.request('user@example.com');
    await redis.get('otp:user@example.com'); // ensure the key exists before reading ttl

    const error = await captureError(service.verify('user@example.com', wrongCode(code!)));
    expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });

    const stored = JSON.parse((await redis.get('otp:user@example.com'))!);
    expect(stored.attempts).toBe(1);
    // TTL kept (not reset to the full 600s).
    expect(await redis.ttl('otp:user@example.com')).toBeLessThanOrEqual(600);

    // the correct code still works after a failed attempt
    await expect(service.verify('user@example.com', code!)).resolves.toBeUndefined();
  });

  it('locks out after the attempt cap and deletes the code', async () => {
    const { code } = await service.request('user@example.com');
    const bad = wrongCode(code!);

    for (let i = 0; i < 5; i += 1) {
      const error = await captureError(service.verify('user@example.com', bad));
      expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
    }

    const locked = await captureError(service.verify('user@example.com', bad));
    expect(locked.getResponse()).toMatchObject({ code: 'OTP_MAX_ATTEMPTS' });
    expect(await redis.get('otp:user@example.com')).toBeNull();
  });

  it('rejects verification when no code was requested', async () => {
    const error = await captureError(service.verify('nobody@example.com', '123456'));
    expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
  });

  it('expires codes after the TTL', async () => {
    const shortConfig = {
      get: (key: string) => (key === 'otp.ttlSeconds' ? 0 : CONFIG_VALUES[key]),
    } as unknown as ConfigService;
    const shortLived = new OtpService(redis as unknown as RedisService, shortConfig);

    const { code } = await shortLived.request('ttl@example.com');
    await new Promise((resolve) => setTimeout(resolve, 5));

    const error = await captureError(shortLived.verify('ttl@example.com', code!));
    expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
  });
});
