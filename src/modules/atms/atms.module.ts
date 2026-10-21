import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Atm, AtmSchema } from './entities/atm.entity';
import { AtmReport, AtmReportSchema } from './entities/atm-report.entity';
import { AtmsController } from './atms.controller';
import { AtmsService } from './atms.service';
import { AtmsRepository } from './atms.repository';
import { OpenNowService } from './open-now.service';
import { ReportSummaryService } from './report-summary.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Atm.name, schema: AtmSchema },
      { name: AtmReport.name, schema: AtmReportSchema },
    ]),
    SearchModule,
  ],
  controllers: [AtmsController],
  providers: [AtmsService, AtmsRepository, OpenNowService, ReportSummaryService],
  exports: [AtmsService, AtmsRepository, OpenNowService, ReportSummaryService],
})
export class AtmsModule {}
