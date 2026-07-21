export type GermanState = {
  code: string;
  shortCode: string;
  name: string;
  aliases?: readonly string[];
};

export type SchoolHoliday = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  stateCode: string;
};

export type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  subdivisionCodes: readonly string[] | null;
  regionalScope: 'National' | 'Regional' | 'Local';
};

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export type CalendarData = {
  school: SchoolHoliday[];
  public: PublicHoliday[];
};

type LocalizedText = {
  text: string;
};

type HolidayResponse = {
  id: string;
  startDate: string;
  endDate: string;
  name: LocalizedText[];
  nationwide: boolean;
  regionalScope: 'National' | 'Regional' | 'Local';
  subdivisions: { code: string }[] | null;
};

export const germanStates: readonly GermanState[] = [
  { code: 'DE-BW', shortCode: 'BW', name: 'Baden-Württemberg' },
  { code: 'DE-BY', shortCode: 'BY', name: 'Bavaria', aliases: ['Bayern'] },
  { code: 'DE-BE', shortCode: 'BE', name: 'Berlin' },
  { code: 'DE-BB', shortCode: 'BB', name: 'Brandenburg' },
  { code: 'DE-HB', shortCode: 'HB', name: 'Bremen' },
  { code: 'DE-HH', shortCode: 'HH', name: 'Hamburg' },
  { code: 'DE-HE', shortCode: 'HE', name: 'Hesse', aliases: ['Hessen'] },
  { code: 'DE-MV', shortCode: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'DE-NI', shortCode: 'NI', name: 'Lower Saxony', aliases: ['Niedersachsen'] },
  {
    code: 'DE-NW',
    shortCode: 'NW',
    name: 'North Rhine-Westphalia',
    aliases: ['Nordrhein-Westfalen', 'NRW'],
  },
  {
    code: 'DE-RP',
    shortCode: 'RP',
    name: 'Rhineland-Palatinate',
    aliases: ['Rheinland-Pfalz'],
  },
  { code: 'DE-SL', shortCode: 'SL', name: 'Saarland' },
  { code: 'DE-SN', shortCode: 'SN', name: 'Saxony', aliases: ['Sachsen'] },
  { code: 'DE-ST', shortCode: 'ST', name: 'Saxony-Anhalt', aliases: ['Sachsen-Anhalt'] },
  { code: 'DE-SH', shortCode: 'SH', name: 'Schleswig-Holstein' },
  { code: 'DE-TH', shortCode: 'TH', name: 'Thuringia', aliases: ['Thüringen', 'Thueringen'] },
] as const;

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - mondayOffset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      date: isoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
    };
  });
}

export function includesDate(
  holiday: Pick<SchoolHoliday, 'startDate' | 'endDate'>,
  date: string,
): boolean {
  return holiday.startDate <= date && holiday.endDate >= date;
}

export function schoolHolidaysOn(
  holidays: readonly SchoolHoliday[],
  date: string,
  selectedStates: ReadonlySet<string>,
): SchoolHoliday[] {
  return holidays.filter(
    (holiday) => selectedStates.has(holiday.stateCode) && includesDate(holiday, date),
  );
}

export function publicHolidaysOn(
  holidays: readonly PublicHoliday[],
  date: string,
  selectedStates: ReadonlySet<string>,
): PublicHoliday[] {
  return holidays.filter((holiday) => {
    if (holiday.date !== date) return false;
    if (!holiday.subdivisionCodes || holiday.subdivisionCodes.length === 0) return true;
    return holiday.subdivisionCodes.some((code) => selectedStates.has(code));
  });
}

export function overlappingStateCodes(holidays: readonly SchoolHoliday[]): string[] {
  return [...new Set(holidays.map((holiday) => holiday.stateCode))];
}

function holidayName(holiday: HolidayResponse): string {
  return holiday.name[0]?.text ?? 'Holiday';
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

export async function fetchCalendarData(
  years: readonly number[],
  signal?: AbortSignal,
): Promise<CalendarData> {
  const schoolRequests = years.map(async (year) => {
    const query = new URLSearchParams({
      countryIsoCode: 'DE',
      languageIsoCode: 'EN',
      validFrom: `${year}-01-01`,
      validTo: `${year}-12-31`,
    });
    const response = await fetch(`https://openholidaysapi.org/SchoolHolidays?${query}`, { signal });
    if (!response.ok) throw new Error(`School holidays returned ${response.status}`);
    return (await response.json()) as HolidayResponse[];
  });
  const publicRequests = years.map(async (year) => {
    const query = new URLSearchParams({
      countryIsoCode: 'DE',
      languageIsoCode: 'EN',
      validFrom: `${year}-01-01`,
      validTo: `${year}-12-31`,
    });
    const response = await fetch(`https://openholidaysapi.org/PublicHolidays?${query}`, { signal });
    if (!response.ok) throw new Error(`Public holidays returned ${response.status}`);
    return (await response.json()) as HolidayResponse[];
  });
  const [schoolResponses, publicResponses] = await Promise.all([
    Promise.all(schoolRequests),
    Promise.all(publicRequests),
  ]);

  const school = uniqueBy(
    schoolResponses.flat().flatMap((holiday) =>
      (holiday.subdivisions ?? []).map((subdivision) => ({
        id: holiday.id,
        name: holidayName(holiday),
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        stateCode: subdivision.code,
      })),
    ),
    (holiday) => `${holiday.id}-${holiday.stateCode}`,
  );
  const publicHolidays = uniqueBy(
    publicResponses.flat().map((holiday) => ({
      id: holiday.id,
      name: holidayName(holiday),
      date: holiday.startDate,
      subdivisionCodes: holiday.nationwide
        ? null
        : (holiday.subdivisions?.map((subdivision) => subdivision.code) ?? null),
      regionalScope: holiday.regionalScope,
    })),
    (holiday) => holiday.id,
  );

  return { school, public: publicHolidays };
}

export function filterStates(states: readonly GermanState[], query: string): GermanState[] {
  const normalized = query.trim().toLocaleLowerCase('en');
  if (!normalized) return [...states];
  return states.filter((state) => {
    const searchable = [state.name, state.shortCode, ...(state.aliases ?? [])].join(' ');
    return searchable.toLocaleLowerCase('en').includes(normalized);
  });
}
