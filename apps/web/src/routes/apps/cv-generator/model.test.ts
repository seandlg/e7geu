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

  it('builds German headings when German is selected', () => {
    const document = createBlankCv();
    document.settings.language = 'de';
    document.basics.summary = 'Ein kurzes Profil.';
    document.experience.push({
      id: 'role-1',
      role: '',
      company: '',
      location: '',
      start: '',
      end: '',
      bullets: [],
    });
    document.education.push({
      id: 'education-1',
      qualification: '',
      institution: '',
      location: '',
      start: '',
      end: '',
      detail: '',
    });
    document.skills = ['TypeScript'];
    document.projects.push({ id: 'project-1', name: '', link: '', description: '' });

    expect(
      buildBlocks(document)
        .map((block) => ('heading' in block ? block.heading : undefined))
        .filter(Boolean),
    ).toEqual(['Profil', 'Berufserfahrung', 'Ausbildung', 'Kenntnisse', 'Projekte']);
  });

  it('fills optional collections when reading a version one file', () => {
    const file = JSON.stringify({
      version: 1,
      title: 'CV',
      basics: { name: 'Ada' },
      settings: { paper: 'a4' },
    });
    expect(parseCvFile(file)).toMatchObject({
      title: 'CV',
      basics: { name: 'Ada' },
      projects: [],
      settings: { language: 'en' },
    });
  });

  it('preserves German as the document language', () => {
    const file = JSON.stringify({
      version: 1,
      basics: {},
      settings: { language: 'de' },
    });
    expect(parseCvFile(file).settings.language).toBe('de');
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
