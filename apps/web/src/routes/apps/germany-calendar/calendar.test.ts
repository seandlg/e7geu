import { describe, expect, it } from 'vite-plus/test';
import {
  filterStates,
  germanStates,
  includesDate,
  monthGrid,
  overlappingStateCodes,
  publicHolidaysOn,
  schoolHolidaysOn,
  type PublicHoliday,
  type SchoolHoliday,
} from './calendar';

const school: SchoolHoliday[] = [
  { id: 'be', name: 'Summer', startDate: '2026-07-09', endDate: '2026-08-22', stateCode: 'DE-BE' },
  { id: 'bb', name: 'Summer', startDate: '2026-07-09', endDate: '2026-08-22', stateCode: 'DE-BB' },
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
  it('returns only school holidays for selected states and exposes overlaps', () => {
    const holidays = schoolHolidaysOn(school, '2026-07-10', new Set(['DE-BE', 'DE-BB']));
    expect(overlappingStateCodes(holidays)).toEqual(['DE-BE', 'DE-BB']);
    expect(schoolHolidaysOn(school, '2026-07-10', new Set(['DE-BE']))).toHaveLength(1);
  });

  it('shows national holidays and selected regional holidays', () => {
    const holidays: PublicHoliday[] = [
      {
        id: 'national',
        date: '2026-10-03',
        name: 'Unity Day',
        subdivisionCodes: null,
        regionalScope: 'National',
      },
      {
        id: 'berlin',
        date: '2026-10-03',
        name: 'Berlin Day',
        subdivisionCodes: ['DE-BE'],
        regionalScope: 'Regional',
      },
      {
        id: 'bavaria',
        date: '2026-10-03',
        name: 'Bavaria Day',
        subdivisionCodes: ['DE-BY'],
        regionalScope: 'Local',
      },
    ];
    expect(publicHolidaysOn(holidays, '2026-10-03', new Set(['DE-BE']))).toHaveLength(2);
    expect(publicHolidaysOn(holidays, '2026-10-04', new Set(['DE-BE']))).toHaveLength(0);
  });

  it('finds states by name or code', () => {
    expect(filterStates(germanStates, 'Berlin').map((state) => state.shortCode)).toEqual(['BE']);
    expect(filterStates(germanStates, 'nw').map((state) => state.shortCode)).toEqual(['NW']);
    expect(filterStates(germanStates, 'Bayern').map((state) => state.shortCode)).toEqual(['BY']);
  });
});
