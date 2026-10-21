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

  describe('build', () => {
    it('returns an empty filter object when nothing is provided', () => {
      const built = service.build({});
      expect(built).toEqual({
        q: undefined,
        bank: undefined,
        wheelchair: undefined,
        maxDistance: undefined,
        lat: undefined,
        lng: undefined,
      });
    });

    it('passes through q filter', () => {
      const built = service.build({ q: 'بنك مصر' });
      expect(built.q).toBe('بنك مصر');
    });

    it('passes through bank and wheelchair filters', () => {
      const built = service.build({ bank: AtmBank.NBE, wheelchair: true });
      expect(built.bank).toBe(AtmBank.NBE);
      expect(built.wheelchair).toBe(true);
    });

    it('passes through location and maxDistance', () => {
      const built = service.build({
        q: 'بنك',
        bank: AtmBank.NBE,
        wheelchair: true,
        lat: 29.3,
        lng: 30.8,
        maxDistance: 5000,
      });
      expect(built.lat).toBe(29.3);
      expect(built.lng).toBe(30.8);
      expect(built.maxDistance).toBe(5000);
      expect(built.bank).toBe(AtmBank.NBE);
      expect(built.q).toBe('بنك');
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
