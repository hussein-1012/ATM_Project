import { UnauthorizedException } from '@nestjs/common';
import { AccountController } from './account.controller';
import type { AuthService } from './auth.service';
import type { RefreshTokenService } from './refresh-token.service';
import type { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/entities/user.entity';

describe('AccountController', () => {
  let controller: AccountController;
  let users: jest.Mocked<Partial<UsersService>>;
  let auth: jest.Mocked<Partial<AuthService>>;
  let refreshTokens: jest.Mocked<Partial<RefreshTokenService>>;

  const mockUserDoc = { id: 'user-1', name: 'Ahmed', email: 'ahmed@example.com' } as unknown as UserDocument;
  const authUser = { id: 'user-1', email: 'ahmed@example.com' };

  beforeEach(() => {
    users = {
      getByIdOrFail: jest.fn().mockResolvedValue(mockUserDoc),
      toDto: jest.fn().mockImplementation((u: any) => ({ id: u.id, name: u.name, email: u.email })),
      updateProfile: jest.fn().mockResolvedValue({ ...mockUserDoc, name: 'Ali' }),
      verifyPassword: jest.fn(),
      softDeleteAndAnonymize: jest.fn().mockResolvedValue(undefined),
    };
    auth = {
      changePassword: jest.fn().mockResolvedValue({ changed: true }),
    };
    refreshTokens = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };

    controller = new AccountController(
      users as unknown as UsersService,
      auth as unknown as AuthService,
      refreshTokens as unknown as RefreshTokenService,
    );
  });

  describe('me', () => {
    it('returns the current user profile', async () => {
      const res = await controller.me(authUser);
      expect(users.getByIdOrFail).toHaveBeenCalledWith('user-1');
      expect(res).toEqual({ id: 'user-1', name: 'Ahmed', email: 'ahmed@example.com' });
    });
  });

  describe('update', () => {
    it('updates user profile', async () => {
      const res = await controller.update(authUser, { name: 'Ali' });
      expect(users.updateProfile).toHaveBeenCalledWith('user-1', { name: 'Ali' });
      expect(res).toEqual({ id: 'user-1', name: 'Ali', email: 'ahmed@example.com' });
    });
  });

  describe('changePassword', () => {
    it('delegates to authService.changePassword', async () => {
      const res = await controller.changePassword(authUser, {
        currentPassword: 'old',
        newPassword: 'new',
      });
      expect(auth.changePassword).toHaveBeenCalledWith('user-1', 'old', 'new');
      expect(res).toEqual({ changed: true });
    });
  });

  describe('remove', () => {
    it('requires valid password confirmation before deleting', async () => {
      users.verifyPassword!.mockResolvedValue(true);

      await controller.remove(authUser, { password: 'valid-password' });

      expect(users.verifyPassword).toHaveBeenCalledWith(mockUserDoc, 'valid-password');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(users.softDeleteAndAnonymize).toHaveBeenCalledWith('user-1');
    });

    it('rejects deletion when password confirmation fails', async () => {
      users.verifyPassword!.mockResolvedValue(false);

      await expect(
        controller.remove(authUser, { password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(users.softDeleteAndAnonymize).not.toHaveBeenCalled();
    });
  });
});
