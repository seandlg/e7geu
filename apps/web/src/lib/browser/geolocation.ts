import { deriveSpeed, type GeoSample } from '$lib/domain/speed';

export type SpeedReading = {
  metresPerSecond: number | null;
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export function watchSpeed(
  onReading: (reading: SpeedReading) => void,
  onFailure: (failure: LocationFailure) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onFailure('unsupported');
    return () => undefined;
  }

  let previous: GeoSample | null = null;
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const current: GeoSample = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
        timestamp: position.timestamp,
      };
      const metresPerSecond = deriveSpeed(previous, current);
      previous = current;
      onReading({
        metresPerSecond,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        timestamp: position.timestamp,
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
