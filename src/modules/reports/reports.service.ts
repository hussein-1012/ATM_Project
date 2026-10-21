import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AtmReport, AtmReportStatus, type AtmReportDocument } from '../atms/entities/atm-report.entity';
import { AtmsService } from '../atms/atms.service';

export class ReportCooldownError extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      {
        message: `You can report this ATM again in ${Math.ceil(retryAfterSeconds / 60)} min`,
        code: 'REPORT_COOLDOWN',
      },
      429,
    );
  }
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(AtmReport.name) private readonly reportModel: Model<AtmReport>,
    private readonly atms: AtmsService,
    private readonly config: ConfigService,
  ) {}

  private cooldownMs(): number {
    return (this.config.get<number>('reports.cooldownMinutes') ?? 30) * 60_000;
  }

  /**
   * One report per user per ATM per cooldown window (default 30 min).
   */
  async create(userId: string, atmId: string, status: AtmReportStatus): Promise<AtmReportDocument> {
    await this.assertAtmExists(atmId);

    const since = new Date(Date.now() - this.cooldownMs());
    const recent = await this.reportModel.findOne({
      userId: new Types.ObjectId(userId),
      atmId: new Types.ObjectId(atmId),
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 }).exec();

    if (recent) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((recent.createdAt.getTime() + this.cooldownMs() - Date.now()) / 1000),
      );
      throw new ReportCooldownError(retryAfterSeconds);
    }

    return this.reportModel.create({
      userId: new Types.ObjectId(userId),
      atmId: new Types.ObjectId(atmId),
      status,
    });
  }

  /** Recent reports for an ATM, newest first (anonymized by the controller). */
  async list(atmId: string, limit: number): Promise<AtmReportDocument[]> {
    await this.assertAtmExists(atmId);
    return this.reportModel
      .find({ atmId: new Types.ObjectId(atmId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  private async assertAtmExists(atmId: string): Promise<void> {
    if (!(await this.atms.exists(atmId))) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }
  }
}
