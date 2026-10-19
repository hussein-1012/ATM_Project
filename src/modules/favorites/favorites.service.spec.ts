import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';
import type { AtmsService } from '../atms/atms.service';
import type { AtmResponseDto } from '../atms/dto/atm-response.dto';

function atm(id: string): AtmResponseDto {
  return { id, name: id } as unknown as AtmResponseDto;
}

describe('FavoritesService', () => {
  let repository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let atms: jest.Mocked<Pick<AtmsService, 'exists' | 'findManyByIds'>>;
  let service: FavoritesService;

  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data: Partial<Favorite>) => data),
      save: jest.fn((data: Partial<Favorite>) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    atms = {
      exists: jest.fn().mockResolvedValue(true),
      findManyByIds: jest.fn().mockResolvedValue([]),
    };
    service = new FavoritesService(
      repository as unknown as Repository<Favorite>,
      atms as unknown as AtmsService,
    );
  });

  describe('list', () => {
    it('returns an empty result without touching ATM hydration', async () => {
      const result = await service.list('user-1');
      expect(result).toEqual({ items: [], meta: { count: 0 } });
      expect(atms.findManyByIds).not.toHaveBeenCalled();
    });

    it('preserves favorite recency order regardless of the ATM query order', async () => {
      repository.find.mockResolvedValue([
        { atmId: 'atm-2', createdAt: new Date('2026-01-02') },
        { atmId: 'atm-1', createdAt: new Date('2026-01-01') },
      ]);
      atms.findManyByIds.mockResolvedValue([atm('atm-1'), atm('atm-2')]);

      const result = await service.list('user-1');

      expect(result.items.map((item) => item.id)).toEqual(['atm-2', 'atm-1']);
      expect(result.meta.count).toBe(2);
    });

    it('drops favorites whose ATM no longer exists', async () => {
      repository.find.mockResolvedValue([
        { atmId: 'atm-2', createdAt: new Date('2026-01-02') },
        { atmId: 'gone', createdAt: new Date('2026-01-01') },
      ]);
      atms.findManyByIds.mockResolvedValue([atm('atm-2')]);

      const result = await service.list('user-1');

      expect(result.items.map((item) => item.id)).toEqual(['atm-2']);
      expect(result.meta.count).toBe(1);
    });

    it('passes the reference point through to hydrate distances', async () => {
      repository.find.mockResolvedValue([{ atmId: 'atm-1', createdAt: new Date() }]);
      atms.findManyByIds.mockResolvedValue([atm('atm-1')]);

      await service.list('user-1', { lat: 29.3, lng: 30.8 });

      expect(atms.findManyByIds).toHaveBeenCalledWith(['atm-1'], { lat: 29.3, lng: 30.8 });
    });
  });

  describe('add', () => {
    it('rejects an unknown ATM with 404', async () => {
      atms.exists.mockResolvedValue(false);

      await expect(service.add('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('is idempotent: returns the existing favorite without saving again', async () => {
      const existing = { userId: 'user-1', atmId: 'atm-1', createdAt: new Date() } as Favorite;
      repository.findOne.mockResolvedValue(existing);

      const favorite = await service.add('user-1', 'atm-1');

      expect(favorite).toBe(existing);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('saves a new favorite', async () => {
      const favorite = await service.add('user-1', 'atm-1');

      expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1', atmId: 'atm-1' });
      expect(repository.save).toHaveBeenCalled();
      expect(favorite).toMatchObject({ userId: 'user-1', atmId: 'atm-1' });
    });
  });

  it('removes a favorite idempotently', async () => {
    await service.remove('user-1', 'atm-1');
    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1', atmId: 'atm-1' });
  });
});
