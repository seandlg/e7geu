import { describe, expect, it, vi } from 'vite-plus/test';
import { sampleCanvasColor } from './color-inspector';

describe('sampleCanvasColor', () => {
  it('reads exactly one backing pixel when the pipette radius is zero', () => {
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray([12, 34, 56, 255]),
    }));
    const canvas = {
      width: 100,
      height: 80,
      getContext: () => ({ getImageData }),
    } as unknown as HTMLCanvasElement;

    expect(sampleCanvasColor(canvas, 42, 17, 0)).toEqual({ red: 12, green: 34, blue: 56 });
    expect(getImageData).toHaveBeenCalledWith(42, 17, 1, 1);
  });
});
