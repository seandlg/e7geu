import { describe, expect, it } from 'vite-plus/test';
import {
  defaultOutputDimensions,
  cropRectangle,
  fitWithin,
  formatBytes,
  outputFilename,
  preferredFormat,
  sizeDifference,
  validateDimensions,
} from './image.ts';

describe('image output settings', () => {
  it('scales large images down without enlarging smaller images', () => {
    expect(defaultOutputDimensions({ width: 4_000, height: 3_000 })).toEqual({
      width: 2_048,
      height: 1_536,
    });
    expect(fitWithin({ width: 800, height: 600 }, 2_048, 2_048)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('crops to an aspect ratio and positions the crop within the source', () => {
    const landscape = { width: 4_000, height: 3_000 };
    expect(cropRectangle(landscape, 1)).toEqual({
      x: 500,
      y: 0,
      width: 3_000,
      height: 3_000,
    });
    expect(cropRectangle(landscape, 1, 0)).toEqual({
      x: 0,
      y: 0,
      width: 3_000,
      height: 3_000,
    });
    expect(cropRectangle({ width: 3_000, height: 4_000 }, 16 / 9, 0.5, 1)).toEqual({
      x: 0,
      y: 2_312,
      width: 3_000,
      height: 1_688,
    });
    expect(cropRectangle(landscape, null)).toEqual({ x: 0, y: 0, ...landscape });
  });

  it('rejects unsafe canvas dimensions', () => {
    expect(validateDimensions({ width: 0, height: 100 })).toMatch(/greater than zero/);
    expect(validateDimensions({ width: 16_385, height: 100 })).toMatch(/16,384/);
    expect(validateDimensions({ width: 10_000, height: 5_000 })).toMatch(/40 megapixels/);
    expect(validateDimensions({ width: 4_000, height: 3_000 })).toBeNull();
  });

  it('chooses browser export formats and produces safe output names', () => {
    expect(preferredFormat('image/png')).toBe('image/png');
    expect(preferredFormat('image/avif')).toBe('image/jpeg');
    expect(outputFilename('holiday.photo.PNG', 'image/webp')).toBe('holiday.photo-optimized.webp');
    expect(outputFilename('.hidden', 'image/jpeg')).toBe('.hidden-optimized.jpg');
  });
});

describe('image size labels', () => {
  it('formats decimal file sizes', () => {
    expect(formatBytes(820)).toBe('820 B');
    expect(formatBytes(8_200)).toBe('8.2 KB');
    expect(formatBytes(2_450_000)).toBe('2.5 MB');
  });

  it('describes whether an output grew or shrank', () => {
    expect(sizeDifference(1_000, 600)).toBe('40% smaller');
    expect(sizeDifference(1_000, 1_250)).toBe('25% larger');
    expect(sizeDifference(1_000, 1_000)).toBe('Same file size');
  });
});
