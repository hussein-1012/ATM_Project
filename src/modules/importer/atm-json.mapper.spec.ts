import { AtmJsonMapper } from './atm-json.mapper';
import { AtmBank } from '../atms/entities/atm-bank.enum';

const validBase = {
  title: 'NBE ATM - Fayoum University - جامعة الفيوم',
  address: 'Campus - Fayoum University, Faiyum Governorate, Egypt',
  location: { lat: 29.3218925, lng: 30.8383375 },
  categories: ['ATM'],
  placeId: 'ChIJB8un0GN5WRQRJhhvhxa_uwM',
  openingHours: [
    { day: 'Monday', hours: 'Open 24 hours' },
    { day: 'Sunday', hours: 'Open 24 hours' },
  ],
};

describe('AtmJsonMapper', () => {
  const mapper = new AtmJsonMapper('google_places');

  it('maps a valid ATM record', () => {
    const result = mapper.map(validBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('NBE ATM - Fayoum University - جامعة الفيوم');
    expect(result.value.bank).toBe(AtmBank.NBE);
    expect(result.value.lat).toBeCloseTo(29.3218925);
    expect(result.value.lng).toBeCloseTo(30.8383375);
    expect(result.value.sourceId).toBe('ChIJB8un0GN5WRQRJhhvhxa_uwM');
    expect(result.value.is24h).toBe(true);
    expect(result.value.openingHours).toBeNull();
    expect(result.value.wheelchairAccessible).toBeNull();
    expect(result.value.searchText).toContain('جامعه الفيوم');
    expect(result.value.searchText).toContain('الاهلي');
  });

  it('never carries phone / ratings / photos / plus codes', () => {
    const result = mapper.map({
      ...validBase,
      phone: '+201000000000',
      totalScore: 4.5,
      reviewsCount: 12,
      imagesCount: 3,
      plusCode: '86XG+7C Fayoum',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const json = JSON.stringify(result.value);
    expect(json).not.toContain('201000000000');
    expect(json).not.toContain('86XG+7C');
    expect(json).not.toContain('totalScore');
  });

  describe('bank detection', () => {
    const cases: Array<[string, AtmBank]> = [
      ['Banque Misr - Fayoum', AtmBank.BANQUE_MISR],
      ['بنك مصر فرع الفيوم الجديدة', AtmBank.BANQUE_MISR],
      ['البنك الاهلى المصري فرع الفيوم', AtmBank.NBE],
      ['Natioal Bank of Egypt', AtmBank.NBE],
      ['ATM البنك الزراعي المصري', AtmBank.AGRICULTURAL_BANK],
      ['بنك الإسكندرية', AtmBank.ALEXANDRIA_BANK],
      ['QNB alahli ATM', AtmBank.QNB],
      ['CIB - ATM', AtmBank.CIB],
      ['ATM بنك القاهرة Banque du caire', AtmBank.BANQUE_DU_CAIRE],
      ['البنك العربي الافريقي الدولي', AtmBank.AAIB],
      ['ATM بنك كريدي اجريكول', AtmBank.CREDIT_AGRICOLE],
      ['البريد المصرى', AtmBank.POSTAL],
      ['Orange Shop', AtmBank.OTHER],
    ];
    it.each(cases)('detects %s', (title, expected) => {
      const result = mapper.map({ ...validBase, title, placeId: `p-${expected}-${title}` });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.bank).toBe(expected);
    });
  });

  describe('category filtering', () => {
    it('keeps bank branches', () => {
      const result = mapper.map({
        ...validBase,
        title: 'بنك مصر فرع أطسا',
        categories: ['Savings bank'],
        placeId: 'branch-1',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isBranch).toBe(true);
    });

    it('skips non-ATM noise records', () => {
      const result = mapper.map({
        ...validBase,
        title: 'Orange Boutique',
        categories: ['Cell phone store'],
        placeId: 'noise-1',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('NOT_ATM_CATEGORY');
    });

    it('skips permanently closed places', () => {
      const result = mapper.map({ ...validBase, placeId: 'closed-1', permanentlyClosed: true });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('PERMANENTLY_CLOSED');
    });

    it('keeps temporarily closed places (can reopen, users can report)', () => {
      const result = mapper.map({
        ...validBase,
        placeId: 'temp-closed-1',
        temporarilyClosed: true,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects an empty name', () => {
      const result = mapper.map({ ...validBase, title: '   ' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('EMPTY_NAME');
    });

    it('rejects missing coordinates', () => {
      const result = mapper.map({ ...validBase, location: null });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('MISSING_LOCATION');
    });

    it('rejects non-numeric coordinates', () => {
      const result = mapper.map({ ...validBase, location: { lat: 'x', lng: 30.8 } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('INVALID_RECORD');
    });

    it('rejects coordinates outside Egypt', () => {
      const result = mapper.map({ ...validBase, location: { lat: 40.7, lng: -74.0 } });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('OUTSIDE_EGYPT');
    });

    it('rejects structurally invalid records', () => {
      const result = mapper.map({ title: 123, categories: 'not-an-array' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('INVALID_RECORD');
    });
  });

  describe('deterministic sourceId fallback', () => {
    it('derives a stable hash when placeId is absent', () => {
      const a = mapper.map({ ...validBase, placeId: null });
      const b = mapper.map({ ...validBase, placeId: null });
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.value.sourceId).toBe(b.value.sourceId);
      expect(a.value.sourceId.startsWith('gen_')).toBe(true);
    });

    it('changes when coordinates change', () => {
      const a = mapper.map({ ...validBase, placeId: null });
      const b = mapper.map({
        ...validBase,
        placeId: null,
        location: { lat: 29.4218925, lng: 30.8383375 },
      });
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(a.value.sourceId).not.toBe(b.value.sourceId);
    });
  });

  describe('opening hours parsing', () => {
    it('parses simple 12h ranges', () => {
      const result = mapper.map({
        ...validBase,
        placeId: 'hours-1',
        openingHours: [
          { day: 'Monday', hours: '8:30 AM to 2 PM' },
          { day: 'Tuesday', hours: 'Closed' },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.is24h).toBe(false);
      expect(result.value.openingHours).toEqual({
        monday: [{ open: '08:30', close: '14:00' }],
        tuesday: [],
      });
    });

    it('inherits the meridiem when one side lacks it', () => {
      const result = mapper.map({
        ...validBase,
        placeId: 'hours-2',
        openingHours: [{ day: 'Monday', hours: '1 to 9 PM' }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.openingHours).toEqual({ monday: [{ open: '13:00', close: '21:00' }] });
    });

    it('keeps overnight intervals (close < open)', () => {
      const result = mapper.map({
        ...validBase,
        placeId: 'hours-3',
        openingHours: [{ day: 'Monday', hours: '8 AM to 3 AM' }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.openingHours).toEqual({ monday: [{ open: '08:00', close: '03:00' }] });
    });

    it('returns null hours when nothing parses', () => {
      const result = mapper.map({
        ...validBase,
        placeId: 'hours-4',
        openingHours: [{ day: 'Monday', hours: 'whenever' }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.openingHours).toBeNull();
      expect(result.value.is24h).toBeNull();
    });

    it('returns null hours when the record has none', () => {
      const result = mapper.map({ ...validBase, placeId: 'hours-5', openingHours: null });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.is24h).toBeNull();
    });
  });
});
