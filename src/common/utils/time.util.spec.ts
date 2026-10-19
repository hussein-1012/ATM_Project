import { cairoClockAt, cairoStartOfDay, parseHm } from './time.util';

describe('parseHm', () => {
  it('parses valid HH:MM', () => {
    expect(parseHm('08:30')).toBe(510);
    expect(parseHm('8:30')).toBe(510);
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('23:59')).toBe(1439);
  });
  it('rejects invalid values', () => {
    expect(parseHm('24:00')).toBeNull();
    expect(parseHm('12:60')).toBeNull();
    expect(parseHm('noon')).toBeNull();
  });
});

describe('cairoClockAt', () => {
  it('applies DST in summer (UTC+3): 10:00Z -> 13:00 local, Monday', () => {
    const clock = cairoClockAt(new Date('2026-06-15T10:00:00Z'));
    expect(clock.weekday).toBe('monday');
    expect(clock.minutes).toBe(13 * 60);
  });

  it('applies winter offset (UTC+2): 10:00Z -> 12:00 local', () => {
    const clock = cairoClockAt(new Date('2026-01-15T10:00:00Z'));
    expect(clock.minutes).toBe(12 * 60);
  });

  it('rolls the weekday across the UTC boundary in winter', () => {
    // 2026-01-15 22:30 UTC -> 2026-01-16 00:30 Cairo (Friday)
    const clock = cairoClockAt(new Date('2026-01-15T22:30:00Z'));
    expect(clock.weekday).toBe('friday');
    expect(clock.minutes).toBe(30);
  });
});

describe('cairoStartOfDay', () => {
  it('returns Cairo midnight in winter as a UTC instant (UTC+2)', () => {
    const start = cairoStartOfDay(new Date('2026-01-15T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('returns Cairo midnight in summer as a UTC instant (UTC+3)', () => {
    const start = cairoStartOfDay(new Date('2026-06-15T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-06-14T21:00:00.000Z');
  });
});
