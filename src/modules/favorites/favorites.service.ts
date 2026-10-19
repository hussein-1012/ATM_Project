import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { AtmsService } from '../atms/atms.service';
import type { AtmResponseDto } from '../atms/dto/atm-response.dto';
import type { FavoriteListDto } from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    private readonly atms: AtmsService,
  ) {}

  /** Favorites newest-first, each hydrated with the full ATM DTO (+ optional distance). */
  async list(userId: string, ref?: { lat: number; lng: number }): Promise<FavoriteListDto> {
    const favorites = await this.favorites.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (favorites.length === 0) {
      return { items: [], meta: { count: 0 } };
    }

    const atms = await this.atms.findManyByIds(
      favorites.map((f) => f.atmId),
      ref,
    );
    const byId = new Map(atms.map((atm) => [atm.id, atm]));
    // Preserve favorite recency order; drop any favorite whose ATM has vanished.
    const items = favorites
      .map((f) => byId.get(f.atmId))
      .filter((atm): atm is AtmResponseDto => atm !== undefined);

    return { items, meta: { count: items.length } };
  }

  /** Idempotent add: returns the existing favorite if it is already saved. */
  async add(userId: string, atmId: string): Promise<Favorite> {
    if (!(await this.atms.exists(atmId))) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }

    const existing = await this.favorites.findOne({ where: { userId, atmId } });
    if (existing) return existing;

    return this.favorites.save(this.favorites.create({ userId, atmId }));
  }

  /** Idempotent remove. */
  async remove(userId: string, atmId: string): Promise<void> {
    await this.favorites.delete({ userId, atmId });
  }
}
