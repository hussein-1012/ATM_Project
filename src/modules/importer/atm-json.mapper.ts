import { createHash } from 'node:crypto';
import { AtmBank, BANK_LABELS } from '../atms/entities/atm-bank.enum';
import type { OpeningHours, OpeningHoursInterval } from '../atms/entities/atm.entity';
import { buildSearchText, normalizeArabic } from '../../common/utils/arabic-normalize.util';
import { EGYPT_BOUNDS } from '../../common/constants';
import { rawAtmRecordSchema, type RawAtmRecord } from './atm-json.schema';

export interface MappedAtm {
  source: string;
  sourceId: string;
  name: string;
  bank: AtmBank;
  address: string;
  lat: number;
  lng: number;
  isBranch: boolean;
  openingHours: OpeningHours | null;
  is24h: boolean | null;
  wheelchairAccessible: boolean | null;
  searchText: string;
  sourceFetchedAt: Date | null;
}

export type SkipReason =
  | 'INVALID_RECORD'
  | 'EMPTY_NAME'
  | 'MISSING_LOCATION'
  | 'INVALID_COORDINATES'
  | 'OUTSIDE_EGYPT'
  | 'NOT_ATM_CATEGORY'
  | 'PERMANENTLY_CLOSED';

export type MapResult =
  | { ok: true; value: MappedAtm }
  | { ok: false; reason: SkipReason; detail?: string };

/** Ordered bank detection rules; first match wins. Patterns are normalized. */
const BANK_RULES: Array<{ bank: AtmBank; patterns: RegExp[] }> = [
  { bank: AtmBank.CIB, patterns: [/\bcib\b/, /commercial international/, /البنك التجاري الدولي/] },
  { bank: AtmBank.QNB, patterns: [/\bqnb\b/, /qnb alahli/, /قطر الوطني/] },
  { bank: AtmBank.AAIB, patterns: [/\baaib\b/, /arab african/, /العربي الافريقي/] },
  { bank: AtmBank.BANQUE_DU_CAIRE, patterns: [/banque du caire/, /بنك القاهره/] },
  {
    bank: AtmBank.NBE,
    patterns: [
      /\bnbe\b/,
      /national bank of egypt/,
      /natioal bank of egypt/,
      /البنك الاهلي/,
      /الاهلي المصري/,
      /بنك الاهلي/,
    ],
  },
  { bank: AtmBank.BANQUE_MISR, patterns: [/banque misr/, /بنك مصر/] },
  { bank: AtmBank.ALEXANDRIA_BANK, patterns: [/alexandria/, /بنك الاسكندريه/] },
  { bank: AtmBank.AGRICULTURAL_BANK, patterns: [/agricultural bank/, /البنك الزراعي/] },
  { bank: AtmBank.EGBANK, patterns: [/egbank/] },
  {
    bank: AtmBank.HOUSING_DEVELOPMENT,
    patterns: [/housing (and|&) development/, /\bhdb\b/, /بنك التعمير/],
  },
  { bank: AtmBank.FAISAL_ISLAMIC, patterns: [/faisal islamic/, /بنك فيصل/] },
  { bank: AtmBank.AL_BARAKA, patterns: [/al ?baraka/, /بنك البركه/] },
  { bank: AtmBank.BANK_NXT, patterns: [/bank nxt/] },
  { bank: AtmBank.ADCB, patterns: [/\badcb\b/] },
  { bank: AtmBank.CREDIT_AGRICOLE, patterns: [/credit agricole/, /كريدي اجريكول/] },
  { bank: AtmBank.POSTAL, patterns: [/البريد المصري/, /egypt post/, /post office/] },
];

const BANK_CATEGORY_RE =
  /(^|\s)(bank|banks|savings bank|public sector bank|investment bank|trust bank|cooperative bank)(\s|$)/;

const BRANCH_RE = /فرع|branch/;

/**
 * Maps one raw crawler record to an Atm row (or a skip reason).
 * Pure and synchronous — unit-tested in atm-json.mapper.spec.ts.
 */
export class AtmJsonMapper {
  constructor(private readonly source = 'google_places') {}

