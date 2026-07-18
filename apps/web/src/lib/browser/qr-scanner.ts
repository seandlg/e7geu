import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill';
import { drawVideoFrame, openCamera, type CameraDevice } from './camera';

type DetectedBarcode = { rawValue: string };
type Detector = { detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export type QrScan = { data: string };
export type CameraChoice = { id: string; label: string };

export type QrCamera = {
  activeCameraId: () => string | null;
  stop: () => void;
  start: () => Promise<void>;
  destroy: () => void;
  cameras: () => Promise<CameraChoice[]>;
  setCamera: (cameraId: string) => Promise<void>;
  hasFlash: () => Promise<boolean>;
  toggleFlash: () => Promise<void>;
};

const SCAN_INTERVAL_MS = 200;
const secondaryLensNames = ['ultra', 'telephoto', 'dual', 'triple', 'zoom', 'virtual'];

function createDetector(): Detector {
  const nativeDetector = (window as Window & { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
  const DetectorClass = nativeDetector ?? (BarcodeDetectorPolyfill as DetectorConstructor);
  return new DetectorClass({ formats: ['qr_code'] });
}

export async function startQrCamera(
  video: HTMLVideoElement,
  onScan: (scan: QrScan) => void,
  onDecodeError: (message: string) => void,
): Promise<QrCamera> {
  const detector = createDetector();
  const camera = await openCamera(video);
  let frame: number | null = null;
  let scanning = false;
  let selectedDeviceId: string | undefined;
  let torchOn = false;
  let lastScanTime = 0;
  let lastValue = '';

  const stop = (): void => {
    scanning = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    camera.stop();
    torchOn = false;
  };

  const scanFrame = async (timestamp: number): Promise<void> => {
    if (!scanning) return;
    if (
      timestamp - lastScanTime >= SCAN_INTERVAL_MS &&
      video.readyState >= video.HAVE_ENOUGH_DATA
    ) {
      lastScanTime = timestamp;
      try {
        const results = await detector.detect(video);
        const data = results[0]?.rawValue;
        if (data && data !== lastValue) {
          lastValue = data;
          onScan({ data });
        }
      } catch (error) {
        onDecodeError(error instanceof Error ? error.message : String(error));
      }
    }
    if (scanning) frame = requestAnimationFrame((time) => void scanFrame(time));
  };

  const start = async (): Promise<void> => {
    if (scanning) return;
    await camera.start(selectedDeviceId);
    scanning = true;
    lastValue = '';
    frame = requestAnimationFrame((time) => void scanFrame(time));
  };

  scanning = true;
  frame = requestAnimationFrame((time) => void scanFrame(time));

  return {
    stop,
    start,
    destroy: stop,
    activeCameraId: camera.activeDeviceId,
    cameras: async () => {
      const filtered = filterVideoDevices(await camera.devices());
      const activeDevice = camera.activeDeviceId();
      if (activeDevice) selectedDeviceId = activeDevice;
      return filtered;
    },
    setCamera: async (cameraId) => {
      selectedDeviceId = cameraId;
      stop();
      await start();
    },
    hasFlash: async () => {
      return camera.hasTorch();
    },
    toggleFlash: async () => {
      torchOn = !torchOn;
      await camera.setTorch(torchOn);
    },
  };
}

export async function scanQrImage(file: File): Promise<QrScan> {
  const bitmap = await createImageBitmap(file);
  try {
    const result = (await createDetector().detect(bitmap))[0];
    if (!result?.rawValue) throw new Error('No QR code found');
    return { data: result.rawValue };
  } finally {
    bitmap.close();
  }
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): string | null {
  const canvas = createCanvas();
  try {
    if (!drawVideoFrame(video, canvas)) return null;
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return null;
  }
}

export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function filterVideoDevices(devices: readonly CameraDevice[]): CameraDevice[] {
  if (devices.every((device) => !device.label)) return [...devices];
  const filtered = devices.filter((device) => {
    const label = device.label.toLowerCase();
    if (label.includes('front') || label.includes('user') || label.includes('truedepth'))
      return true;
    return !secondaryLensNames.some((name) => label.includes(name));
  });
  return filtered.length > 0 ? filtered : [...devices];
}
