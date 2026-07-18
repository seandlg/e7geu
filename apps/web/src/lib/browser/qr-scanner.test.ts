import { describe, expect, it, vi } from 'vite-plus/test';
import { captureVideoFrame, filterVideoDevices, safeWebUrl } from './qr-scanner';

describe('safeWebUrl', () => {
  it('accepts HTTP URLs', () => {
    expect(safeWebUrl('https://e7g.eu/apps')).toBe('https://e7g.eu/apps');
  });

  it('rejects script and non-URL content', () => {
    expect(safeWebUrl('javascript:alert(1)')).toBeNull();
    expect(safeWebUrl('hello world')).toBeNull();
  });
});

describe('filterVideoDevices', () => {
  const device = (label: string, deviceId: string) =>
    ({ kind: 'videoinput', label, deviceId }) as MediaDeviceInfo;

  it('keeps primary rear and front cameras while hiding secondary lenses', () => {
    const result = filterVideoDevices([
      device('Back Camera', 'back'),
      device('Back Ultra Wide Camera', 'ultra'),
      device('Front Camera', 'front'),
    ]);
    expect(result.map(({ deviceId }) => deviceId)).toEqual(['back', 'front']);
  });

  it('keeps all cameras when labels are unavailable', () => {
    expect(filterVideoDevices([device('', 'one'), device('', 'two')])).toHaveLength(2);
  });
});

describe('captureVideoFrame', () => {
  it('copies the visible camera frame before the stream is stopped', () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,frozen'),
    } as unknown as HTMLCanvasElement;
    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;

    expect(captureVideoFrame(video, () => canvas)).toBe('data:image/jpeg;base64,frozen');
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });
});
