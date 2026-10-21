import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AtmReport, AtmReportStatus } from './entities/atm-report.entity';
import {
  ReportSummaryService,
  summarizeReports,
  type DatedReport,
} from './report-summary.service';

const HOUR = 3_600_000;

function report(status: AtmReportStatus, createdAt: Date): DatedReport {
  return { status, createdAt };
}

describe('summarizeReports', () => {
  const now = new Date('2026-01-15T12:00:00Z');
  const startOfDay = new Date('2026-01-15T00:00:00Z');
  const options = { now, freshHours: 6, startOfDay };

  it('reports UNKNOWN with no reports', () => {
    expect(summarizeReports([], options)).toEqual({
      status: 'UNKNOWN',
      reportedAt: null,
      reportsToday: 0,
    });
  });

  it('echoes a single status', () => {
    const summary = summarizeReports([report(AtmReportStatus.WORKING, new Date(now.getTime() - HOUR))], options);
    expect(summary.status).toBe(AtmReportStatus.WORKING);
    expect(summary.reportedAt).toBe(new Date(now.getTime() - HOUR).toISOString());
  });

  it('weights the newer report higher within the freshness window', () => {
    const summary = summarizeReports(
      [
        report(AtmReportStatus.WORKING, new Date(now.getTime() - 1 * HOUR)),
        report(AtmReportStatus.OUT_OF_CASH, new Date(now.getTime() - 5 * HOUR)),
      ],
      options,
    );
    expect(summary.status).toBe(AtmReportStatus.WORKING);
  });

  it('returns UNKNOWN when the top statuses tie on weight', () => {
    const summary = summarizeReports(
      [
        report(AtmReportStatus.WORKING, new Date(now.getTime() - 3 * HOUR)),
        report(AtmReportStatus.OUT_OF_CASH, new Date(now.getTime() - 3 * HOUR)),
      ],
      options,
    );
    expect(summary.status).toBe('UNKNOWN');
  });

  it('ignores reports older than the freshness window for status', () => {
    const summary = summarizeReports(
      [report(AtmReportStatus.OUT_OF_SERVICE, new Date(now.getTime() - 20 * HOUR))],
      options,
    );
    expect(summary.status).toBe('UNKNOWN');
    // The last time the ATM was reported is still surfaced.
    expect(summary.reportedAt).toBe(new Date(now.getTime() - 20 * HOUR).toISOString());
    expect(summary.reportsToday).toBe(0);
  });

  it('counts reportsToday from the start-of-day boundary inclusively', () => {
    const summary = summarizeReports(
      [
        report(AtmReportStatus.WORKING, new Date(startOfDay.getTime() - 1)),
        report(AtmReportStatus.WORKING, new Date(startOfDay.getTime())),
        report(AtmReportStatus.WORKING, new Date(now.getTime() - HOUR)),
      ],
      options,
    );
    expect(summary.reportsToday).toBe(2);
  });

  it('accumulates weight across several reports of the same status', () => {
    // Two recent OUT_OF_CASH reports outweigh one slightly newer WORKING one.
    const summary = summarizeReports(
      [
        report(AtmReportStatus.WORKING, new Date(now.getTime() - 1 * HOUR)),
        report(AtmReportStatus.OUT_OF_CASH, new Date(now.getTime() - 2 * HOUR)),
        report(AtmReportStatus.OUT_OF_CASH, new Date(now.getTime() - 2 * HOUR)),
      ],
      options,
    );
    expect(summary.status).toBe(AtmReportStatus.OUT_OF_CASH);
  });
});

describe('ReportSummaryService', () => {
  let model: { find: jest.Mock; findOne: jest.Mock };
  let service: ReportSummaryService;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
    };
    const config = { get: jest.fn(() => 6) } as unknown as ConfigService;
    service = new ReportSummaryService(model as unknown as Model<AtmReport>, config);
  });

  it('summarizes the recent rows without a fallback lookup', async () => {
    const createdAt = new Date(Date.now() - HOUR);
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ status: AtmReportStatus.WORKING, createdAt }]),
      }),
    });

    const summary = await service.forAtm('aaaaaaaaaaaaaaaaaaaaaaaa');

    expect(model.find).toHaveBeenCalledTimes(1);
    expect(model.findOne).not.toHaveBeenCalled();
    expect(summary.status).toBe(AtmReportStatus.WORKING);
  });

  it('falls back to the latest report time when nothing is recent', async () => {
    const latest = new Date('2025-12-01T00:00:00Z');
    model.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ createdAt: latest }) }),
    });

    const summary = await service.forAtm('aaaaaaaaaaaaaaaaaaaaaaaa');

    expect(model.findOne).toHaveBeenCalledTimes(1);
    expect(summary.status).toBe('UNKNOWN');
    expect(summary.reportedAt).toBe(latest.toISOString());
  });

  it('keeps reportedAt null when the ATM was never reported', async () => {
    const summary = await service.forAtm('aaaaaaaaaaaaaaaaaaaaaaaa');

    expect(summary.reportedAt).toBeNull();
  });
});
