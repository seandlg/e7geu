import { describe, expect, it } from 'vite-plus/test';
import { toolboxApps } from '../lib/apps/catalog.ts';
import { addRecentApp, parseRecentAppHrefs, resolveRecentApps } from './recent';

describe('recent apps', () => {
  it('parses only unique catalog routes and limits the result', () => {
    const stored = JSON.stringify([
      '/apps/qr-scanner',
      '/apps/missing',
      '/apps/break-timer',
      '/apps/qr-scanner',
      '/apps/image-compressor',
      '/apps/color-inspector',
    ]);

    expect(parseRecentAppHrefs(stored, toolboxApps)).toEqual([
      '/apps/qr-scanner',
      '/apps/break-timer',
      '/apps/image-compressor',
    ]);
  });

  it('treats malformed storage as an empty history', () => {
    expect(parseRecentAppHrefs('{broken', toolboxApps)).toEqual([]);
    expect(parseRecentAppHrefs(JSON.stringify({ href: '/apps/qr-scanner' }), toolboxApps)).toEqual(
      [],
    );
  });

  it('moves the selected app to the front and keeps three entries', () => {
    expect(
      addRecentApp(
        ['/apps/qr-scanner', '/apps/break-timer', '/apps/image-compressor'],
        '/apps/break-timer',
      ),
    ).toEqual(['/apps/break-timer', '/apps/qr-scanner', '/apps/image-compressor']);

    expect(
      addRecentApp(
        ['/apps/qr-scanner', '/apps/break-timer', '/apps/image-compressor'],
        '/apps/color-inspector',
      ),
    ).toEqual(['/apps/color-inspector', '/apps/qr-scanner', '/apps/break-timer']);
  });

  it('resolves apps in recent-use order', () => {
    expect(
      resolveRecentApps(toolboxApps, ['/apps/break-timer', '/apps/qr-scanner']).map(
        (app) => app.name,
      ),
    ).toEqual(['Break Timer', 'QR scanner']);
  });
});
