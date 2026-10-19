import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { AtmBank } from '../atms/entities/atm-bank.enum';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService();
  });

  describe('normalizeQuery', () => {
    it('unifies Arabic letter variants, strips diacritics/tatweel and lowercases', () => {
      expect(service.normalizeQuery('أحمد')).toBe('احمد');
      expect(service.normalizeQuery('إسكندرية')).toBe('اسكندريه');
      expect(service.normalizeQuery('مِصْـــر')).toBe('مصر');
      expect(service.normalizeQuery('BANK MISR')).toBe('bank misr');
    });

    it('collapses runs of whitespace', () => {
      expect(service.normalizeQuery('  بنك   مصر  ')).toBe('بنك مصر');
    });
  });

  describe('likePattern', () => {
    it('wraps the normalized query in wildcards', () => {
      expect(service.likePattern('بنك')).toBe('%بنك%');
    });

    it('escapes LIKE metacharacters so they match literally', () => {
      expect(service.likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
    });
  });

  describe('build', () => {
    it('is an empty filter when nothing is provided', () => {
      expect(service.build({})).toEqual({ whereSql: '', values: [], distanceSql: null });
    });

    it('builds an ILIKE clause with an escaped pattern for q', () => {
      const built = service.build({ q: 'بنك مصر' });
      expect(built.whereSql).toBe(`a."searchText" ILIKE $1 ESCAPE '\\'`);
      expect(built.values).toEqual(['%بنك مصر%']);
      expect(built.distanceSql).toBeNull();
    });

    it('ignores a whitespace-only q', () => {
      expect(service.build({ q: '   ' }).whereSql).toBe('');
    });

    it('binds a location as lng then lat and exposes a distance expression', () => {
      const built = service.build({ lat: 29.3, lng: 30.8 });
      expect(built.values).toEqual([30.8, 29.3]);
      expect(built.distanceSql).toBe(
        'ST_Distance(a."location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)',
      );
      expect(built.whereSql).toBe('');
    });

    it('binds bank and wheelchair filters', () => {
      const built = service.build({ bank: AtmBank.NBE, wheelchair: true });
      expect(built.values).toEqual([AtmBank.NBE]);
      expect(built.whereSql).toBe(`a."bank" = $1 AND a."wheelchairAccessible" IS TRUE`);
    });

    it('keeps placeholder order consistent across all filters', () => {
      const built = service.build({
        q: 'بنك',
        bank: AtmBank.NBE,
        wheelchair: true,
        lat: 29.3,
        lng: 30.8,
        maxDistance: 5000,
      });
      expect(built.values).toEqual([30.8, 29.3, '%بنك%', AtmBank.NBE, 5000]);
      expect(built.whereSql).toBe(
        `a."searchText" ILIKE $3 ESCAPE '\\' AND a."bank" = $4 AND a."wheelchairAccessible" IS TRUE AND ST_DWithin(a."location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $5)`,
      );
      expect(built.distanceSql).toBe(
        'ST_Distance(a."location", ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)',
      );
    });

    it('rejects maxDistance without a reference location', () => {
      let error: unknown;
      try {
        service.build({ maxDistance: 5000 });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'MAX_DISTANCE_REQUIRES_LOCATION',
      });
    });

    it('rejects maxDistance when only one coordinate is supplied', () => {
      expect(() => service.build({ maxDistance: 5000, lat: 29.3 })).toThrow(BadRequestException);
      expect(() => service.build({ maxDistance: 5000, lng: 30.8 })).toThrow(BadRequestException);
    });
  });
});
