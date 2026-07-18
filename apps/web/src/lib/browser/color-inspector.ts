import { drawVideoFrame, fittedDimensions, openCamera, type CameraDevice } from './camera';
import { averagePixels, type RgbColor } from '../domain/color';

export type ColorCameraSession = {
  activeDeviceId: () => string | null;
  cameras: () => Promise<CameraDevice[]>;
  capture: (canvas: HTMLCanvasElement) => RgbColor | null;
  setCamera: (cameraId: string) => Promise<void>;
  stop: () => void;
};

const SAMPLE_SIZE = 9;
const MAX_CAPTURE_EDGE = 1920;

export async function startColorCamera(
  video: HTMLVideoElement,
  onColor: (color: RgbColor) => void,
): Promise<ColorCameraSession> {
  const camera = await openCamera(video);

  const sampler = document.createElement('canvas');
  sampler.width = 64;
  sampler.height = 64;
  const context = sampler.getContext('2d', { willReadFrequently: true });
  let animationFrame: number | null = null;
  let lastSampleAt = 0;
  let stopped = false;

  const sample = (timestamp: number): void => {
    if (stopped) return;
    if (context && timestamp - lastSampleAt >= 100 && video.readyState >= video.HAVE_CURRENT_DATA) {
      lastSampleAt = timestamp;
      context.drawImage(video, 0, 0, sampler.width, sampler.height);
      const offset = Math.floor((sampler.width - SAMPLE_SIZE) / 2);
      const color = averagePixels(
        context.getImageData(offset, offset, SAMPLE_SIZE, SAMPLE_SIZE).data,
      );
      if (color) onColor(color);
    }
    animationFrame = requestAnimationFrame(sample);
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    camera.stop();
  };

  animationFrame = requestAnimationFrame(sample);
  return {
    stop,
    activeDeviceId: camera.activeDeviceId,
    cameras: camera.devices,
    setCamera: camera.start,
    capture: (canvas) => {
      if (!drawVideoFrame(video, canvas, MAX_CAPTURE_EDGE)) return null;
      return sampleCanvasColor(canvas, canvas.width / 2, canvas.height / 2);
    },
  };
}

export async function drawImageFile(
  file: File,
  canvas: HTMLCanvasElement,
): Promise<RgbColor | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const dimensions = fittedDimensions(bitmap.width, bitmap.height, 2048);
    if (!dimensions) return null;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    return sampleCanvasColor(canvas, dimensions.width / 2, dimensions.height / 2);
  } finally {
    bitmap.close();
  }
}

export function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius = 4,
): RgbColor | null {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) return null;
  const left = Math.max(0, Math.floor(x - radius));
  const top = Math.max(0, Math.floor(y - radius));
  const right = Math.min(canvas.width, Math.ceil(x + radius + 1));
  const bottom = Math.min(canvas.height, Math.ceil(y + radius + 1));
  return averagePixels(context.getImageData(left, top, right - left, bottom - top).data);
}
