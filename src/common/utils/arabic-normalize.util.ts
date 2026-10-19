/**
 * Arabic normalization for search (case- and diacritics-insensitive matching).
 * Applied identically to stored text (importer) and query strings (search).
 */

/**
 * Harakat/tashkeel: fathatan..superscript alef (U+064B..U+0652),
 * superscript alef (U+0670), Quranic marks U+06D6..U+06ED.
 */
const DIACRITICS_RE = /[ً-ٰٰۖ-ۭ]/g;
const TATWEEL_RE = /ـ/g;

const LETTER_MAP: Record<string, string> = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ة': 'ه',
  'ى': 'ي',
  'ؤ': 'و',
  'ئ': 'ي',
};

/** Lowercase, strip diacritics/tatweel, unify Arabic letter variants, collapse whitespace. */
export function normalizeArabic(input: string): string {
  let out = input.toLowerCase();
  out = out.replace(DIACRITICS_RE, '');
  out = out.replace(TATWEEL_RE, '');
  out = out.replace(/[أإآٱةىؤئ]/g, (ch) => LETTER_MAP[ch] ?? ch);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Build the denormalized search blob stored on the Atm row (trigram index target).
 * Combines name + address + bank label so a single ILIKE covers all three.
 */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  return normalizeArabic(parts.filter((p): p is string => !!p).join(' '));
}
