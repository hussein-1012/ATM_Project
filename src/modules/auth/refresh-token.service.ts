import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshToken, type RefreshTokenDocument } from './entities/refresh-token.entity';
import { parseDurationMs } from '../../common/utils/duration.util';

export interface IssuedRefreshToken {
  token: string;
  entity: RefreshTokenDocument;
}

/**
 * Opaque refresh tokens stored as sha256 hashes, grouped in rotation families.
 * Presenting a revoked token is treated as reuse: the whole family is revoked.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly tokenModel: Model<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlMs(): number {
    const ttl = this.config.get<string>('jwt.refreshTtl') ?? '30d';
    return parseDurationMs(ttl, 30 * 86_400_000);
  }

  async issue(userId: string, deviceInfo?: string, familyId?: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const entity = await this.tokenModel.create({
      userId,
      tokenHash: this.hash(token),
      familyId: familyId ?? randomUUID(),
      expiresAt: new Date(Date.now() + this.ttlMs()),
      revokedAt: null,
      deviceInfo: deviceInfo?.slice(0, 255) ?? null,
    });
    return { token, entity };
  }

  /**
   * Validates and rotates a refresh token. Throws on unknown/expired/reused
   * tokens; on reuse it revokes the entire family before throwing.
   */
  async rotate(rawToken: string): Promise<IssuedRefreshToken & { userId: string }> {
    const found = await this.tokenModel.findOne({ tokenHash: this.hash(rawToken) }).exec();
    if (!found) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    if (found.revokedAt) {
      // Reuse of a rotated token: assume compromise, kill the family.
      await this.revokeFamily(found.familyId);
      throw new UnauthorizedException({
        message: 'Refresh token reuse detected; all sessions in this family were revoked',
        code: 'TOKEN_REUSE_DETECTED',
      });
    }

    if (found.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    found.revokedAt = new Date();
    await found.save();

    const userId = found.userId.toString();
    const issued = await this.issue(userId, found.deviceInfo ?? undefined, found.familyId);
    return { ...issued, userId };
  }

  async revoke(rawToken: string): Promise<void> {
    const found = await this.tokenModel.findOne({ tokenHash: this.hash(rawToken) }).exec();
    if (found && !found.revokedAt) {
      found.revokedAt = new Date();
      await found.save();
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.tokenModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}
