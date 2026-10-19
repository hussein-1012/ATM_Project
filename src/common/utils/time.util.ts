/**
 * Time helpers — all business time math uses the Africa/Cairo timezone.
 *
 * Egypt reinstated DST in 2023 (last Friday of April → last Thursday of
 * October, UTC+2 winter / UTC+3 summer), so offsets are computed via Intl
 * rather than hard-coded.
 */

export const CAIRO_TZ = 'Africa/Cairo';

export type Weekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface CairoClock {
  weekday: Weekday;
  /** minutes since local midnight, 0..1439 */
  minutes: number;
}

const WEEKDAY_MAP: Record<string, Weekday> = {
  Sun: 'sunday',
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
};

function cairoParts(date: Date): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
  }
  // Intl may render midnight as hour 24
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** Offset of Africa/Cairo at the given instant, in milliseconds (e.g. +2h or +3h). */
export function cairoOffsetMs(date: Date): number {
  const p = cairoParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime() + (date.getTime() % 1000);
}

/** Current wall-clock in Cairo: weekday + minutes since midnight. */
export function cairoClock(now: Date = new Date()): CairoClock {
  return cairoClockAt(now);
}

/** Same as cairoClock but for an arbitrary instant (used by openNow tests). */
export function cairoClockAt(date: Date): CairoClock {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { weekday: WEEKDAY_MAP[weekdayShort] ?? 'sunday', minutes: hour * 60 + minute };
}

/** Minutes since local midnight for "HH:MM" (0..1439), or null when invalid. */
export function parseHm(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Midnight of "today" in Cairo, as a UTC instant (DST-aware). */
export function cairoStartOfDay(now: Date = new Date()): Date {
  const p = cairoParts(now);
  const wallMidnightUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  // Two passes converge across DST transitions.
  let instant = wallMidnightUtc;
  for (let i = 0; i < 2; i++) {
    instant = wallMidnightUtc - cairoOffsetMs(new Date(instant));
  }
  return new Date(instant);
}
