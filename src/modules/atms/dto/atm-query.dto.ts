import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { AtmBank } from '../entities/atm-bank.enum';
import {
  NEARBY_DEFAULT_LIMIT,
  NEARBY_DEFAULT_RADIUS_M,
  NEARBY_MAX_LIMIT,
  NEARBY_MAX_RADIUS_M,
  RECENT_SEARCH_MAX_LENGTH,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_DISTANCE_M,
  SEARCH_MAX_LIMIT,
} from '../../../common/constants';

/** Query strings are strings; convert "true"/"1" (and real booleans) to boolean. */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value; // leave invalid values for @IsBoolean to reject
};

export class NearbyQueryDto {
  @ApiProperty({ example: 29.30837, description: 'Requesting latitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 30.84278, description: 'Requesting longitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    default: NEARBY_DEFAULT_RADIUS_M,
    maximum: NEARBY_MAX_RADIUS_M,
    description: 'Search radius in meters',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEARBY_MAX_RADIUS_M)
  radius: number = NEARBY_DEFAULT_RADIUS_M;

  @ApiPropertyOptional({ default: NEARBY_DEFAULT_LIMIT, maximum: NEARBY_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEARBY_MAX_LIMIT)
  limit: number = NEARBY_DEFAULT_LIMIT;
}

export class SearchQueryDto {
  @ApiPropertyOptional({ example: 'بنك مصر', maxLength: RECENT_SEARCH_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @Length(1, RECENT_SEARCH_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({ enum: AtmBank })
  @IsOptional()
  @IsEnum(AtmBank)
  bank?: AtmBank;

  @ApiPropertyOptional({ description: 'Only ATMs that are open right now (excludes unknown hours)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ description: 'Only wheelchair-accessible ATMs' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  wheelchair?: boolean;

  @ApiPropertyOptional({
    maximum: SEARCH_MAX_DISTANCE_M,
    description: 'Max distance in meters (requires lat & lng)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SEARCH_MAX_DISTANCE_M)
  maxDistance?: number;

  @ApiPropertyOptional({ example: 29.30837, description: 'Reference latitude (for distance)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 30.84278, description: 'Reference longitude (for distance)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: SEARCH_DEFAULT_LIMIT, maximum: SEARCH_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SEARCH_MAX_LIMIT)
  limit: number = SEARCH_DEFAULT_LIMIT;
}

export class AtmIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  id!: string;
}

export class AtmDetailQueryDto {
  @ApiPropertyOptional({ example: 29.30837 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 30.84278 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
