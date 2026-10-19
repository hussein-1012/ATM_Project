import type { Repository } from 'typeorm';
import { RecentSearch } from './entities/recent-search.entity';
import { RecentSearchesService } from './recent-searches.service';
import { RECENT_SEARCHES_KEEP } from '../../common/constants';

/** In-memory Repository<RecentSearch> for the operations the service performs. */
class InMemorySearchRepo {
  rows: RecentSearch[] = [];
  private clock = 1_700_000_000_000;
  private seq = 0;

  create(data: Partial<RecentSearch>): RecentSearch {
    this.clock += 1;
    return { id: undefined, createdAt: new Date(this.clock), ...data } as unknown as RecentSearch;
  }

  async save(entity: RecentSearch): Promise<RecentSearch> {
    if (!entity.id) {
      entity.id = `s${++this.seq}`;
      this.rows.push(entity);
    }
    return entity;
  }

  async find(options: {
    where?: { userId?: string };
    order?: { createdAt?: 'DESC' | 'ASC' };
    skip?: number;
    take?: number;
  } = {}): Promise<RecentSearch[]> {
    let result = this.rows.filter((row) => !options.where?.userId || row.userId === options.where.userId);
    result = [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (options.skip) result = result.slice(options.skip);
    if (options.take) result = result.slice(0, options.take);
    return result;
  }

  async delete(criteria: { userId?: string; query?: string } | string[]): Promise<{ affected: number }> {
    const before = this.rows.length;
    if (Array.isArray(criteria)) {
      const ids = new Set(criteria);
      this.rows = this.rows.filter((row) => !ids.has(row.id));
    } else if (criteria.query !== undefined) {
      this.rows = this.rows.filter((row) => !(row.userId === criteria.userId && row.query === criteria.query));
    } else {
      this.rows = this.rows.filter((row) => row.userId !== criteria.userId);
    }
    return { affected: before - this.rows.length };
  }
}

describe('RecentSearchesService', () => {
  let repo: InMemorySearchRepo;
  let service: RecentSearchesService;

  beforeEach(() => {
    repo = new InMemorySearchRepo();
    service = new RecentSearchesService(repo as unknown as Repository<RecentSearch>);
  });

  it('trims the query and stores it for the user', async () => {
    const saved = await service.add('user-1', '  بنك مصر  ');
    expect(saved.query).toBe('بنك مصر');
    expect(saved.userId).toBe('user-1');
  });

  it('dedupes by query, moving an existing query back to the top', async () => {
    await service.add('user-1', 'atm');
    await service.add('user-1', 'nbe');
    await service.add('user-1', 'atm');

    const items = await service.list('user-1');
    expect(items.map((item) => item.query)).toEqual(['atm', 'nbe']);
  });

  it(`keeps only the last ${RECENT_SEARCHES_KEEP} per user`, async () => {
    for (let i = 0; i < RECENT_SEARCHES_KEEP + 5; i += 1) {
      await service.add('user-1', `query-${i}`);
    }

    const items = await service.list('user-1');
    expect(items).toHaveLength(RECENT_SEARCHES_KEEP);
    expect(items[0].query).toBe(`query-${RECENT_SEARCHES_KEEP + 4}`);
    expect(items.some((item) => item.query === 'query-0')).toBe(false);
  });

  it('scopes trimming to the given user', async () => {
    for (let i = 0; i < RECENT_SEARCHES_KEEP + 2; i += 1) {
      await service.add('user-2', `other-${i}`);
    }
    await service.add('user-1', 'mine');

    expect(await service.list('user-2')).toHaveLength(RECENT_SEARCHES_KEEP);
    expect(await service.list('user-1')).toHaveLength(1);
  });

  it('lists newest first', async () => {
    await service.add('user-1', 'first');
    await service.add('user-1', 'second');
    await service.add('user-1', 'third');

    const items = await service.list('user-1');
    expect(items.map((item) => item.query)).toEqual(['third', 'second', 'first']);
  });

  it('clears every search for the user only', async () => {
    await service.add('user-1', 'a');
    await service.add('user-1', 'b');
    await service.add('user-2', 'c');

    await service.clear('user-1');

    expect(await service.list('user-1')).toHaveLength(0);
    expect(await service.list('user-2')).toHaveLength(1);
  });
});
