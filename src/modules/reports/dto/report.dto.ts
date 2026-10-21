import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AtmReportStatus } from '../../atms/entities/atm-report.entity';
import {
  REPORT_RECENT_LIST_LIMIT,
  REPORT_RECENT_LIST_MAX,
} from '../../../common/constants';

export class CreateReportDto {
  @ApiProperty({
    enum: AtmReportStatus,
    description: 'Crowd-sourced observation; never treated as bank-confirmed.',
  })
  @IsEnum(AtmReportStatus)
  status!: AtmReportStatus;
}

export class ReportDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  atmId!: string;

  @ApiProperty({ enum: AtmReportStatus })
  status!: AtmReportStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class CreateReportResponseDto {
  @ApiProperty({ type: ReportDto })
  report!: ReportDto;
}

export class ReportListItemDto {
  @ApiProperty({ enum: AtmReportStatus })
  status!: AtmReportStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class ReportListDto {
  @ApiProperty({ type: [ReportListItemDto], description: 'Anonymized — no user ids' })
  items!: ReportListItemDto[];
}

export class ReportListQueryDto {
  @ApiPropertyOptional({ default: REPORT_RECENT_LIST_LIMIT, maximum: REPORT_RECENT_LIST_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_RECENT_LIST_MAX)
  limit: number = REPORT_RECENT_LIST_LIMIT;
}
