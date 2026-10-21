import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecentSearch, type RecentSearchDocument } from './entities/recent-search.entity';
import { RECENT_SEARCHES_KEEP } from '../../common/constants';

@Injectable()
export class RecentSearchesService {
  constructor(
    @InjectModel(RecentSearch.name)
    private readonly searchModel: Model<RecentSearch>,
  ) {}

  async list(userId: string): Promise<RecentSearchDocument[]> {
    return this.searchModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(RECENT_SEARCHES_KEEP)
      .exec();
  }

  /** Dedupe by query (moves an existing query back to the top), then trim to the last 10. */
  async add(userId: string, query: string): Promise<RecentSearchDocument> {
    const trimmed = query.trim();
    const uid = new Types.ObjectId(userId);

    await this.searchModel.deleteMany({ userId: uid, query: trimmed });

    const saved = await this.searchModel.create({ userId: uid, query: trimmed });

    // Trim to keep only the latest N entries
    const stale = await this.searchModel
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .skip(RECENT_SEARCHES_KEEP)
      .select('_id')
      .exec();
    if (stale.length) {
      await this.searchModel.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }
    return saved;
  }

  async clear(userId: string): Promise<void> {
    await this.searchModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}
