import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';
import type { AtmsService } from '../atms/atms.service';
import type { AtmResponseDto } from '../atms/dto/atm-response.dto';

function atm(id: string): AtmResponseDto {
  return { id, name: id } as unknown as AtmResponseDto;
}

describe('FavoritesService', () => {
  let model: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    deleteOne: jest.Mock;
  };
  let atms: jest.Mocked<Pick<AtmsService, 'exists' | 'findManyByIds'>>;
  let service: FavoritesService;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockResolvedValue({ atmId: new Types.ObjectId(), createdAt: new Date() }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    atms = {
      exists: jest.fn().mockResolvedValue(true),
      findManyByIds: jest.fn().mockResolvedValue([]),
    };
    service = new FavoritesService(
      model as unknown as Model<Favorite>,
      atms as unknown as AtmsService,
    );
  });

  describe('list', () => {
    it('returns an empty result without touching ATM hydration', async () => {
      const result = await service.list('aaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result).toEqual({ items: [], meta: { count: 0 } });
      expect(atms.findManyByIds).not.toHaveBeenCalled();
    });

    it('preserves favorite recency order regardless of the ATM query order', async () => {
      const atmId2 = new Types.ObjectId();
      const atmId1 = new Types.ObjectId();
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            { atmId: atmId2, createdAt: new Date('2026-01-02') },
            { atmId: atmId1, createdAt: new Date('2026-01-01') },
          ]),
        }),
      });
      atms.findManyByIds.mockResolvedValue([
        atm(atmId1.toString()),
        atm(atmId2.toString()),
      ]);

      const result = await service.list('aaaaaaaaaaaaaaaaaaaaaaaa');

      expect(result.items.map((item) => item.id)).toEqual([atmId2.toString(), atmId1.toString()]);
      expect(result.meta.count).toBe(2);
    });
  });

  describe('add', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      await expect(service.add('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is idempotent: returns the existing favorite without creating again', async () => {
      const atmId = new Types.ObjectId();
      const existing = { atmId, createdAt: new Date() };
      model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });

      const favorite = await service.add('aaaaaaaaaaaaaaaaaaaaaaaa', atmId.toString());

      expect(favorite.atmId).toBe(atmId.toString());
      expect(model.create).not.toHaveBeenCalled();
    });
  });

  it('removes a favorite idempotently', async () => {
    await service.remove('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(model.deleteOne).toHaveBeenCalled();
  });
});
