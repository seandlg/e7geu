import { describe, expect, it } from 'vite-plus/test';
import { toolboxApps } from '../lib/apps/catalog.ts';
import { searchApps } from './search';

describe('app search', () => {
  it('returns all apps for an empty query', () => {
    expect(searchApps(toolboxApps, '   ')).toBe(toolboxApps);
  });

  it('matches names, descriptions, and capabilities case-insensitively', () => {
    expect(searchApps(toolboxApps, 'TIMER').map((app) => app.name)).toEqual(['Break Timer']);
    expect(searchApps(toolboxApps, 'frequency').map((app) => app.name)).toEqual(['Sound meter']);
    expect(searchApps(toolboxApps, 'camera').map((app) => app.name)).toEqual([
      'QR scanner',
      'Color inspector',
    ]);
  });

  it('requires every search term to match the same app', () => {
    expect(searchApps(toolboxApps, 'camera photo').map((app) => app.name)).toEqual([
      'Color inspector',
    ]);
  });
});
