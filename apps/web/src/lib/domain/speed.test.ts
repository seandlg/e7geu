import { describe, expect, it } from 'vite-plus/test';
import { convertSpeed, deriveSpeed, type GeoSample } from './speed';

const sample = (overrides: Partial<GeoSample> = {}): GeoSample => ({
  latitude: 52.52,
  longitude: 13.405,
  timestamp: 1_000,
  speed: null,
  ...overrides,
});

describe('convertSpeed', () => {
  it('converts metres per second into supported display units', () => {
    expect(convertSpeed(10, 'km/h')).toBeCloseTo(36);
    expect(convertSpeed(10, 'mph')).toBeCloseTo(22.369);
    expect(convertSpeed(10, 'kn')).toBeCloseTo(19.438);
  });

  it('never displays a negative speed', () => {
    expect(convertSpeed(-2, 'km/h')).toBe(0);
  });
});

describe('deriveSpeed', () => {
  it('prefers a valid speed supplied by the GPS receiver', () => {
    expect(deriveSpeed(null, sample({ speed: 4.5 }))).toBe(4.5);
  });

  it('derives speed from consecutive positions when the receiver omits it', () => {
    const previous = sample();
    const current = sample({ longitude: 13.4051, timestamp: 2_000 });
    expect(deriveSpeed(previous, current)).toBeCloseTo(6.77, 1);
  });

  it('ignores stale samples', () => {
    expect(deriveSpeed(sample(), sample({ timestamp: 32_000 }))).toBeNull();
  });
});
