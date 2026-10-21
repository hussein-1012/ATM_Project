import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { RefreshToken, type RefreshTokenDocument } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

/** In-memory Mongoose Model<RefreshToken> supporting the methods the service uses. */
class InMemoryTokenModel {
  rows: Array<{
    _id: Types.ObjectId;
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    deviceInfo: string | null;
    save: () => Promise<any>;
  }> = [];

  async create(data: Partial<RefreshToken>) {
    const doc = {
      _id: new Types.ObjectId(),
      id: '',
      userId: data.userId as any,
      tokenHash: data.tokenHash!,
      familyId: data.familyId!,
      expiresAt: data.expiresAt!,
      revokedAt: data.revokedAt ?? null,
      deviceInfo: data.deviceInfo ?? null,
      save: async function () { return this; },
    };
    doc.id = doc._id.toHexString();
    this.rows.push(doc);
    return doc;
  }

  findOne(filter: { tokenHash?: string }) {
    return {
      exec: async () =>
        this.rows.find((row) => row.tokenHash === filter.tokenHash) ?? null,
    };
  }

  async updateMany(
    filter: { userId?: string; familyId?: string; revokedAt: null },
    update: { $set: { revokedAt: Date } },
  ) {
    const now = update.$set.revokedAt;
    for (const row of this.rows) {
      let matches = true;
      if (filter.userId !== undefined) matches = row.userId.toString() === filter.userId.toString();
      if (filter.familyId !== undefined) matches = matches && row.familyId === filter.familyId;
      if (filter.revokedAt === null && row.revokedAt !== null) matches = false;
      if (matches) row.revokedAt = now;
    }
    return { modifiedCount: this.rows.length };
  }
}

const config = {
  get: (key: string) => (key === 'jwt.refreshTtl' ? '30d' : undefined),
} as unknown as ConfigService;

async function captureError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected the promise to reject');
}

describe('RefreshTokenService', () => {
  let model: InMemoryTokenModel;
  let service: RefreshTokenService;

  beforeEach(() => {
    model = new InMemoryTokenModel();
    service = new RefreshTokenService(model as unknown as Model<RefreshToken>, config);
  });

  it('issues an opaque token and stores only its sha256 hash', async () => {
    const issued = await service.issue('user-1', 'jest-agent');

    expect(issued.token.length).toBeGreaterThan(20);
    expect(issued.entity.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.entity.tokenHash).not.toBe(issued.token);
    expect(issued.entity.familyId).toBeTruthy();
    expect(issued.entity.revokedAt).toBeNull();
    expect(issued.entity.deviceInfo).toBe('jest-agent');
    expect(issued.entity.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('truncates long device info to 255 chars', async () => {
    const issued = await service.issue('user-1', 'x'.repeat(500));
    expect(issued.entity.deviceInfo).toHaveLength(255);
  });

  it('rotates a valid token, staying in the same family', async () => {
    const first = await service.issue('user-1');
    const rotated = await service.rotate(first.token);

    expect(rotated.userId).toBe('user-1');
    expect(rotated.token).not.toBe(first.token);
    expect(rotated.entity.familyId).toBe(first.entity.familyId);

    const storedFirst = model.rows.find((row) => row.tokenHash === first.entity.tokenHash)!;
    expect(storedFirst.revokedAt).not.toBeNull();
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const first = await service.issue('user-1');
    const rotated = await service.rotate(first.token);

    const error = await captureError(service.rotate(first.token));
    expect(error.getResponse()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });

    // the freshly rotated token is revoked too
    expect(model.rows.every((row) => row.revokedAt !== null)).toBe(true);
    const followUp = await captureError(service.rotate(rotated.token));
    expect(followUp.getResponse()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
  });

  it('rejects an unknown token', async () => {
    const error = await captureError(service.rotate('does-not-exist'));
    expect(error.getResponse()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects an expired token', async () => {
    const issued = await service.issue('user-1');
    model.rows[0].expiresAt = new Date(Date.now() - 1000);

    const error = await captureError(service.rotate(issued.token));
    expect(error.getResponse()).toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' });
    expect(model.rows[0].revokedAt).toBeNull();
  });

  it('logout revokes a token and is idempotent', async () => {
    const issued = await service.issue('user-1');

    await service.revoke(issued.token);
    await service.revoke(issued.token);
    await service.revoke('unknown-token');

    expect(model.rows[0].revokedAt).not.toBeNull();
  });

  it('revokeAllForUser only touches that user', async () => {
    await service.issue('user-1');
    await service.issue('user-1');
    await service.issue('user-2');

    await service.revokeAllForUser('user-1');

    expect(model.rows.filter((row) => row.userId.toString() === 'user-1').every((row) => row.revokedAt !== null)).toBe(true);
    expect(model.rows.filter((row) => row.userId.toString() === 'user-2').every((row) => row.revokedAt === null)).toBe(true);
  });
});
