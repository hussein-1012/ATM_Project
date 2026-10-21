import { Model, Types } from 'mongoose';
import { RecentSearch } from './entities/recent-search.entity';
import { RecentSearchesService } from './recent-searches.service';
import { RECENT_SEARCHES_KEEP } from '../../common/constants';

/** In-memory Mongoose Model<RecentSearch> for the operations the service uses. */
class InMemorySearchModel {
  rows: Array<{ _id: Types.ObjectId; userId: Types.ObjectId; query: string; createdAt: Date }> = [];
  private clock = 1_700_000_000_000;

  async create(data: { userId: Types.ObjectId; query: string }) {
    this.clock += 1;
    const doc = {
      _id: new Types.ObjectId(),
      id: '',
      userId: data.userId,
      query: data.query,
      createdAt: new Date(this.clock),
    };
    doc.id = doc._id.toHexString();
    this.rows.push(doc);
    return doc;
  }

  find(filter: Record<string, unknown> = {}) {
    const self = this;
    let result = self.rows.filter((row) => {
      if (filter.userId && row.userId.toString() !== filter.userId.toString()) return false;
      return true;
    });
    result = [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      sort: (_sort: Record<string, number>) => ({
        limit: (n: number) => ({
          exec: async () => result.slice(0, n),
        }),
        skip: (n: number) => ({
          select: (_s: string) => ({
            exec: async () => result.slice(n),
          }),
        }),
        exec: async () => result,
      }),
    };
  }

  async deleteMany(filter: Record<string, unknown>) {
    const before = this.rows.length;
    if (filter._id?.$in) {
      const ids = new Set((filter._id.$in as Types.ObjectId[]).map((id) => id.toString()));
      this.rows = this.rows.filter((row) => !ids.has(row._id.toString()));
    } else {
      this.rows = this.rows.filter((row) => {
        if (filter.userId && row.userId.toString() !== filter.userId.toString()) return true;
        if (filter.query !== undefined && row.query !== filter.query) return true;
        return false;
      });
    }
    return { deletedCount: before - this.rows.length };
  }
}

describe('RecentSearchesService', () => {
  let model: InMemorySearchModel;
  let service: RecentSearchesService;

  beforeEach(() => {
    model = new InMemorySearchModel();
    service = new RecentSearchesService(model as unknown as Model<RecentSearch>);
  });

  const userId = new Types.ObjectId().toHexString();
  const userId2 = new Types.ObjectId().toHexString();

  it('trims the query and stores it for the user', async () => {
    const saved = await service.add(userId, '  بنك مصر  ');
    expect(saved.query).toBe('بنك مصر');
  });

  it('dedupes by query, moving an existing query back to the top', async () => {
    await service.add(userId, 'atm');
    await service.add(userId, 'nbe');
    await service.add(userId, 'atm');

    const items = await service.list(userId);
    expect(items.map((item: any) => item.query)).toEqual(['atm', 'nbe']);
  });

  it(`keeps only the last ${RECENT_SEARCHES_KEEP} per user`, async () => {
    for (let i = 0; i < RECENT_SEARCHES_KEEP + 5; i += 1) {
      await service.add(userId, `query-${i}`);
    }

    const items = await service.list(userId);
    expect(items).toHaveLength(RECENT_SEARCHES_KEEP);
    expect(items[0].query).toBe(`query-${RECENT_SEARCHES_KEEP + 4}`);
    expect(items.some((item: any) => item.query === 'query-0')).toBe(false);
  });

  it('scopes trimming to the given user', async () => {
    for (let i = 0; i < RECENT_SEARCHES_KEEP + 2; i += 1) {
      await service.add(userId2, `other-${i}`);
    }
    await service.add(userId, 'mine');

    expect(await service.list(userId2)).toHaveLength(RECENT_SEARCHES_KEEP);
    expect(await service.list(userId)).toHaveLength(1);
  });

  it('lists newest first', async () => {
    await service.add(userId, 'first');
    await service.add(userId, 'second');
    await service.add(userId, 'third');

    const items = await service.list(userId);
    expect(items.map((item: any) => item.query)).toEqual(['third', 'second', 'first']);
  });

  it('clears every search for the user only', async () => {
    await service.add(userId, 'a');
    await service.add(userId, 'b');
    await service.add(userId2, 'c');

    await service.clear(userId);

    expect(await service.list(userId)).toHaveLength(0);
    expect(await service.list(userId2)).toHaveLength(1);
  });
});
