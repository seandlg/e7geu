export type SpeedUnit = 'km/h' | 'mph' | 'kn';

export type GeoSample = {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number | null;
};

const EARTH_RADIUS_METRES = 6_371_000;

export function convertSpeed(metresPerSecond: number, unit: SpeedUnit): number {
  const safeSpeed = Math.max(0, metresPerSecond);
  if (unit === 'mph') return safeSpeed * 2.236_936_292_1;
  if (unit === 'kn') return safeSpeed * 1.943_844_492_4;
  return safeSpeed * 3.6;
}

export function normaliseReceiverSpeed(speed: unknown): number | null {
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null;
}

export function deriveSpeed(previous: GeoSample | null, current: GeoSample): number | null {
  const receiverSpeed = normaliseReceiverSpeed(current.speed);
  if (receiverSpeed !== null) return receiverSpeed;
  if (!previous) return null;

  const elapsedSeconds = (current.timestamp - previous.timestamp) / 1_000;
  if (elapsedSeconds <= 0 || elapsedSeconds > 30) return null;

  return haversineDistance(previous, current) / elapsedSeconds;
}

function haversineDistance(a: GeoSample, b: GeoSample): number {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * toRadians;
  const longitudeDelta = (b.longitude - a.longitude) * toRadians;
  const aLatitude = a.latitude * toRadians;
  const bLatitude = b.latitude * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(haversine));
}
