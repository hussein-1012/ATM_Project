import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AtmReport, AtmReportStatus } from './entities/atm-report.entity';
import { cairoStartOfDay } from '../../common/utils/time.util';

export type ReportSummaryStatus = AtmReportStatus | 'UNKNOWN';

export interface ReportSummary {
  status: ReportSummaryStatus;
  reportedAt: string | null;
  reportsToday: number;
}

export interface DatedReport {
  status: AtmReportStatus;
  createdAt: Date;
}

const WEIGHT_EPSILON = 1e-9;

/**
 * Recency-weighted consensus over the reports in the freshness window.
 * weight = 2 − ageHours/freshHours (so the newest report counts ~2×).
 * Highest total weight wins; a tie is UNKNOWN; no reports is UNKNOWN.
 * This is crowd-sourced and NEVER presented as bank-confirmed.
 */
export function summarizeReports(
  reports: DatedReport[],
  options: { now: Date; freshHours: number; startOfDay: Date },
): ReportSummary {
  const { now, freshHours, startOfDay } = options;
  const freshSince = now.getTime() - freshHours * 3_600_000;

  const weights = new Map<AtmReportStatus, number>();
  for (const report of reports) {
    if (report.createdAt.getTime() < freshSince) continue;
    const ageHours = (now.getTime() - report.createdAt.getTime()) / 3_600_000;
    const weight = 2 - ageHours / freshHours;
    weights.set(report.status, (weights.get(report.status) ?? 0) + weight);
  }

  const reportsToday = reports.filter((r) => r.createdAt.getTime() >= startOfDay.getTime()).length;
  const newest = reports.reduce<Date | null>(
    (acc, r) => (acc === null || r.createdAt.getTime() > acc.getTime() ? r.createdAt : acc),
    null,
  );

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  let status: ReportSummaryStatus = 'UNKNOWN';
  if (ranked.length > 0) {
    const bestWeight = ranked[0][1];
    const tied = ranked.filter(([, weight]) => Math.abs(weight - bestWeight) < WEIGHT_EPSILON).length > 1;
    status = tied ? 'UNKNOWN' : ranked[0][0];
  }

  return {
    status,
    reportedAt: newest ? newest.toISOString() : null,
    reportsToday,
  };
}

@Injectable()
export class ReportSummaryService {
  constructor(
    @InjectModel(AtmReport.name) private readonly reportModel: Model<AtmReport>,
    private readonly config: ConfigService,
  ) {}

  private freshHours(): number {
    return this.config.get<number>('reports.freshHours') ?? 6;
  }

  async forAtm(atmId: string, now: Date = new Date()): Promise<ReportSummary> {
    const startOfDay = cairoStartOfDay(now);
    const freshSince = new Date(now.getTime() - this.freshHours() * 3_600_000);
    // Fetch anything newer than the earlier of "start of today" and the
    // freshness window; covers both the status window and the today count.
    const since = freshSince.getTime() < startOfDay.getTime() ? freshSince : startOfDay;

    const rows = await this.reportModel
      .find({ atmId, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .exec();

    const summary = summarizeReports(rows, {
      now,
      freshHours: this.freshHours(),
      startOfDay,
    });

    if (!summary.reportedAt) {
      // No recent reports: still surface the last time this ATM was reported.
      const latest = await this.reportModel
        .findOne({ atmId })
        .sort({ createdAt: -1 })
        .exec();
      if (latest) summary.reportedAt = latest.createdAt.toISOString();
    }

    return summary;
  }
}
