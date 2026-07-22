export type PaperSize = 'a4' | 'letter';
export type CvTemplate = 'classic' | 'modern';
export type CvDensity = 'relaxed' | 'balanced' | 'compact';
export type CvLanguage = 'en' | 'de';

export type CvLink = { id: string; label: string; url: string };
export type Experience = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
};
export type Education = {
  id: string;
  qualification: string;
  institution: string;
  location: string;
  start: string;
  end: string;
  detail: string;
};
export type Project = {
  id: string;
  name: string;
  link: string;
  description: string;
};

export type CvDocument = {
  version: 1;
  title: string;
  basics: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
    links: CvLink[];
  };
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  settings: {
    language: CvLanguage;
    paper: PaperSize;
    template: CvTemplate;
    density: CvDensity;
    accent: string;
  };
};

export type CvSection = 'summary' | 'experience' | 'education' | 'skills' | 'projects';

export type CvBlock =
  | { id: 'identity'; type: 'identity' }
  | { id: 'summary'; type: 'summary'; heading: string }
  | { id: string; type: 'experience'; heading?: string; item: Experience }
  | { id: string; type: 'education'; heading?: string; item: Education }
  | { id: 'skills'; type: 'skills'; heading: string }
  | { id: string; type: 'project'; heading?: string; item: Project };

let nextId = 0;

export function createId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId.toString(36)}`;
}

export function createBlankCv(): CvDocument {
  return {
    version: 1,
    title: 'Untitled CV',
    basics: {
      name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      links: [],
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    settings: {
      language: 'en',
      paper: 'a4',
      template: 'classic',
      density: 'balanced',
      accent: '#2563eb',
    },
  };
}

export function createExampleCv(): CvDocument {
  return {
    version: 1,
    title: 'Alex Morgan CV',
    basics: {
      name: 'Alex Morgan',
      headline: 'Product-minded software engineer',
      email: 'alex.morgan@example.com',
      phone: '+49 30 1234567',
      location: 'Berlin, Germany',
      summary:
        'Software engineer focused on turning complex product problems into clear, dependable experiences. Experienced in TypeScript, accessible interfaces, and technical leadership.',
      links: [
        { id: 'example-link-1', label: 'Portfolio', url: 'alexmorgan.dev' },
        { id: 'example-link-2', label: 'LinkedIn', url: 'linkedin.com/in/alexmorgan' },
      ],
    },
    experience: [
      {
        id: 'example-experience-1',
        role: 'Senior Software Engineer',
        company: 'Northstar Labs',
        location: 'Berlin',
        start: '2022',
        end: 'Present',
        bullets: [
          'Led a cross-functional team delivering a new customer workspace used by 40,000 people.',
          'Reduced interaction latency by 38% through focused profiling and frontend architecture changes.',
          'Introduced accessibility reviews and reusable interface patterns across three product teams.',
        ],
      },
      {
        id: 'example-experience-2',
        role: 'Software Engineer',
        company: 'Lumen Studio',
        location: 'Hamburg',
        start: '2019',
        end: '2022',
        bullets: [
          'Built TypeScript applications for logistics and mobility clients.',
          'Mentored junior engineers and improved the team release process.',
        ],
      },
    ],
    education: [
      {
        id: 'example-education-1',
        qualification: 'BSc Computer Science',
        institution: 'Technical University of Berlin',
        location: 'Berlin',
        start: '2015',
        end: '2019',
        detail: 'Focus on human-computer interaction and distributed systems.',
      },
    ],
    skills: ['TypeScript', 'Svelte', 'Product engineering', 'Accessibility', 'Design systems'],
    projects: [
      {
        id: 'example-project-1',
        name: 'Transit Atlas',
        link: 'transitatlas.example',
        description: 'An open browser tool for comparing regional public transport data.',
      },
    ],
    settings: {
      language: 'en',
      paper: 'a4',
      template: 'classic',
      density: 'balanced',
      accent: '#2563eb',
    },
  };
}

export function buildBlocks(document: CvDocument): CvBlock[] {
  const headings =
    document.settings.language === 'de'
      ? {
          summary: 'Profil',
          experience: 'Berufserfahrung',
          education: 'Ausbildung',
          skills: 'Kenntnisse',
          projects: 'Projekte',
        }
      : {
          summary: 'Profile',
          experience: 'Experience',
          education: 'Education',
          skills: 'Skills',
          projects: 'Projects',
        };
  const blocks: CvBlock[] = [{ id: 'identity', type: 'identity' }];
  if (document.basics.summary.trim()) {
    blocks.push({ id: 'summary', type: 'summary', heading: headings.summary });
  }
  document.experience.forEach((item, index) => {
    blocks.push({
      id: `experience-${item.id}`,
      type: 'experience',
      heading: index === 0 ? headings.experience : undefined,
      item,
    });
  });
  document.education.forEach((item, index) => {
    blocks.push({
      id: `education-${item.id}`,
      type: 'education',
      heading: index === 0 ? headings.education : undefined,
      item,
    });
  });
  if (document.skills.some((skill) => skill.trim())) {
    blocks.push({ id: 'skills', type: 'skills', heading: headings.skills });
  }
  document.projects.forEach((item, index) => {
    blocks.push({
      id: `project-${item.id}`,
      type: 'project',
      heading: index === 0 ? headings.projects : undefined,
      item,
    });
  });
  return blocks;
}

export function parseCvFile(value: string): CvDocument {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error('This file does not contain a CV.');
  if (parsed.version !== 1 || !isRecord(parsed.basics) || !isRecord(parsed.settings)) {
    throw new Error('This CV file version is not supported.');
  }
  const fallback = createBlankCv();
  return {
    version: 1,
    title: text(parsed.title),
    basics: {
      name: text(parsed.basics.name),
      headline: text(parsed.basics.headline),
      email: text(parsed.basics.email),
      phone: text(parsed.basics.phone),
      location: text(parsed.basics.location),
      summary: text(parsed.basics.summary),
      links: records(parsed.basics.links).map((item, index) => ({
        id: text(item.id) || `imported-link-${index}`,
        label: text(item.label),
        url: text(item.url),
      })),
    },
    experience: records(parsed.experience).map((item, index) => ({
      id: text(item.id) || `imported-experience-${index}`,
      role: text(item.role),
      company: text(item.company),
      location: text(item.location),
      start: text(item.start),
      end: text(item.end),
      bullets: strings(item.bullets),
    })),
    education: records(parsed.education).map((item, index) => ({
      id: text(item.id) || `imported-education-${index}`,
      qualification: text(item.qualification),
      institution: text(item.institution),
      location: text(item.location),
      start: text(item.start),
      end: text(item.end),
      detail: text(item.detail),
    })),
    skills: strings(parsed.skills),
    projects: records(parsed.projects).map((item, index) => ({
      id: text(item.id) || `imported-project-${index}`,
      name: text(item.name),
      link: text(item.link),
      description: text(item.description),
    })),
    settings: {
      language: parsed.settings.language === 'de' ? 'de' : 'en',
      paper: parsed.settings.paper === 'letter' ? 'letter' : 'a4',
      template: parsed.settings.template === 'modern' ? 'modern' : 'classic',
      density:
        parsed.settings.density === 'relaxed' || parsed.settings.density === 'compact'
          ? parsed.settings.density
          : 'balanced',
      accent: /^#[0-9a-f]{6}$/i.test(text(parsed.settings.accent))
        ? text(parsed.settings.accent)
        : fallback.settings.accent,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function safeFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'cv'}.cv.json`;
}
