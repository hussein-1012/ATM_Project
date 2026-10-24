import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { TravelMode } from '../entities/user.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ahmed Ali', minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({ enum: TravelMode })
  @IsOptional()
  @IsEnum(TravelMode)
  preferredTravelMode?: TravelMode;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  voiceGuidance?: boolean;

  @ApiPropertyOptional({ example: 'ar', minLength: 2, maxLength: 10 })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-secret-1', description: 'Current password' })
  @IsString()
  @Length(8, 128)
  currentPassword!: string;

  @ApiProperty({ example: 'new-secret-1', description: 'New password (min 8 chars)' })
  @IsString()
  @Length(8, 128)
  newPassword!: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'current-secret-1', description: 'Current password for confirmation' })
  @IsString()
  @Length(1, 128)
  password!: string;
}
