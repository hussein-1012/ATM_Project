import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AUTH_THROTTLE } from '../../common/throttler/throttle-presets';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth-request.dto';
import {
  AuthResponseDto,
  ForgotPasswordResponseDto,
  LogoutResponseDto,
  ResetPasswordResponseDto,
  VerifyOtpResponseDto,
} from './dto/auth-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account' })
  @ApiOkResponse({ type: UserResponseDto })
  async register(@Body() dto: RegisterDto): Promise<{ user: UserResponseDto }> {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Log in and receive access + refresh tokens' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.auth.login({
      email: dto.email,
      password: dto.password,
      deviceInfo: req.headers['user-agent'],
    });
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate a refresh token',
    description:
      'Returns a new access + refresh pair. Presenting a previously rotated token revokes the entire token family (reuse detection).',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@Body() dto: RefreshTokenDto): Promise<{ revoked: boolean }> {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Send a 6-digit password-reset OTP',
    description:
      'Always returns the same response, whether or not the email exists. OTP lives 10 minutes in Redis, max 5 attempts, 60s resend cooldown.',
  })
  @ApiOkResponse({ type: ForgotPasswordResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ sent: boolean }> {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('verify-otp')
  @ApiOperation({ summary: 'Exchange a valid OTP for a short-lived reset token' })
  @ApiOkResponse({ type: VerifyOtpResponseDto })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ resetToken: string }> {
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password and revoke every refresh token' })
  @ApiOkResponse({ type: ResetPasswordResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<{ reset: boolean }> {
    return this.auth.resetPassword(dto.resetToken, dto.newPassword);
  }
}
