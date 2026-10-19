import { buildSearchText, normalizeArabic } from './arabic-normalize.util';

describe('normalizeArabic', () => {
  it('lowercases latin text', () => {
    expect(normalizeArabic('NBE ATM')).toBe('nbe atm');
  });

  it('unifies alef variants (أ/إ/آ/ٱ -> ا)', () => {
    expect(normalizeArabic('البنك الأهلي')).toBe('البنك الاهلي');
    expect(normalizeArabic('إطسا')).toBe('اطسا');
    expect(normalizeArabic('آدم')).toBe('ادم');
  });

  it('maps ة -> ه and ى -> ي', () => {
    expect(normalizeArabic('مدينة')).toBe('مدينه');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
  });

  it('strips harakat and tatweel', () => {
    expect(normalizeArabic('مَكْتَبَة')).toBe('مكتبه');
    expect(normalizeArabic('مـكـتـب')).toBe('مكتب');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeArabic('  بنك   مصر  ')).toBe('بنك مصر');
  });

  it('keeps mixed arabic + latin', () => {
    expect(normalizeArabic('QNB فرع الفيوم')).toBe('qnb فرع الفيوم');
  });
});

describe('buildSearchText', () => {
  it('joins non-empty parts with normalization', () => {
    expect(buildSearchText(['NBE ATM', null, 'بنك الأهلي', undefined, ''])).toBe(
      'nbe atm بنك الاهلي',
    );
  });

  it('returns empty string when nothing to join', () => {
    expect(buildSearchText([null, undefined])).toBe('');
  });
});
