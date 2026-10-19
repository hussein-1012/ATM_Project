import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import type { Maneuver } from '../routing/routing-provider.interface';

export enum RouteMode {
  WALK = 'walk',
  DRIVE = 'drive',
}

export class RouteWaypointDto {
  @ApiProperty({ example: 29.30837 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 30.84278 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class RouteRequestDto {
  @ApiProperty({ type: RouteWaypointDto, description: 'Current location' })
  @ValidateNested()
  @Type(() => RouteWaypointDto)
  from!: RouteWaypointDto;

  @ApiProperty({ format: 'uuid', description: 'Destination ATM' })
  @IsUUID('4')
  atmId!: string;

  @ApiProperty({ enum: RouteMode, example: RouteMode.WALK })
  @IsEnum(RouteMode)
  mode!: RouteMode;
}

export class RouteStepDto {
  @ApiProperty({
    enum: ['DEPART', 'STRAIGHT', 'TURN_LEFT', 'TURN_RIGHT', 'SLIGHT_LEFT', 'SLIGHT_RIGHT', 'UTURN', 'ARRIVE'],
  })
  maneuver!: Maneuver;

  @ApiProperty({ nullable: true, example: 'شارع الحرية' })
  streetName!: string | null;

  @ApiProperty({ example: 320 })
  distanceMeters!: number;

  @ApiProperty({ example: 90 })
  durationSeconds!: number;

  @ApiProperty({ type: RouteWaypointDto })
  location!: RouteWaypointDto;
}

export class RouteGeometryDto {
  @ApiProperty({ enum: ['LineString'], example: 'LineString' })
  type!: 'LineString';

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    example: [
      [30.84278, 29.30837],
      [30.8431, 29.3089],
    ],
    description: 'GeoJSON coordinates as [lng, lat]',
  })
  coordinates!: [number, number][];
}

export class RouteResponseDto {
  @ApiProperty({ example: 1850 })
  distanceMeters!: number;

  @ApiProperty({ example: 1480 })
  durationSeconds!: number;

  @ApiProperty({ example: false, description: 'true when this is a straight-line fallback' })
  approximate!: boolean;

  @ApiProperty({ type: RouteGeometryDto })
  polyline!: RouteGeometryDto;

  @ApiProperty({ type: [RouteStepDto] })
  steps!: RouteStepDto[];
}
