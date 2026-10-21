import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './entities/favorite.entity';
import { AtmsService } from '../atms/atms.service';
import type { AtmResponseDto } from '../atms/dto/atm-response.dto';
import type { FavoriteListDto } from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<Favorite>,
    private readonly atms: AtmsService,
  ) {}

  /** Favorites newest-first, each hydrated with the full ATM DTO (+ optional distance). */
  async list(userId: string, ref?: { lat: number; lng: number }): Promise<FavoriteListDto> {
    const favorites = await this.favoriteModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    if (favorites.length === 0) {
      return { items: [], meta: { count: 0 } };
    }

    const atms = await this.atms.findManyByIds(
      favorites.map((f) => f.atmId.toString()),
      ref,
    );
    const byId = new Map(atms.map((atm) => [atm.id, atm]));
    // Preserve favorite recency order; drop any favorite whose ATM has vanished.
    const items = favorites
      .map((f) => byId.get(f.atmId.toString()))
      .filter((atm): atm is AtmResponseDto => atm !== undefined);

    return { items, meta: { count: items.length } };
  }

  /** Idempotent add: returns the existing favorite if it is already saved. */
  async add(userId: string, atmId: string): Promise<{ atmId: string; createdAt: Date }> {
    if (!(await this.atms.exists(atmId))) {
      throw new NotFoundException({ message: 'ATM not found', code: 'ATM_NOT_FOUND' });
    }

    const existing = await this.favoriteModel.findOne({
      userId: new Types.ObjectId(userId),
      atmId: new Types.ObjectId(atmId),
    }).exec();
    if (existing) return { atmId: existing.atmId.toString(), createdAt: existing.createdAt };

    const created = await this.favoriteModel.create({
      userId: new Types.ObjectId(userId),
      atmId: new Types.ObjectId(atmId),
    });
    return { atmId: created.atmId.toString(), createdAt: created.createdAt };
  }

  /** Idempotent remove. */
  async remove(userId: string, atmId: string): Promise<void> {
    await this.favoriteModel.deleteOne({
      userId: new Types.ObjectId(userId),
      atmId: new Types.ObjectId(atmId),
    });
  }
}
