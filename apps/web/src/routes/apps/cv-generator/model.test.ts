import { describe, expect, it } from 'vite-plus/test';
import { buildBlocks, createBlankCv, parseCvFile, safeFilename } from './model';

describe('CV model', () => {
  it('only builds blocks for populated sections', () => {
    const document = createBlankCv();
    expect(buildBlocks(document).map((block) => block.type)).toEqual(['identity']);
    document.basics.summary = 'A concise profile.';
    document.skills = ['TypeScript'];
    expect(buildBlocks(document).map((block) => block.type)).toEqual([
      'identity',
      'summary',
      'skills',
    ]);
  });

  it('fills optional collections when reading a version one file', () => {
    const file = JSON.stringify({
      version: 1,
      title: 'CV',
      basics: { name: 'Ada' },
      settings: { paper: 'a4' },
    });
    expect(parseCvFile(file)).toMatchObject({ title: 'CV', basics: { name: 'Ada' }, projects: [] });
  });

  it('normalizes malformed optional fields instead of exposing them to the renderer', () => {
    const file = JSON.stringify({
      version: 1,
      title: 42,
      basics: { name: ['Ada'], summary: 10, links: [{ label: 'Site', url: false }] },
      experience: [{ role: 7, bullets: ['Valid', null] }],
      settings: { paper: 'poster', accent: 'red' },
    });
    expect(parseCvFile(file)).toMatchObject({
      title: '',
      basics: { name: '', summary: '', links: [{ label: 'Site', url: '' }] },
      experience: [{ role: '', bullets: ['Valid'] }],
      settings: { paper: 'a4', accent: '#2563eb' },
    });
  });

  it('rejects unsupported files', () => {
    expect(() => parseCvFile('{"version":2}')).toThrow('not supported');
  });

  it('creates a portable filename', () => {
    expect(safeFilename('  Ada Lovelace / CV ')).toBe('ada-lovelace-cv.cv.json');
  });
});
