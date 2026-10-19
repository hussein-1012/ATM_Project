import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AtmBank } from '../entities/atm-bank.enum';
import type { OpeningHours } from '../entities/atm.entity';
import type { OpenNowStatus } from '../open-now.service';
import type { ReportSummaryStatus } from '../report-summary.service';

export class AtmLocationDto {
  @ApiProperty({ example: 29.30837 })
  lat!: number;

  @ApiProperty({ example: 30.84278 })
  lng!: number;
}

export class ReportSummaryDto {
  @ApiProperty({
    enum: ['WORKING', 'OUT_OF_CASH', 'OUT_OF_SERVICE', 'UNKNOWN'],
    description:
      'Crowd-sourced consensus (recency-weighted, last 6h). NEVER bank-confirmed.',
  })
  status!: ReportSummaryStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  reportedAt!: string | null;

  @ApiProperty({ example: 3, description: 'Reports since midnight (Africa/Cairo)' })
  reportsToday!: number;
}

export class AtmResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NBE ATM - Fayoum University' })
  name!: string;

  @ApiProperty({ enum: AtmBank })
  bank!: AtmBank;

  @ApiProperty({ example: 'Campus - Fayoum University, Faiyum Governorate, Egypt' })
  address!: string;

  @ApiProperty({ type: AtmLocationDto })
  location!: AtmLocationDto;

  @ApiProperty({ example: false })
  isBranch!: boolean;

  @ApiProperty({ type: Object, nullable: true, description: 'Per-weekday intervals in Africa/Cairo time' })
  openingHours!: OpeningHours | null;

  @ApiProperty({ nullable: true, example: true })
  is24h!: boolean | null;

  @ApiProperty({ nullable: true, example: false })
  wheelchairAccessible!: boolean | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  sourceFetchedAt!: string | null;

  @ApiProperty({ enum: ['OPEN', 'CLOSED', 'UNKNOWN'], description: 'Computed at request time (Africa/Cairo)' })
  openNow!: OpenNowStatus;

  @ApiPropertyOptional({ example: 412.3 })
  distanceMeters?: number;

  @ApiPropertyOptional({ example: 6, description: 'ceil(distanceMeters / 78 m/min)' })
  walkMinutes?: number;

  @ApiPropertyOptional({ example: 1, description: 'ceil(distanceMeters / 25 km/h urban)' })
  driveMinutes?: number;

  @ApiProperty({ example: true, description: 'Travel times are estimates, not live routing' })
  travelTimesAreEstimates!: true;
}

export class AtmDetailResponseDto extends AtmResponseDto {
  @ApiProperty({ type: ReportSummaryDto })
  reportSummary!: ReportSummaryDto;
}

export class NearbyMetaDto {
  @ApiProperty({ example: 29.30837 })
  lat!: number;

  @ApiProperty({ example: 30.84278 })
  lng!: number;

  @ApiProperty({ example: 3000 })
  radius!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class NearbyResponseDto {
  @ApiProperty({ type: [AtmResponseDto] })
  items!: AtmResponseDto[];

  @ApiProperty({ type: NearbyMetaDto })
  meta!: NearbyMetaDto;
}

export class SearchMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class SearchResponseDto {
  @ApiProperty({ type: [AtmResponseDto] })
  items!: AtmResponseDto[];

  @ApiProperty({ type: SearchMetaDto })
  meta!: SearchMetaDto;
}
