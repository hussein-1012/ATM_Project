import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { REPORT_THROTTLE } from '../../common/throttler/throttle-presets';
import {
  CreateReportDto,
  CreateReportResponseDto,
  ReportListDto,
  ReportListQueryDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('bearer')
@Controller('atms')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post(':id/reports')
  @Throttle(REPORT_THROTTLE)
  @ApiOperation({
    summary: 'Report an ATM status',
    description:
      'Crowd-sourced (never bank-confirmed). Rate-limited per user; the same user may report the same ATM once every 30 minutes.',
  })
  @ApiCreatedResponse({ type: CreateReportResponseDto })
  @ApiTooManyRequestsResponse({ description: 'REPORT_COOLDOWN — reported too recently' })
  @ApiNotFoundResponse({ description: 'ATM_NOT_FOUND' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Body() dto: CreateReportDto,
  ): Promise<CreateReportResponseDto> {
    const report = await this.reports.create(user.id, id, dto.status);
    return {
      report: {
        id: report.id,
        atmId: report.atmId.toString(),
        status: report.status,
        createdAt: report.createdAt,
      },
    };
  }

  @Get(':id/reports')
  @ApiOperation({ summary: 'List recent reports for an ATM (anonymized)' })
  @ApiOkResponse({ type: ReportListDto })
  @ApiNotFoundResponse({ description: 'ATM_NOT_FOUND' })
  async list(
    @Param('id', new ParseObjectIdPipe()) id: string,
    @Query() query: ReportListQueryDto,
  ): Promise<ReportListDto> {
    const reports = await this.reports.list(id, query.limit);
    return { items: reports.map((r) => ({ status: r.status, createdAt: r.createdAt })) };
  }
}