  map(raw: unknown): MapResult {
    const parsed = rawAtmRecordSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: 'INVALID_RECORD', detail: parsed.error.issues[0]?.message };
    }
    const record: RawAtmRecord = parsed.data;

    const name = (record.title ?? '').trim();
    if (!name) return { ok: false, reason: 'EMPTY_NAME' };

    if (!record.location || record.location.lat == null || record.location.lng == null) {
      return { ok: false, reason: 'MISSING_LOCATION' };
    }
    const lat = Number(record.location.lat);
    const lng = Number(record.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: 'INVALID_COORDINATES' };
    }
    if (
      lat < EGYPT_BOUNDS.minLat ||
      lat > EGYPT_BOUNDS.maxLat ||
      lng < EGYPT_BOUNDS.minLng ||
      lng > EGYPT_BOUNDS.maxLng
    ) {
      return { ok: false, reason: 'OUTSIDE_EGYPT', detail: `${lat},${lng}` };
    }

    const categories = record.categories ?? [];
    if (!this.isAtmLike(categories)) {
      return { ok: false, reason: 'NOT_ATM_CATEGORY', detail: categories.join('|') };
    }

    if (record.permanentlyClosed === true) {
      return { ok: false, reason: 'PERMANENTLY_CLOSED' };
    }

    const address = this.buildAddress(record);
    const bank = this.detectBank(record);
    const normalizedTitle = normalizeArabic(name);
    const isBranch =
      categories.some((c) => BANK_CATEGORY_RE.test(normalizeArabic(c))) ||
      BRANCH_RE.test(normalizedTitle);

    const { openingHours, is24h } = this.parseOpeningHours(record);

    const searchText = buildSearchText([name, address, BANK_LABELS[bank]]);

    return {
      ok: true,
      value: {
        source: this.source,
        sourceId: this.buildSourceId(record, name, lat, lng),
        name,
        bank,
        address,
        lat,
        lng,
        isBranch,
        openingHours,
        is24h,
        // The provided dataset contains no accessibility field.
        wheelchairAccessible: null,
        searchText,
        sourceFetchedAt: null, // filled from the file (fetchedAt / mtime) by the ImportService
      },
    };
  }

  /** Kept as its own source of truth for the "is this an ATM/bank" decision. */
  private isAtmLike(categories: string[]): boolean {
    return categories.some((c) => {
      const n = normalizeArabic(c);
      return n === 'atm' || n.includes('atm') || BANK_CATEGORY_RE.test(n);
    });
  }

  private buildAddress(record: RawAtmRecord): string {
    const address = (record.address ?? '').trim();
    if (address) return address;
    return [record.street, record.neighborhood, record.city, record.state]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }

  private detectBank(record: RawAtmRecord): AtmBank {
    const titleText = normalizeArabic(record.title ?? '');
    for (const rule of BANK_RULES) {
      if (rule.patterns.some((p) => p.test(titleText))) return rule.bank;
    }
    const addressText = normalizeArabic(record.address ?? '');
    for (const rule of BANK_RULES) {
      if (rule.patterns.some((p) => p.test(addressText))) return rule.bank;
    }
    return AtmBank.OTHER;
  }

  /**
   * Stable identity: the source's own id when present, otherwise a deterministic
   * hash of the normalized name + 5-decimal rounded coordinates.
   */
  private buildSourceId(record: RawAtmRecord, name: string, lat: number, lng: number): string {
    const placeId = (record.placeId ?? '').trim();
    if (placeId) return placeId.slice(0, 255);
    const hash = createHash('sha256')
      .update(`${normalizeArabic(name)}|${lat.toFixed(5)}|${lng.toFixed(5)}`)
      .digest('hex');
    return `gen_${hash.slice(0, 48)}`;
  }

  /**
   * Parses Google's per-day "<open> to <close>" strings (12h, English) into
   * 24h "HH:MM" pairs. A missing meridiem inherits the other side's meridiem;
   * close <= open means the interval wraps past midnight.
   *
   * is24h = true  -> every day is "Open 24 hours" (openingHours stored as null)
   * is24h = false -> at least one day parsed
   * is24h = null  -> no usable hours in the record
   */
  private parseOpeningHours(record: RawAtmRecord): {
    openingHours: OpeningHours | null;
    is24h: boolean | null;
  } {
    const days = record.openingHours;
    if (!days || days.length === 0) return { openingHours: null, is24h: null };

    const raw = days.filter((d) => d.day);
    if (raw.length === 0) return { openingHours: null, is24h: null };

    const all24h = raw.every((d) => /open 24 hours/i.test(d.hours ?? ''));
    if (all24h) return { openingHours: null, is24h: true };

    const result: OpeningHours = {};
    let parsedAny = false;
    for (const entry of raw) {
      const key = this.dayKey(entry.day ?? '');
      if (!key) continue;
      const intervals = this.parseDayHours(entry.hours ?? '');
      if (intervals === null) continue;
      result[key] = intervals;
      parsedAny = true;
    }

    if (!parsedAny) return { openingHours: null, is24h: null };
    return { openingHours: result, is24h: false };
  }

  private dayKey(day: string): keyof OpeningHours | null {
    const key = day.trim().toLowerCase();
    const valid = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const;
    return (valid as readonly string[]).includes(key) ? (key as keyof OpeningHours) : null;
  }

  /** "[]" = closed all day; null = unparseable. */
  private parseDayHours(hours: string): OpeningHoursInterval[] | null {
    const text = hours.trim();
    if (!text) return null;
    if (/^closed$/i.test(text)) return [];
    if (/open 24 hours/i.test(text)) return [{ open: '00:00', close: '23:59' }];

    const parts = text.split(/\s+to\s+/i);
    if (parts.length !== 2) return null;

    const open = this.parseTime(parts[0], parts[1]);
    const close = this.parseTime(parts[1], parts[0]);
    if (open === null || close === null) return null;
    return [{ open: this.formatHm(open), close: this.formatHm(close) }];
  }

  /**
   * Parses "8:30 AM" / "2 PM" / "1:30" into minutes since midnight.
   * `sibling` supplies the meridiem when this side has none.
   */
  private parseTime(value: string, sibling: string): number | null {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value.trim());
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour > 23 || minute > 59) return null;

    let meridiem = m[3]?.toLowerCase();
    if (!meridiem) {
      const sib = /(am|pm)/i.exec(sibling);
      if (sib) meridiem = sib[1].toLowerCase();
    }
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  private formatHm(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
