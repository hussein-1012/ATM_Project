import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MAIL_SERVICE, MailService } from './mail.service';
import { OtpService } from './otp.service';
import { RefreshTokenService } from './refresh-token.service';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/entities/user.entity';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { UserResponseDto } from '../users/dto/user-response.dto';
import { parseDurationMs } from '../../common/utils/duration.util';

interface ResetTokenPayload {
  sub: string;
  email: string;
  type: 'reset';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(MAIL_SERVICE) private readonly mail: MailService,
  ) {}

  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: UserResponseDto }> {
    const existing = await this.users.findByEmail(data.email);
    if (existing) {
      throw new ConflictException({ message: 'Email is already registered', code: 'EMAIL_TAKEN' });
    }
    const user = await this.users.create(data);
    return { user: this.users.toDto(user) };
  }

  async login(data: {
    email: string;
    password: string;
    deviceInfo?: string;
  }): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(data.email);
    if (!user || !(await this.users.verifyPassword(user, data.password))) {
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }
    return this.issueSession(user, data.deviceInfo);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(rotated.userId);
    if (!user) {
      throw new UnauthorizedException({ message: 'User not found', code: 'UNAUTHORIZED' });
    }
    return {
      accessToken: await this.signAccessToken(user.id, user.email),
      refreshToken: rotated.token,
      user: this.users.toDto(user),
    };
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    await this.refreshTokens.revoke(refreshToken);
    return { revoked: true };
  }

  /**
   * Always resolves the same way. The OTP is only generated for existing
   * accounts, so the presence of an email cannot be probed.
   */
  async forgotPassword(email: string): Promise<{ sent: boolean }> {
    const user = await this.users.findByEmail(email);
    if (!user) return { sent: true };

    const result = await this.otp.request(this.users.normalizeEmail(email));
    if (result.sent && result.code) {
      const ttlMinutes = Math.round((this.config.get<number>('otp.ttlSeconds') ?? 600) / 60);
      await this.mail.send({
        to: user.email,
        subject: 'Aqrab Makina Leek — Password Reset Code',
        text:
          `Your password reset code is ${result.code}. ` +
          `It expires in ${ttlMinutes} minutes. ` +
          'If you did not request this, please ignore this message.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Aqrab Makina Leek</h2>
            <p style="text-align: center; color: #64748b; margin-top: 0;">أقرب ماكينة ليك — إعادة تعيين كلمة المرور</p>
            <p style="color: #334155; font-size: 15px;">Hello <strong>${user.name}</strong>,</p>
            <p style="color: #334155; font-size: 15px;">You requested a password reset. Use the following 6-digit verification code to complete the process:</p>
            <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0284c7; margin: 24px 0;">
              ${result.code}
            </div>
            <p style="color: #64748b; font-size: 14px;">This code is valid for <strong>${ttlMinutes} minutes</strong>. Do not share this code with anyone.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });
    }
    return { sent: true };
  }

  async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const normalized = this.users.normalizeEmail(email);
    await this.otp.verify(normalized, otp);

    const user = await this.users.findByEmail(normalized);
    if (!user) {
      throw new UnauthorizedException({ message: 'Invalid or expired OTP', code: 'OTP_INVALID' });
    }

    const payload: ResetTokenPayload = { sub: user.id, email: user.email, type: 'reset' };
    const resetToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.resetTtl') as never,
    });
    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ reset: boolean }> {
    let payload: ResetTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ResetTokenPayload>(resetToken, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }
    if (payload.type !== 'reset') {
      throw new UnauthorizedException({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    await this.users.changePassword(user.id, newPassword);
    await this.refreshTokens.revokeAllForUser(user.id);
    return { reset: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: boolean }> {
    const user = await this.users.getByIdOrFail(userId);
    if (!(await this.users.verifyPassword(user, currentPassword))) {
      throw new UnauthorizedException({
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }
    await this.users.changePassword(user.id, newPassword);
    await this.refreshTokens.revokeAllForUser(user.id);
    return { changed: true };
  }

  private async issueSession(user: UserDocument, deviceInfo?: string): Promise<AuthResponseDto> {
    const [accessToken, refresh] = await Promise.all([
      this.signAccessToken(user.id, user.email),
      this.refreshTokens.issue(user.id, deviceInfo),
    ]);
    return { accessToken, refreshToken: refresh.token, user: this.users.toDto(user) };
  }

  private signAccessToken(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email, type: 'access' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl') as never,
      },
    );
  }

  /** Exposed for tests / future use. */
  protected accessTokenTtlMs(): number {
    return parseDurationMs(this.config.get<string>('jwt.accessTtl') ?? '15m', 15 * 60_000);
  }
}
