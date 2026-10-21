import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AtmReport, AtmReportSchema } from '../atms/entities/atm-report.entity';
import { AtmsModule } from '../atms/atms.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AtmReport.name, schema: AtmReportSchema }]),
    AtmsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
