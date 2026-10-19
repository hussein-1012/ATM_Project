import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Atm } from './entities/atm.entity';
import { AtmReport } from './entities/atm-report.entity';
import { AtmsController } from './atms.controller';
import { AtmsService } from './atms.service';
import { AtmsRepository } from './atms.repository';
import { OpenNowService } from './open-now.service';
import { ReportSummaryService } from './report-summary.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Atm, AtmReport]), SearchModule],
  controllers: [AtmsController],
  providers: [AtmsService, AtmsRepository, OpenNowService, ReportSummaryService],
  exports: [AtmsService, AtmsRepository, OpenNowService, ReportSummaryService],
})
export class AtmsModule {}
