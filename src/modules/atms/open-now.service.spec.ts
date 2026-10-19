import type { OpeningHours } from './entities/atm.entity';
import { OpenNowService, evaluateOpenNow } from './open-now.service';
import { cairoClockAt, type CairoClock } from '../../common/utils/time.util';

const clock = (weekday: CairoClock['weekday'], hhmm: string): CairoClock => {
  const [h, m] = hhmm.split(':').map(Number);
  return { weekday, minutes: h * 60 + m };
};

describe('evaluateOpenNow', () => {
  it('is OPEN when flagged 24h regardless of hours', () => {
    expect(evaluateOpenNow(null, true, clock('monday', '03:00'))).toBe('OPEN');
    expect(
      evaluateOpenNow({ monday: [{ open: '09:00', close: '17:00' }] }, true, clock('monday', '23:00')),
    ).toBe('OPEN');
  });

  it('is UNKNOWN when hours are missing or empty', () => {
    expect(evaluateOpenNow(null, false, clock('monday', '10:00'))).toBe('UNKNOWN');
    expect(evaluateOpenNow(undefined, null, clock('monday', '10:00'))).toBe('UNKNOWN');
    expect(evaluateOpenNow({}, null, clock('monday', '10:00'))).toBe('UNKNOWN');
  });

  describe('ordinary same-day window [open, close)', () => {
    const hours: OpeningHours = { monday: [{ open: '09:00', close: '17:00' }] };

    it('is OPEN within the window (open inclusive)', () => {
      expect(evaluateOpenNow(hours, null, clock('monday', '09:00'))).toBe('OPEN');
      expect(evaluateOpenNow(hours, null, clock('monday', '12:30'))).toBe('OPEN');
    });

    it('is CLOSED at/after close (close exclusive) and before open', () => {
      expect(evaluateOpenNow(hours, null, clock('monday', '17:00'))).toBe('CLOSED');
      expect(evaluateOpenNow(hours, null, clock('monday', '08:59'))).toBe('CLOSED');
      expect(evaluateOpenNow(hours, null, clock('monday', '23:59'))).toBe('CLOSED');
    });

    it('is CLOSED on a weekday with no hours', () => {
      expect(evaluateOpenNow(hours, null, clock('tuesday', '12:00'))).toBe('CLOSED');
    });
  });

  describe('overnight window (close <= open) wrapping past midnight', () => {
    // Monday 22:00 -> Tuesday 02:00
    const hours: OpeningHours = { monday: [{ open: '22:00', close: '02:00' }] };

    it('is OPEN late on the starting day (open inclusive)', () => {
      expect(evaluateOpenNow(hours, null, clock('monday', '22:00'))).toBe('OPEN');
      expect(evaluateOpenNow(hours, null, clock('monday', '23:59'))).toBe('OPEN');
    });

    it('is OPEN in the early morning via the previous day tail (close exclusive)', () => {
      expect(evaluateOpenNow(hours, null, clock('tuesday', '00:00'))).toBe('OPEN');
      expect(evaluateOpenNow(hours, null, clock('tuesday', '01:59'))).toBe('OPEN');
      expect(evaluateOpenNow(hours, null, clock('tuesday', '02:00'))).toBe('CLOSED');
    });

    it('is CLOSED the following evening once the tail has ended', () => {
      expect(evaluateOpenNow(hours, null, clock('tuesday', '21:00'))).toBe('CLOSED');
    });

    it('is CLOSED early on a day whose previous day had no overnight interval', () => {
      expect(evaluateOpenNow(hours, null, clock('monday', '01:00'))).toBe('CLOSED');
    });

    it('handles a full-day wrap (00:00 -> 00:00) as open all that day', () => {
      const allDay: OpeningHours = { monday: [{ open: '00:00', close: '00:00' }] };
      expect(evaluateOpenNow(allDay, null, clock('monday', '00:00'))).toBe('OPEN');
      expect(evaluateOpenNow(allDay, null, clock('monday', '15:00'))).toBe('OPEN');
    });
  });

  it('ignores intervals with unparseable times', () => {
    const hours: OpeningHours = { monday: [{ open: 'nope', close: '17:00' }] };
    expect(evaluateOpenNow(hours, null, clock('monday', '12:00'))).toBe('CLOSED');
  });

  it('is OPEN when any of several intervals matches', () => {
    const hours: OpeningHours = {
      monday: [
        { open: '09:00', close: '12:00' },
        { open: '14:00', close: '18:00' },
      ],
    };
    expect(evaluateOpenNow(hours, null, clock('monday', '10:00'))).toBe('OPEN');
    expect(evaluateOpenNow(hours, null, clock('monday', '13:00'))).toBe('CLOSED');
    expect(evaluateOpenNow(hours, null, clock('monday', '15:00'))).toBe('OPEN');
  });
});

describe('cairoClockAt', () => {
  it('applies the winter offset (UTC+2)', () => {
    // Wed 15 Jan 2026, 10:00 UTC -> 12:00 in Cairo.
    expect(cairoClockAt(new Date('2026-01-15T10:00:00Z'))).toEqual(clock('thursday', '12:00'));
  });

  it('applies the summer DST offset (UTC+3)', () => {
    // Wed 15 Jul 2026, 10:00 UTC -> 13:00 in Cairo.
    expect(cairoClockAt(new Date('2026-07-15T10:00:00Z'))).toEqual(clock('wednesday', '13:00'));
  });

  it('rolls over to the next Cairo day across UTC midnight', () => {
    // 22:00 UTC in summer -> 01:00 next day in Cairo.
    expect(cairoClockAt(new Date('2026-07-15T22:00:00Z'))).toEqual(clock('thursday', '01:00'));
  });
});

describe('OpenNowService.status', () => {
  const service = new OpenNowService();

  it('computes the status from the Cairo wall clock', () => {
    const atm = { openingHours: { thursday: [{ open: '08:00', close: '20:00' }] }, is24h: false };
    // Thu 15 Jan 2026, 12:00 Cairo (10:00 UTC).
    expect(service.status(atm, new Date('2026-01-15T10:00:00Z'))).toBe('OPEN');
    // Same day, 21:00 Cairo (19:00 UTC).
    expect(service.status(atm, new Date('2026-01-15T19:00:00Z'))).toBe('CLOSED');
  });
});
