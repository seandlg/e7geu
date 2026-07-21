import { describe, expect, it } from 'vite-plus/test';
import {
  affectedRegionCodes,
  createHolidayDataSource,
  filterRegions,
  includesDate,
  monthGrid,
  publicHolidaysOn,
  schoolHolidaysOn,
  type HolidayRegion,
  type PublicHoliday,
  type SchoolHoliday,
} from './calendar';

const school: SchoolHoliday[] = [
  {
    id: 'berlin',
    name: 'Summer holidays',
    startDate: '2026-07-09',
    endDate: '2026-08-22',
    regionCodes: ['DE-BE'],
    nationwide: false,
  },
  {
    id: 'brandenburg',
    name: 'Summer holidays',
    startDate: '2026-07-09',
    endDate: '2026-08-22',
    regionCodes: ['DE-BB'],
    nationwide: false,
  },
];

describe('calendar dates', () => {
  it('builds a fixed six-week grid beginning on Monday', () => {
    const days = monthGrid(2026, 6);
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: '2026-06-29', day: 29, inMonth: false });
    expect(days[41]).toEqual({ date: '2026-08-09', day: 9, inMonth: false });
  });

  it('treats both holiday endpoints as inclusive', () => {
    expect(includesDate(school[0], '2026-07-09')).toBe(true);
    expect(includesDate(school[0], '2026-08-22')).toBe(true);
    expect(includesDate(school[0], '2026-08-23')).toBe(false);
  });
});

describe('holiday selection', () => {
  it('returns school holidays for selected regions and exposes overlaps', () => {
    const selected = new Set(['DE-BE', 'DE-BB']);
    const holidays = schoolHolidaysOn(school, '2026-07-10', selected);
    expect(affectedRegionCodes(holidays, selected)).toEqual(['DE-BE', 'DE-BB']);
    expect(schoolHolidaysOn(school, '2026-07-10', new Set(['DE-BE']))).toHaveLength(1);
  });

  it('applies nationwide school holidays to every selected region', () => {
    const nationwide: SchoolHoliday = {
      ...school[0],
      id: 'nationwide',
      regionCodes: [],
      nationwide: true,
    };
    const selected = new Set(['FR-ZA', 'FR-ZB']);
    const holidays = schoolHolidaysOn([nationwide], '2026-07-10', selected);
    expect(affectedRegionCodes(holidays, selected)).toEqual(['FR-ZA', 'FR-ZB']);
  });

  it('shows national holidays and selected regional holidays', () => {
    const holidays: PublicHoliday[] = [
      {
        id: 'national',
        date: '2026-10-03',
        name: 'Unity Day',
        regionCodes: [],
        nationwide: true,
        regionalScope: 'National',
      },
      {
        id: 'berlin',
        date: '2026-10-03',
        name: 'Berlin Day',
        regionCodes: ['DE-BE'],
        nationwide: false,
        regionalScope: 'Regional',
      },
    ];
    expect(publicHolidaysOn(holidays, '2026-10-03', new Set(['DE-BE']))).toHaveLength(2);
    expect(publicHolidaysOn(holidays, '2026-10-04', new Set(['DE-BE']))).toHaveLength(0);
  });

  it('finds administrative regions and holiday zones by name, code, or category', () => {
    const regions: HolidayRegion[] = [
      { code: 'DE-BE', shortCode: 'BE', name: 'Berlin', kind: 'subdivision', category: 'State' },
      { code: 'FR-ZA', shortCode: 'ZA', name: 'Zone A', kind: 'group', category: 'Holiday zone' },
    ];
    expect(filterRegions(regions, 'Berlin').map((region) => region.code)).toEqual(['DE-BE']);
    expect(filterRegions(regions, 'holiday zone').map((region) => region.code)).toEqual(['FR-ZA']);
  });
});

describe('OpenHolidays data source', () => {
  it('normalizes countries, nested subdivisions, groups, and holidays behind one interface', async () => {
    const requests: string[] = [];
    const fetcher = async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requests.push(url);
      let body: unknown = [];
      if (url.includes('/Countries')) {
        body = [{ isoCode: 'XY', name: [{ text: 'Exampleland' }] }];
      } else if (url.includes('/Subdivisions')) {
        body = [
          {
            code: 'XY-N',
            shortName: 'N',
            name: [{ text: 'North' }],
            category: [{ text: 'Region' }],
            children: [
              {
                code: 'XY-N-1',
                shortName: 'N1',
                name: [{ text: 'North One' }],
                category: [{ text: 'District' }],
                children: null,
              },
            ],
          },
        ];
      } else if (url.includes('/Groups')) {
        body = [
          {
            code: 'XY-ZA',
            shortName: 'ZA',
            name: [{ text: 'Zone A' }],
            category: [{ text: 'Holiday zone' }],
            children: null,
          },
        ];
      } else if (url.includes('/SchoolHolidays')) {
        body = [
          {
            id: 'school-1',
            startDate: '2026-07-01',
            endDate: '2026-07-31',
            name: [{ text: 'Summer holidays' }],
            nationwide: false,
            regionalScope: 'Regional',
            subdivisions: [{ code: 'XY-N' }],
            groups: [{ code: 'XY-ZA' }],
          },
        ];
      } else if (url.includes('/PublicHolidays')) {
        body = [
          {
            id: 'public-1',
            startDate: '2026-01-01',
            endDate: '2026-01-01',
            name: [{ text: 'New Year' }],
            nationwide: true,
            regionalScope: 'National',
            subdivisions: null,
            groups: null,
          },
        ];
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const source = createHolidayDataSource(fetcher as typeof globalThis.fetch);

    await expect(source.fetchCountries()).resolves.toEqual([{ code: 'XY', name: 'Exampleland' }]);
    const calendar = await source.fetchCalendarData('XY', [2026]);

    expect(calendar.regions.map((region) => region.code)).toEqual(['XY-N', 'XY-N-1', 'XY-ZA']);
    expect(calendar.school[0].regionCodes).toEqual(['XY-N', 'XY-ZA']);
    expect(calendar.public[0]).toMatchObject({ name: 'New Year', nationwide: true });
    expect(requests).toHaveLength(5);
  });
});
