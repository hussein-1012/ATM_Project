import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { MailMessage, MailService } from './mail.service';
import { TravelMode, User } from '../users/entities/user.entity';
import type { UsersService } from '../users/users.service';
import type { OtpService } from './otp.service';
import type { RefreshTokenService } from './refresh-token.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Ahmed Ali',
    email: 'ahmed@example.com',
    passwordHash: 'hashed',
    preferredTravelMode: TravelMode.WALK,
    voiceGuidance: true,
    language: 'ar',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as User;
}

async function captureError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected the promise to reject');
}

describe('AuthService', () => {
  let users: jest.Mocked<UsersService>;
  let refreshTokens: jest.Mocked<RefreshTokenService>;
  let otp: jest.Mocked<OtpService>;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let mail: jest.Mocked<MailService>;
  let service: AuthService;

  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'a'.repeat(32),
        'jwt.accessTtl': '15m',
        'jwt.resetTtl': '10m',
        'otp.ttlSeconds': 600,
      })[key],
  } as unknown as ConfigService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getByIdOrFail: jest.fn(),
      create: jest.fn(),
      toDto: jest.fn((user: User) => ({ id: user.id, email: user.email }) as never),
      verifyPassword: jest.fn(),
      changePassword: jest.fn(),
      normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
    } as unknown as jest.Mocked<UsersService>;
    refreshTokens = {
      issue: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenService>;
    otp = { request: jest.fn(), verify: jest.fn() } as unknown as jest.Mocked<OtpService>;
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt'), verifyAsync: jest.fn() };
    mail = { send: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MailService>;

    service = new AuthService(
      users as unknown as UsersService,
      refreshTokens as unknown as RefreshTokenService,
      otp as unknown as OtpService,
      jwt as unknown as JwtService,
      config,
      mail,
    );
  });

  describe('register', () => {
    it('rejects an email that already exists', async () => {
      users.findByEmail!.mockResolvedValue(makeUser());

      const error = await captureError(service.register({ name: 'A', email: 'a@b.com', password: 'passw0rd1' }));
      expect(error.getResponse()).toMatchObject({ code: 'EMAIL_TAKEN' });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('creates the user and returns the public DTO', async () => {
      users.findByEmail!.mockResolvedValue(null);
      users.create!.mockResolvedValue(makeUser());

      const result = await service.register({ name: 'Ahmed', email: 'Ahmed@Example.com', password: 'passw0rd1' });

      expect(users.create).toHaveBeenCalledTimes(1);
      expect(result.user).toMatchObject({ id: 'user-1', email: 'ahmed@example.com' });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('rejects unknown users and wrong passwords with the same error', async () => {
      users.findByEmail!.mockResolvedValue(null);
      const unknown = await captureError(service.login({ email: 'x@y.com', password: 'nope' }));

      users.findByEmail!.mockResolvedValue(makeUser());
      users.verifyPassword!.mockResolvedValue(false);
      const wrong = await captureError(service.login({ email: 'ahmed@example.com', password: 'nope' }));

      expect(unknown.getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(wrong.getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('issues an access + refresh pair on success', async () => {
      users.findByEmail!.mockResolvedValue(makeUser());
      users.verifyPassword!.mockResolvedValue(true);
      refreshTokens.issue!.mockResolvedValue({ token: 'refresh-1', entity: {} as never });

      const result = await service.login({ email: 'ahmed@example.com', password: 'passw0rd1', deviceInfo: 'jest' });

      expect(result.accessToken).toBe('signed.jwt');
      expect(result.refreshToken).toBe('refresh-1');
      expect(refreshTokens.issue).toHaveBeenCalledWith('user-1', 'jest');
      expect(result.user).toMatchObject({ id: 'user-1' });
    });
  });

  describe('refresh', () => {
    it('rotates and returns a fresh pair', async () => {
      refreshTokens.rotate!.mockResolvedValue({ token: 'refresh-2', userId: 'user-1', entity: {} as never });
      users.findById!.mockResolvedValue(makeUser());

      const result = await service.refresh('refresh-1');

      expect(refreshTokens.rotate).toHaveBeenCalledWith('refresh-1');
      expect(result.refreshToken).toBe('refresh-2');
      expect(result.accessToken).toBe('signed.jwt');
    });

    it('fails when the token maps to a missing user', async () => {
      refreshTokens.rotate!.mockResolvedValue({ token: 'refresh-2', userId: 'user-1', entity: {} as never });
      users.findById!.mockResolvedValue(null);

      const error = await captureError(service.refresh('refresh-1'));
      expect(error.getResponse()).toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  it('logout revokes the refresh token', async () => {
    await expect(service.logout('refresh-1')).resolves.toEqual({ revoked: true });
    expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-1');
  });

  describe('forgotPassword (no account enumeration)', () => {
    it('returns the same response and sends nothing for an unknown email', async () => {
      users.findByEmail!.mockResolvedValue(null);

      await expect(service.forgotPassword('ghost@example.com')).resolves.toEqual({ sent: true });
      expect(otp.request).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('sends the OTP to a known email', async () => {
      users.findByEmail!.mockResolvedValue(makeUser());
      otp.request!.mockResolvedValue({ sent: true, code: '123456' });

      await expect(service.forgotPassword('Ahmed@Example.com')).resolves.toEqual({ sent: true });

      expect(otp.request).toHaveBeenCalledWith('ahmed@example.com');
      expect(mail.send).toHaveBeenCalledTimes(1);
      const message = mail.send.mock.calls[0][0] as MailMessage;
      expect(message.to).toBe('ahmed@example.com');
      expect(message.text).toContain('123456');
    });

    it('does not send when the resend cooldown is active', async () => {
      users.findByEmail!.mockResolvedValue(makeUser());
      otp.request!.mockResolvedValue({ sent: false });

      await service.forgotPassword('ahmed@example.com');
      expect(mail.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('exchanges a valid OTP for a reset token scoped to the user', async () => {
      otp.verify!.mockResolvedValue(undefined);
      users.findByEmail!.mockResolvedValue(makeUser());

      const result = await service.verifyOtp('Ahmed@Example.com', '123456');

      expect(result.resetToken).toBe('signed.jwt');
      expect(otp.verify).toHaveBeenCalledWith('ahmed@example.com', '123456');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', type: 'reset' }),
        expect.objectContaining({ expiresIn: '10m' }),
      );
    });

    it('fails if the OTP verifies but the user is gone', async () => {
      otp.verify!.mockResolvedValue(undefined);
      users.findByEmail!.mockResolvedValue(null);

      const error = await captureError(service.verifyOtp('ahmed@example.com', '123456'));
      expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
    });

    it('propagates the OTP error when the code is wrong', async () => {
      otp.verify!.mockRejectedValue(new HttpException({ code: 'OTP_INVALID' }, 401));

      const error = await captureError(service.verifyOtp('ahmed@example.com', '000000'));
      expect(error.getResponse()).toMatchObject({ code: 'OTP_INVALID' });
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid reset token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));

      const error = await captureError(service.resetPassword('bad-token', 'new-passw0rd1'));
      expect(error.getResponse()).toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    });

    it('rejects a token that is not of type reset', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'ahmed@example.com', type: 'access' });

      const error = await captureError(service.resetPassword('access-token', 'new-passw0rd1'));
      expect(error.getResponse()).toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    });

    it('updates the password and revokes every refresh token', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'ahmed@example.com', type: 'reset' });
      users.findById!.mockResolvedValue(makeUser());

      await expect(service.resetPassword('reset-token', 'new-passw0rd1')).resolves.toEqual({ reset: true });

      expect(users.changePassword).toHaveBeenCalledWith('user-1', 'new-passw0rd1');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password', async () => {
      users.getByIdOrFail!.mockResolvedValue(makeUser());
      users.verifyPassword!.mockResolvedValue(false);

      const error = await captureError(service.changePassword('user-1', 'wrong', 'new-passw0rd1'));
      expect(error.getResponse()).toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
      expect(users.changePassword).not.toHaveBeenCalled();
    });

    it('changes the password and revokes every refresh token', async () => {
      users.getByIdOrFail!.mockResolvedValue(makeUser());
      users.verifyPassword!.mockResolvedValue(true);

      await expect(service.changePassword('user-1', 'old-passw0rd1', 'new-passw0rd1')).resolves.toEqual({
        changed: true,
      });

      expect(users.changePassword).toHaveBeenCalledWith('user-1', 'new-passw0rd1');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
