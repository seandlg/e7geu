import { describe, expect, it } from 'vite-plus/test';
import { MODEL_HEIGHT, MODEL_WIDTH, imagePlacement, modelInput, normalizedAlpha } from './model.ts';

describe('imagePlacement', () => {
  it('letterboxes landscape images without changing their aspect ratio', () => {
    expect(imagePlacement(1600, 900)).toEqual({ x: 0, y: 70, width: 320, height: 180 });
  });

  it('pillarboxes portrait images without changing their aspect ratio', () => {
    expect(imagePlacement(900, 1600)).toEqual({ x: 70, y: 0, width: 180, height: 320 });
  });
});

describe('modelInput', () => {
  it('produces normalized channel-first RGB data', () => {
    const pixels = new Uint8ClampedArray(MODEL_WIDTH * MODEL_HEIGHT * 4);
    pixels.set([255, 0, 127, 255]);
    const input = modelInput(pixels);
    const pixelCount = MODEL_WIDTH * MODEL_HEIGHT;

    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229);
    expect(input[pixelCount]).toBeCloseTo((0 - 0.456) / 0.224);
    expect(input[pixelCount * 2]).toBeCloseTo((127 / 255 - 0.406) / 0.225);
  });
});

describe('normalizedAlpha', () => {
  it('normalizes the model mask to the full alpha range', () => {
    const mask = new Float32Array(MODEL_WIDTH * MODEL_HEIGHT);
    mask[0] = -2;
    mask[1] = 0;
    mask[2] = 2;

    const alpha = normalizedAlpha(mask);
    expect(Array.from(alpha.slice(0, 3))).toEqual([0, 128, 255]);
  });
});
