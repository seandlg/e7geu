import { describe, expect, it } from 'vite-plus/test';
import { filterVideoDevices, safeWebUrl } from './qr-scanner';

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
