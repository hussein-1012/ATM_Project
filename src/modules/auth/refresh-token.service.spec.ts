import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

/** In-memory Repository<RefreshToken> supporting the methods the service uses. */
class InMemoryRefreshRepo {
  rows: RefreshToken[] = [];

  create(data: Partial<RefreshToken>): RefreshToken {
    return { ...(data as RefreshToken) };
  }

  async save(entity: RefreshToken): Promise<RefreshToken> {
    if (!entity.id) {
      entity.id = randomUUID();
      this.rows.push(entity);
    }
    return entity;
  }

  async findOne(options: { where: { tokenHash: string } }): Promise<RefreshToken | null> {
    return this.rows.find((row) => row.tokenHash === options.where.tokenHash) ?? null;
  }

  createQueryBuilder() {
    let patch: Partial<RefreshToken> = {};
    let whereClause = '';
    let params: Record<string, string> = {};

    const qb = {
      update: () => qb,
      set: (value: Partial<RefreshToken>) => {
        patch = value;
        return qb;
      },
      where: (sql: string, parameters: Record<string, string>) => {
        whereClause = sql;
        params = parameters ?? {};
        return qb;
      },
      execute: async () => {
        for (const row of this.rows) {
          let matches = true;
          if (params.userId !== undefined) matches = row.userId === params.userId;
          if (params.familyId !== undefined) matches = row.familyId === params.familyId;
          if (whereClause.includes('"revokedAt" IS NULL') && row.revokedAt !== null) matches = false;
          if (matches) Object.assign(row, patch);
        }
        return { affected: this.rows.length };
      },
    };
    return qb;
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
  let repo: InMemoryRefreshRepo;
  let service: RefreshTokenService;

  beforeEach(() => {
    repo = new InMemoryRefreshRepo();
    service = new RefreshTokenService(repo as unknown as Repository<RefreshToken>, config);
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

    const storedFirst = repo.rows.find((row) => row.tokenHash === first.entity.tokenHash)!;
    expect(storedFirst.revokedAt).not.toBeNull();
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const first = await service.issue('user-1');
    const rotated = await service.rotate(first.token);

    const error = await captureError(service.rotate(first.token));
    expect(error.getResponse()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });

    // the freshly rotated token is revoked too
    expect(repo.rows.every((row) => row.revokedAt !== null)).toBe(true);
    const followUp = await captureError(service.rotate(rotated.token));
    expect(followUp.getResponse()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
  });

  it('rejects an unknown token', async () => {
    const error = await captureError(service.rotate('does-not-exist'));
    expect(error.getResponse()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects an expired token', async () => {
    const issued = await service.issue('user-1');
    repo.rows[0].expiresAt = new Date(Date.now() - 1000);

    const error = await captureError(service.rotate(issued.token));
    expect(error.getResponse()).toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' });
    expect(repo.rows[0].revokedAt).toBeNull();
  });

  it('logout revokes a token and is idempotent', async () => {
    const issued = await service.issue('user-1');

    await service.revoke(issued.token);
    await service.revoke(issued.token);
    await service.revoke('unknown-token');

    expect(repo.rows[0].revokedAt).not.toBeNull();
  });

  it('revokeAllForUser only touches that user', async () => {
    await service.issue('user-1');
    await service.issue('user-1');
    await service.issue('user-2');

    await service.revokeAllForUser('user-1');

    expect(repo.rows.filter((row) => row.userId === 'user-1').every((row) => row.revokedAt !== null)).toBe(true);
    expect(repo.rows.filter((row) => row.userId === 'user-2').every((row) => row.revokedAt === null)).toBe(true);
  });
});
