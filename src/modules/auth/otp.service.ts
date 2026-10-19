import { createHash, randomInt } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';

interface OtpRecord {
  hash: string;
  attempts: number;
}

export interface OtpRequestResult {
  /** false when the resend cooldown is still active (nothing was sent). */
  sent: boolean;
  /** only returned to the caller so the dev mailer can include it; never logged */
  code?: string;
}

/**
 * Password-reset OTP storage in Redis:
 *   otp:{email}          -> JSON { hash, attempts } with TTL
 *   otp:cooldown:{email} -> resend cooldown marker
 * Codes are stored hashed (sha256); attempts are capped.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private otpKey(email: string): string {
    return `otp:${email}`;
  }

  private cooldownKey(email: string): string {
    return `otp:cooldown:${email}`;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private ttlSeconds(): number {
    return this.config.get<number>('otp.ttlSeconds') ?? 600;
  }

  private maxAttempts(): number {
    return this.config.get<number>('otp.maxAttempts') ?? 5;
  }

  async request(email: string): Promise<OtpRequestResult> {
    const cooldownActive = await this.redis.get(this.cooldownKey(email));
    if (cooldownActive) return { sent: false };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const record: OtpRecord = { hash: this.hash(code), attempts: 0 };
    await this.redis.set(this.otpKey(email), JSON.stringify(record), this.ttlSeconds());
    await this.redis.set(
      this.cooldownKey(email),
      '1',
      this.config.get<number>('otp.cooldownSeconds') ?? 60,
    );
    return { sent: true, code };
  }

  /** Verifies and consumes the OTP, enforcing the attempt cap. */
  async verify(email: string, code: string): Promise<void> {
    const raw = await this.redis.get(this.otpKey(email));
    if (!raw) {
      throw new UnauthorizedException({ message: 'Invalid or expired OTP', code: 'OTP_INVALID' });
    }

    let record: OtpRecord;
    try {
      record = JSON.parse(raw) as OtpRecord;
    } catch {
      await this.redis.del(this.otpKey(email));
      throw new UnauthorizedException({ message: 'Invalid or expired OTP', code: 'OTP_INVALID' });
    }

    if (record.attempts >= this.maxAttempts()) {
      await this.redis.del(this.otpKey(email));
      throw new UnauthorizedException({
        message: 'Too many OTP attempts; request a new code',
        code: 'OTP_MAX_ATTEMPTS',
      });
    }

    if (record.hash !== this.hash(code)) {
      record.attempts += 1;
      const remaining = await this.redis.ttl(this.otpKey(email));
      await this.redis.set(
        this.otpKey(email),
        JSON.stringify(record),
        remaining > 0 ? remaining : this.ttlSeconds(),
      );
      throw new UnauthorizedException({ message: 'Invalid or expired OTP', code: 'OTP_INVALID' });
    }

    await this.redis.del(this.otpKey(email), this.cooldownKey(email));
  }
}
