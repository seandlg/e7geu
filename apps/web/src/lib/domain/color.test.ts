import { describe, expect, it } from 'vite-plus/test';
import { averagePixels, contrastRatio, rgbToHex, rgbToHsl } from './color';

describe('color calculations', () => {
  it('formats RGB as uppercase hexadecimal', () => {
    expect(rgbToHex({ red: 56, green: 189, blue: 248 })).toBe('#38BDF8');
  });

  it('converts RGB into familiar HSL values', () => {
    expect(rgbToHsl({ red: 255, green: 0, blue: 0 })).toEqual({
      hue: 0,
      saturation: 100,
      lightness: 50,
    });
  });

  it('averages visible pixels and ignores transparent ones', () => {
    expect(averagePixels(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]))).toEqual({
      red: 128,
      green: 0,
      blue: 128,
    });
    expect(averagePixels(new Uint8ClampedArray([0, 0, 0, 0]))).toBeNull();
  });

  it('calculates WCAG contrast ratios', () => {
    expect(contrastRatio({ red: 0, green: 0, blue: 0 }, { red: 255, green: 255, blue: 255 })).toBe(
      21,
    );
  });
});
