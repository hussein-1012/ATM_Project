import { ApiProperty } from '@nestjs/swagger';
import { TravelMode } from '../entities/user.entity';

/** Public user representation — never includes passwordHash or deletedAt. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ahmed Ali' })
  name!: string;

  @ApiProperty({ example: 'ahmed@example.com' })
  email!: string;

  @ApiProperty({ enum: TravelMode, example: TravelMode.WALK })
  preferredTravelMode!: TravelMode;

  @ApiProperty({ example: true })
  voiceGuidance!: boolean;

  @ApiProperty({ example: 'ar' })
  language!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
