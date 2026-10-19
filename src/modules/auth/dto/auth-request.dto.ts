import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ahmed Ali', minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: 'ahmed@example.com' })
  @IsEmail()
  @Length(3, 255)
  email!: string;

  @ApiProperty({ example: 'strong-password-1', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ahmed@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strong-password-1' })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque refresh token returned by login/refresh' })
  @IsString()
  @Length(10, 512)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ahmed@example.com' })
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'ahmed@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '012345', description: '6-digit OTP' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Short-lived token returned by verify-otp' })
  @IsString()
  @Length(10, 2048)
  resetToken!: string;

  @ApiProperty({ example: 'brand-new-password-1', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
