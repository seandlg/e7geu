import { deriveSpeed, normaliseReceiverSpeed, type GeoSample } from '../domain/speed';

export type SpeedReading = {
  metresPerSecond: number | null;
  speedSource: 'receiver' | 'positions' | 'waiting';
  rawSpeed: number | null;
  accuracy: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  timestamp: number;
  updateInterval: number | null;
};

export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

const MAX_FUTURE_FIX_SKEW_MS = 5_000;

export function watchSpeed(
  onReading: (reading: SpeedReading) => void,
  onFailure: (failure: LocationFailure) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onFailure('unsupported');
    return () => undefined;
  }

  let previous: GeoSample | null = null;
  const recentIntervals: number[] = [];
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!validPosition(position)) {
        onFailure('unavailable');
        return;
      }
      const rawSpeed = normaliseReceiverSpeed(position.coords.speed);
      const current: GeoSample = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: rawSpeed,
        timestamp: position.timestamp,
      };
      const metresPerSecond = deriveSpeed(previous, current);
      const elapsed = previous ? current.timestamp - previous.timestamp : 0;
      if (elapsed > 0 && elapsed <= 30_000) {
        recentIntervals.push(elapsed);
        if (recentIntervals.length > 5) recentIntervals.shift();
      } else if (previous) {
        recentIntervals.length = 0;
      }
      previous = current;
      onReading({
        metresPerSecond,
        speedSource:
          rawSpeed !== null ? 'receiver' : metresPerSecond !== null ? 'positions' : 'waiting',
        rawSpeed,
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: finiteOrNull(position.coords.altitude),
        altitudeAccuracy: nonNegativeOrNull(position.coords.altitudeAccuracy),
        heading: headingOrNull(position.coords.heading),
        timestamp: position.timestamp,
        updateInterval:
          recentIntervals.length === 0
            ? null
            : recentIntervals.reduce((total, interval) => total + interval, 0) /
              recentIntervals.length,
      });
    },
    (error) => {
      const failures: Record<number, LocationFailure> = {
        [error.PERMISSION_DENIED]: 'denied',
        [error.POSITION_UNAVAILABLE]: 'unavailable',
        [error.TIMEOUT]: 'timeout',
      };
      onFailure(failures[error.code] ?? 'unavailable');
    },
    { enableHighAccuracy: true, maximumAge: 1_000, timeout: 15_000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

function validPosition(position: GeolocationPosition): boolean {
  const { coords, timestamp } = position;
  return (
    Number.isFinite(timestamp) &&
    timestamp >= 0 &&
    timestamp <= Date.now() + MAX_FUTURE_FIX_SKEW_MS &&
    Number.isFinite(coords.latitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    Number.isFinite(coords.longitude) &&
    coords.longitude >= -180 &&
    coords.longitude <= 180 &&
    Number.isFinite(coords.accuracy) &&
    coords.accuracy >= 0
  );
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function nonNegativeOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function headingOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 && value < 360 ? value : null;
}
