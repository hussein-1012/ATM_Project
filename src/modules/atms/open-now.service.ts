import { Injectable } from '@nestjs/common';
import type { OpeningHours, OpeningHoursInterval } from './entities/atm.entity';
import {
  cairoClock,
  parseHm,
  type CairoClock,
  type Weekday,
} from '../../common/utils/time.util';

export type OpenNowStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

const WEEKDAYS: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function previousWeekday(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + WEEKDAYS.length - 1) % WEEKDAYS.length];
}

function isIntervalOpenAt(interval: OpeningHoursInterval, minutes: number): boolean {
  const open = parseHm(interval.open);
  const close = parseHm(interval.close);
  if (open === null || close === null) return false;

  if (close > open) {
    // Ordinary same-day window: [open, close).
    return minutes >= open && minutes < close;
  }
  // Overnight window (close <= open): spans to the end of the day. The early
  // morning part is handled by looking at the previous day's intervals.
  return minutes >= open;
}

/** True when an overnight interval that started the previous day is still running. */
function isOvernightTailOpenAt(interval: OpeningHoursInterval, minutes: number): boolean {
  const open = parseHm(interval.open);
  const close = parseHm(interval.close);
  if (open === null || close === null) return false;
  if (close > open) return false; // not an overnight interval
  return minutes < close;
}

/**
 * Pure open/closed decision for a given Cairo wall clock. Kept separate from
 * the service so it can be exhaustively unit tested (DST + wrap intervals).
 * Returns null when opening hours are genuinely unknown.
 */
export function evaluateOpenNow(
  openingHours: OpeningHours | null | undefined,
  is24h: boolean | null | undefined,
  clock: CairoClock,
): OpenNowStatus {
  if (is24h === true) return 'OPEN';

  if (!openingHours || Object.keys(openingHours).length === 0) {
    return 'UNKNOWN';
  }

  const today = openingHours[clock.weekday] ?? [];
  const yesterday = openingHours[previousWeekday(clock.weekday)] ?? [];

  const openToday = today.some((interval) => isIntervalOpenAt(interval, clock.minutes));
  const overnightTail = yesterday.some((interval) =>
    isOvernightTailOpenAt(interval, clock.minutes),
  );

  return openToday || overnightTail ? 'OPEN' : 'CLOSED';
}

@Injectable()
export class OpenNowService {
  status(
    atm: { openingHours: OpeningHours | null; is24h: boolean | null },
    now: Date = new Date(),
  ): OpenNowStatus {
    return evaluateOpenNow(atm.openingHours, atm.is24h, cairoClock(now));
  }
}
