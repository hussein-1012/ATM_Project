import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecentSearch } from './entities/recent-search.entity';
import { RECENT_SEARCHES_KEEP } from '../../common/constants';

@Injectable()
export class RecentSearchesService {
  constructor(
    @InjectRepository(RecentSearch)
    private readonly searches: Repository<RecentSearch>,
  ) {}

  async list(userId: string): Promise<RecentSearch[]> {
    return this.searches.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: RECENT_SEARCHES_KEEP,
    });
  }

  /** Dedupe by query (moves an existing query back to the top), then trim to the last 10. */
  async add(userId: string, query: string): Promise<RecentSearch> {
    const trimmed = query.trim();
    await this.searches.delete({ userId, query: trimmed });

    const entity = this.searches.create({ userId, query: trimmed });
    const saved = await this.searches.save(entity);

    const stale = await this.searches.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: RECENT_SEARCHES_KEEP,
      select: ['id'],
    });
    if (stale.length) {
      await this.searches.delete(stale.map((s) => s.id));
    }
    return saved;
  }

  async clear(userId: string): Promise<void> {
    await this.searches.delete({ userId });
  }
}
