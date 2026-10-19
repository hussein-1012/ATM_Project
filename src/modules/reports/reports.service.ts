import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AtmReport, AtmReportStatus } from '../atms/entities/atm-report.entity';
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
    @InjectRepository(AtmReport) private readonly reports: Repository<AtmReport>,
    private readonly atms: AtmsService,
    private readonly config: ConfigService,
  ) {}

  private cooldownMs(): number {
    return (this.config.get<number>('reports.cooldownMinutes') ?? 30) * 60_000;
  }

  /**
   * One report per user per ATM per cooldown window (default 30 min). The
   * cooldown check hits the partial (userId, atmId, createdAt) index.
   */
  async create(userId: string, atmId: string, status: AtmReportStatus): Promise<AtmReport> {
    await this.assertAtmExists(atmId);

    const since = new Date(Date.now() - this.cooldownMs());
    const recent = await this.reports.findOne({
      where: { userId, atmId, createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'DESC' },
    });
    if (recent) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((recent.createdAt.getTime() + this.cooldownMs() - Date.now()) / 1000),
      );
      throw new ReportCooldownError(retryAfterSeconds);
    }

    const report = this.reports.create({ userId, atmId, status });
    return this.reports.save(report);
  }

  /** Recent reports for an ATM, newest first (anonymized by the controller). */
  async list(atmId: string, limit: number): Promise<AtmReport[]> {
    await this.assertAtmExists(atmId);
    return this.reports.find({
      where: { atmId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async assertAtmExists(atmId: string): Promise<void> {
    if (!(await this.atms.exists(atmId))) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }
  }
}
