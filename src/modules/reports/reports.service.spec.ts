import { HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
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
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let atms: jest.Mocked<Pick<AtmsService, 'exists'>>;
  let service: ReportsService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: Partial<AtmReport>) => data),
      save: jest.fn((data: Partial<AtmReport>) => Promise.resolve({ id: 'r1', ...data })),
    };
    atms = { exists: jest.fn().mockResolvedValue(true) };
    const config = { get: jest.fn(() => 30) } as unknown as ConfigService;
    service = new ReportsService(
      repository as unknown as Repository<AtmReport>,
      atms as unknown as AtmsService,
      config,
    );
  });

  describe('create', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      const error = await capture(service.create('user-1', 'missing', AtmReportStatus.WORKING));
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toMatchObject({ code: 'ATM_NOT_FOUND' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a second report within the cooldown with 429 REPORT_COOLDOWN', async () => {
      repository.findOne.mockResolvedValue({ createdAt: new Date(Date.now() - 5 * 60_000) });

      const error = await capture(service.create('user-1', 'atm-1', AtmReportStatus.OUT_OF_CASH));
      expect(error.getStatus()).toBe(429);
      expect(error.getResponse()).toMatchObject({ code: 'REPORT_COOLDOWN' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('saves a report when no recent one exists', async () => {
      repository.findOne.mockResolvedValue(null);

      const report = await service.create('user-1', 'atm-1', AtmReportStatus.WORKING);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        atmId: 'atm-1',
        status: AtmReportStatus.WORKING,
      });
      expect(report).toMatchObject({ id: 'r1', status: AtmReportStatus.WORKING });
    });

    it('only looks back within the cooldown window', async () => {
      await service.create('user-1', 'atm-1', AtmReportStatus.WORKING);

      const where = repository.findOne.mock.calls[0][0].where as Record<string, unknown>;
      expect(where).toMatchObject({ userId: 'user-1', atmId: 'atm-1' });
      expect(where.createdAt).toBeDefined();
    });
  });

  describe('list', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      const error = await capture(service.list('missing', 10));
      expect(error).toBeInstanceOf(NotFoundException);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('returns recent reports newest first with the requested limit', async () => {
      repository.find.mockResolvedValue([{ status: AtmReportStatus.WORKING, createdAt: new Date() }]);

      const rows = await service.list('atm-1', 5);

      expect(repository.find).toHaveBeenCalledWith({
        where: { atmId: 'atm-1' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      expect(rows).toHaveLength(1);
    });
  });
});
