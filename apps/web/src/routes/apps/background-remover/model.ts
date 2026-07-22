export const MODEL_WIDTH = 320;
export const MODEL_HEIGHT = 320;

const imageMean = [0.485, 0.456, 0.406] as const;
const imageStandardDeviation = [0.229, 0.224, 0.225] as const;

export type ImagePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function imagePlacement(width: number, height: number): ImagePlacement {
  if (width <= 0 || height <= 0) throw new Error('The image has invalid dimensions.');
  const scale = Math.min(MODEL_WIDTH / width, MODEL_HEIGHT / height);
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));
  return {
    x: Math.floor((MODEL_WIDTH - resizedWidth) / 2),
    y: Math.floor((MODEL_HEIGHT - resizedHeight) / 2),
    width: resizedWidth,
    height: resizedHeight,
  };
}

export function modelInput(pixels: Uint8ClampedArray): Float32Array {
  const pixelCount = MODEL_WIDTH * MODEL_HEIGHT;
  if (pixels.length !== pixelCount * 4) throw new Error('The prepared image has an invalid size.');

  const input = new Float32Array(pixelCount * 3);
  for (let index = 0; index < pixelCount; index += 1) {
    const source = index * 4;
    input[index] = (pixels[source] / 255 - imageMean[0]) / imageStandardDeviation[0];
    input[pixelCount + index] =
      (pixels[source + 1] / 255 - imageMean[1]) / imageStandardDeviation[1];
    input[pixelCount * 2 + index] =
      (pixels[source + 2] / 255 - imageMean[2]) / imageStandardDeviation[2];
  }
  return input;
}

export function normalizedAlpha(mask: Float32Array): Uint8ClampedArray {
  if (mask.length !== MODEL_WIDTH * MODEL_HEIGHT)
    throw new Error('The AI mask has an invalid size.');

  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of mask) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  const alpha = new Uint8ClampedArray(mask.length);
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range <= Number.EPSILON) return alpha;
  for (let index = 0; index < mask.length; index += 1) {
    alpha[index] = Math.round(((mask[index] - minimum) / range) * 255);
  }
  return alpha;
}
