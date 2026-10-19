import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MAIL_SERVICE, MailMessage } from '../src/modules/auth/mail.service';

/**
 * Phase 3 acceptance: register / login / refresh (+ reuse detection) / logout,
 * the full OTP forgot → verify → reset flow, and all OTP limits.
 *
 * Requires the docker-compose postgres + redis. Throttling is disabled here
 * (it has its own unit coverage) so a single suite can hammer the auth routes.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: unknown;
  let dataSource: DataSource;

  const sentMails: MailMessage[] = [];
  const userIds: string[] = [];
  const password = 'passw0rd-123';

  const uniqueEmail = (): string =>
    `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

  const post = (path: string): request.Test => request(server as never).post(`/v1${path}`);
  const get = (path: string): request.Test => request(server as never).get(`/v1${path}`);

  const register = (email: string, pw = password): request.Test =>
    post('/auth/register').send({ name: 'E2E User', email, password: pw });

  const login = (email: string, pw = password): request.Test =>
    post('/auth/login').send({ email, password: pw });

  /** Registers a fresh account and returns its lowercase email + id + tokens. */
  async function createAccount(): Promise<{
    email: string;
    id: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const email = uniqueEmail();
    const created = await register(email).expect(201);
    const id: string = created.body.user.id;
    userIds.push(id);

    const loggedIn = await login(email).expect(200);
    return {
      email,
      id,
      accessToken: loggedIn.body.accessToken,
      refreshToken: loggedIn.body.refreshToken,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(MAIL_SERVICE)
      .useValue({
        send: async (message: MailMessage): Promise<void> => {
          sentMails.push(message);
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, { docs: false });
    await app.init();

    server = app.getHttpServer();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (userIds.length) {
      await dataSource.query('DELETE FROM refresh_tokens WHERE "userId" = ANY($1)', [userIds]);
      await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }
    await app.close();
  });

  describe('register', () => {
    it('creates an account and returns the public user (no secrets)', async () => {
      const email = uniqueEmail();
      const res = await register(email).expect(201);

      userIds.push(res.body.user.id);
      expect(res.body.user).toMatchObject({ email: email.toLowerCase() });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('deletedAt');
    });

    it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
      const email = uniqueEmail();
      const created = await register(email).expect(201);
      userIds.push(created.body.user.id);

      const res = await register(email).expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
    });

    it('rejects unknown fields and weak passwords with 400 VALIDATION_ERROR', async () => {
      const extra = await post('/auth/register')
        .send({ name: 'A', email: uniqueEmail(), password, isAdmin: true })
        .expect(400);
      expect(extra.body).toMatchObject({ code: 'VALIDATION_ERROR' });

      const weak = await register(uniqueEmail(), '123').expect(400);
      expect(weak.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('login', () => {
    it('returns an access + refresh pair', async () => {
      const email = uniqueEmail();
      const created = await register(email).expect(201);
      userIds.push(created.body.user.id);

      const res = await login(email).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ id: created.body.user.id });
    });

    it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      const email = uniqueEmail();
      const created = await register(email).expect(201);
      userIds.push(created.body.user.id);

      const res = await login(email, 'wrong-password').expect(401);
      expect(res.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('protected route /me', () => {
    it('requires a bearer token', async () => {
      const res = await get('/me').expect(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('returns the current user for a valid token', async () => {
      const account = await createAccount();
      const res = await get('/me')
        .set('Authorization', `Bearer ${account.accessToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: account.id });
    });
  });

  describe('refresh + reuse detection', () => {
    it('rotates the token and revokes the family when a rotated token is reused', async () => {
      const account = await createAccount();

      const rotated = await post('/auth/refresh')
        .send({ refreshToken: account.refreshToken })
        .expect(200);
      expect(rotated.body.refreshToken).not.toBe(account.refreshToken);

      // Reusing the old token is treated as compromise.
      const reuse = await post('/auth/refresh')
        .send({ refreshToken: account.refreshToken })
        .expect(401);
      expect(reuse.body).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });

      // The freshly issued token was revoked together with the family.
      const afterFamilyRevoke = await post('/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
      expect(afterFamilyRevoke.body).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
    });

    it('rejects an unknown token', async () => {
      const res = await post('/auth/refresh').send({ refreshToken: 'not-a-real-token' }).expect(401);
      expect(res.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and is idempotent', async () => {
      const account = await createAccount();

      await post('/auth/logout').send({ refreshToken: account.refreshToken }).expect(200);
      await post('/auth/logout').send({ refreshToken: account.refreshToken }).expect(200);

      const res = await post('/auth/refresh')
        .send({ refreshToken: account.refreshToken })
        .expect(401);
      expect(res.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });

  describe('password reset via OTP', () => {
    it('never reveals whether an email exists', async () => {
      const known = await createAccount();

      const existing = await post('/auth/forgot-password').send({ email: known.email }).expect(200);
      const unknown = await post('/auth/forgot-password')
        .send({ email: uniqueEmail() })
        .expect(200);

      expect(existing.body).toEqual({ sent: true });
      expect(unknown.body).toEqual(existing.body);
    });

    it('completes forgot → verify → reset and revokes existing sessions', async () => {
      const account = await createAccount();
      sentMails.length = 0;

      await post('/auth/forgot-password').send({ email: account.email }).expect(200);
      expect(sentMails).toHaveLength(1);
      const code = sentMails[0].text.match(/\b(\d{6})\b/)?.[1];
      expect(code).toBeDefined();

      const wrong = await post('/auth/verify-otp')
        .send({ email: account.email, otp: code === '000000' ? '111111' : '000000' })
        .expect(401);
      expect(wrong.body).toMatchObject({ code: 'OTP_INVALID' });

      const verified = await post('/auth/verify-otp')
        .send({ email: account.email, otp: code })
        .expect(200);
      expect(verified.body.resetToken).toEqual(expect.any(String));

      const newPassword = 'brand-new-passw0rd';
      await post('/auth/reset-password')
        .send({ resetToken: verified.body.resetToken, newPassword })
        .expect(200);

      // old password no longer works, the new one does
      await login(account.email, password).expect(401);
      await login(account.email, newPassword).expect(200);

      // the session created before the reset was revoked
      const reused = await post('/auth/refresh')
        .send({ refreshToken: account.refreshToken })
        .expect(401);
      expect(reused.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('locks the OTP after the attempt cap', async () => {
      const account = await createAccount();
      sentMails.length = 0;

      await post('/auth/forgot-password').send({ email: account.email }).expect(200);
      const code = sentMails[0].text.match(/\b(\d{6})\b/)![1];
      const bad = code === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await post('/auth/verify-otp')
          .send({ email: account.email, otp: bad })
          .expect(401);
        expect(res.body).toMatchObject({ code: 'OTP_INVALID' });
      }

      const locked = await post('/auth/verify-otp')
        .send({ email: account.email, otp: bad })
        .expect(401);
      expect(locked.body).toMatchObject({ code: 'OTP_MAX_ATTEMPTS' });
    });
  });
});
