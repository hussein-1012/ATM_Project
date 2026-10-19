import { haversineMeters, isValidLatLng, roundCoord } from './geo.util';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 29.3, lng: 30.8 }, { lat: 29.3, lng: 30.8 })).toBeCloseTo(0, 5);
  });

  it('measures a known short distance (~111 m for 0.001 deg latitude)', () => {
    const d = haversineMeters({ lat: 29.3, lng: 30.8 }, { lat: 29.301, lng: 30.8 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });

  it('measures a longer distance across Fayoum', () => {
    // Fayoum city center -> Ibshaway (~30 km)
    const d = haversineMeters({ lat: 29.3084, lng: 30.8412 }, { lat: 29.3597, lng: 30.6855 });
    expect(d).toBeGreaterThan(14000);
    expect(d).toBeLessThan(19000);
  });
});

describe('isValidLatLng', () => {
  it('accepts valid coordinates', () => {
    expect(isValidLatLng({ lat: 29.3, lng: 30.8 })).toBe(true);
  });
  it('rejects out-of-range coordinates', () => {
    expect(isValidLatLng({ lat: 91, lng: 30 })).toBe(false);
    expect(isValidLatLng({ lat: 29, lng: 181 })).toBe(false);
  });
  it('rejects non-numeric / malformed values', () => {
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ lat: '29', lng: 30 })).toBe(false);
    expect(isValidLatLng({ lat: NaN, lng: 30 })).toBe(false);
  });
});

describe('roundCoord', () => {
  it('rounds to 4 decimals by default (~11 m)', () => {
    expect(roundCoord(29.32533681)).toBe(29.3253);
    expect(roundCoord(30.836385)).toBe(30.8364);
  });
});
