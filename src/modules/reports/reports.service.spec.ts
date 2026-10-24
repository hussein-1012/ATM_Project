import { HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AtmReport, AtmReportStatus } from '../atms/entities/atm-report.entity';
import { ReportsService } from './reports.service';
import type { AtmsService } from '../atms/atms.service';

function capture(promise: Promise<unknown>): Promise<HttpException> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (error: HttpException) => error,
  );
}

describe('ReportsService', () => {
  let model: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };
  let atms: jest.Mocked<Pick<AtmsService, 'exists'>>;
  let service: ReportsService;

  beforeEach(() => {
    model = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      }),
      create: jest.fn().mockImplementation((data: Partial<AtmReport>) =>
        Promise.resolve({ id: 'r1', ...data }),
      ),
    };
    atms = { exists: jest.fn().mockResolvedValue(true) };
    const config = { get: jest.fn(() => 30) } as unknown as ConfigService;
    service = new ReportsService(
      model as unknown as Model<AtmReport>,
      atms as unknown as AtmsService,
      config,
    );
  });

  describe('create', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      const error = await capture(service.create('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', AtmReportStatus.WORKING));
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({ code: 'ATM_NOT_FOUND' });
    });

    it('rejects a second report within the cooldown with 429 REPORT_COOLDOWN', async () => {
      model.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ createdAt: new Date(Date.now() - 5 * 60_000) }),
        }),
      });

      const error = await capture(service.create('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', AtmReportStatus.OUT_OF_CASH));
      expect(error.getStatus()).toBe(429);
      expect(error.getResponse()).toMatchObject({ code: 'REPORT_COOLDOWN' });
    });

    it('saves a report when no recent one exists', async () => {
      const report = await service.create('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', AtmReportStatus.WORKING);

      expect(model.create).toHaveBeenCalled();
      expect(report).toMatchObject({ id: 'r1', status: AtmReportStatus.WORKING });
    });
  });

  describe('list', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      const error = await capture(service.list('bbbbbbbbbbbbbbbbbbbbbbbb', 10));
      expect(error).toBeInstanceOf(NotFoundException);
    });
  });
});
