import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { watchSpeed, type SpeedReading } from './geolocation';

afterEach(() => vi.unstubAllGlobals());

describe('watchSpeed', () => {
  it('reports receiver metadata and rolling fix cadence', () => {
    let receivePosition: PositionCallback = () => undefined;
    const clearWatch = vi.fn();
    const watchPosition = vi.fn((success: PositionCallback) => {
      receivePosition = success;
      return 17;
    });
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
    const readings: SpeedReading[] = [];

    const stop = watchSpeed((reading) => readings.push(reading), vi.fn());
    receivePosition(position({ timestamp: 1_000, speed: 5 }));
    receivePosition(position({ timestamp: 2_200, speed: null, longitude: 13.4051 }));

    expect(watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 1_000,
      timeout: 15_000,
    });
    expect(readings[0]).toMatchObject({
      rawSpeed: 5,
      speedSource: 'receiver',
      updateInterval: null,
      altitude: 41,
      altitudeAccuracy: 6,
    });
    expect(readings[1]).toMatchObject({
      rawSpeed: null,
      speedSource: 'positions',
      updateInterval: 1_200,
    });
    expect(readings[1]?.metresPerSecond).toBeGreaterThan(0);

    stop();
    expect(clearWatch).toHaveBeenCalledWith(17);
  });

  it('normalises malformed optional receiver data', () => {
    let receivePosition: PositionCallback = () => undefined;
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn((success: PositionCallback) => {
          receivePosition = success;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });
    const readings: SpeedReading[] = [];

    watchSpeed((reading) => readings.push(reading), vi.fn());
    receivePosition(
      position({
        timestamp: 1_000,
        speed: Number.POSITIVE_INFINITY,
        altitude: Number.NaN,
        altitudeAccuracy: -1,
        heading: 360,
      }),
    );

    expect(readings[0]).toMatchObject({
      rawSpeed: null,
      speedSource: 'waiting',
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
    });
  });

  it('reports an unavailable fix instead of exposing invalid required coordinates', () => {
    let receivePosition: PositionCallback = () => undefined;
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn((success: PositionCallback) => {
          receivePosition = success;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });
    const onReading = vi.fn();
    const onFailure = vi.fn();

    watchSpeed(onReading, onFailure);
    receivePosition(position({ timestamp: 1_000, speed: 2, latitude: Number.NaN }));

    expect(onReading).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('unavailable');
  });

  it('rejects a fix timestamped implausibly far in the future', () => {
    let receivePosition: PositionCallback = () => undefined;
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn((success: PositionCallback) => {
          receivePosition = success;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });
    const onReading = vi.fn();
    const onFailure = vi.fn();

    watchSpeed(onReading, onFailure);
    receivePosition(position({ timestamp: Date.now() + 60_000, speed: 2 }));

    expect(onReading).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('unavailable');
  });
});

function position({
  timestamp,
  speed,
  longitude = 13.405,
  latitude = 52.52,
  altitude = 41,
  altitudeAccuracy = 6,
  heading = 92,
}: {
  timestamp: number;
  speed: number | null;
  longitude?: number;
  latitude?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
}): GeolocationPosition {
  return {
    timestamp,
    coords: {
      accuracy: 8,
      altitude,
      altitudeAccuracy,
      heading,
      latitude,
      longitude,
      speed,
      toJSON: () => ({}),
    },
    toJSON: () => ({}),
  };
}
