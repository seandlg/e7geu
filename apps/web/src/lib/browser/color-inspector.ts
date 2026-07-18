import { averagePixels, type RgbColor } from '$lib/domain/color';

export type ColorCameraSession = {
  capture: (canvas: HTMLCanvasElement) => RgbColor | null;
  stop: () => void;
};

const SAMPLE_SIZE = 9;
const MAX_CAPTURE_EDGE = 1920;

export async function startColorCamera(
  video: HTMLVideoElement,
  onColor: (color: RgbColor) => void,
): Promise<ColorCameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
  });
  video.srcObject = stream;
  await video.play();

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
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  animationFrame = requestAnimationFrame(sample);
  return {
    stop,
    capture: (canvas) => {
      const dimensions = fittedDimensions(video.videoWidth, video.videoHeight, MAX_CAPTURE_EDGE);
      if (!dimensions) return null;
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const captureContext = canvas.getContext('2d', { willReadFrequently: true });
      if (!captureContext) return null;
      captureContext.drawImage(video, 0, 0, dimensions.width, dimensions.height);
      return sampleCanvasColor(canvas, dimensions.width / 2, dimensions.height / 2);
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

function fittedDimensions(
  width: number,
  height: number,
  maximumEdge: number,
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) return null;
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
