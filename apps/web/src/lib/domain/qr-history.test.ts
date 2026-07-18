import { describe, expect, it } from 'vite-plus/test';
import { addQrHistory, parseQrHistory, type QrHistoryItem } from './qr-history';

const item = (overrides: Partial<QrHistoryItem> = {}): QrHistoryItem => ({
  id: 'one',
  type: 'scan',
  value: 'hello',
  timestamp: 1,
  ...overrides,
});

describe('QR history', () => {
  it('moves a repeated value to the front instead of duplicating it', () => {
    const result = addQrHistory([item()], item({ id: 'two', timestamp: 2 }));
    expect(result).toEqual([item({ id: 'two', timestamp: 2 })]);
  });

  it('rejects invalid persisted data', () => {
    expect(parseQrHistory('{broken')).toEqual([]);
    expect(parseQrHistory(JSON.stringify([{ value: 'missing fields' }]))).toEqual([]);
  });
});
