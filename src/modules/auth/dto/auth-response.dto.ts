import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token (short-lived)' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque refresh token (store securely; rotates on use)' })
  refreshToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: true,
    description: 'Always true, whether or not the email exists (no account enumeration).',
  })
  sent!: boolean;
}

export class VerifyOtpResponseDto {
  @ApiProperty({ description: 'Short-lived token for POST /auth/reset-password' })
  resetToken!: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: true })
  reset!: boolean;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  revoked!: boolean;
}
