export type Country = {
  code: string;
  name: string;
};

export type HolidayRegion = {
  code: string;
  shortCode: string;
  name: string;
  kind: 'subdivision' | 'group';
  category: string;
};

export type SchoolHoliday = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  regionCodes: readonly string[];
  nationwide: boolean;
};

export type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  regionCodes: readonly string[];
  nationwide: boolean;
  regionalScope: 'National' | 'Regional' | 'Local';
};

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export type CalendarData = {
  regions: HolidayRegion[];
  school: SchoolHoliday[];
  public: PublicHoliday[];
};

export type HolidayDataSource = {
  fetchCountries(signal?: AbortSignal): Promise<Country[]>;
  fetchCalendarData(
    countryCode: string,
    years: readonly number[],
    signal?: AbortSignal,
  ): Promise<CalendarData>;
};

type LocalizedText = {
  text: string;
};

type RegionReference = {
  code: string;
};

type HolidayResponse = {
  id: string;
  startDate: string;
  endDate: string;
  name: LocalizedText[];
  nationwide: boolean;
  regionalScope: 'National' | 'Regional' | 'Local';
  subdivisions: RegionReference[] | null;
  groups: RegionReference[] | null;
};

type CountryResponse = {
  isoCode: string;
  name: LocalizedText[];
};

type RegionResponse = {
  code: string;
  shortName: string;
  name: LocalizedText[];
  category: LocalizedText[];
  children: RegionResponse[] | null;
};

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
  selectedRegions: ReadonlySet<string>,
): SchoolHoliday[] {
  return holidays.filter(
    (holiday) =>
      includesDate(holiday, date) &&
      (holiday.nationwide || holiday.regionCodes.some((code) => selectedRegions.has(code))),
  );
}

export function affectedRegionCodes(
  holidays: readonly SchoolHoliday[],
  selectedRegions: ReadonlySet<string>,
): string[] {
  const codes = new Set<string>();
  for (const holiday of holidays) {
    if (holiday.nationwide) {
      for (const code of selectedRegions) codes.add(code);
    } else {
      for (const code of holiday.regionCodes) {
        if (selectedRegions.has(code)) codes.add(code);
      }
    }
  }
  return [...codes];
}

export function publicHolidaysOn(
  holidays: readonly PublicHoliday[],
  date: string,
  selectedRegions: ReadonlySet<string>,
): PublicHoliday[] {
  return holidays.filter((holiday) => {
    if (holiday.date !== date) return false;
    if (holiday.nationwide) return true;
    return holiday.regionCodes.some((code) => selectedRegions.has(code));
  });
}

function localizedName(values: readonly LocalizedText[], fallback: string): string {
  return values[0]?.text ?? fallback;
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function flattenRegions(
  responses: readonly RegionResponse[],
  kind: HolidayRegion['kind'],
): HolidayRegion[] {
  return responses.flatMap((response) => [
    {
      code: response.code,
      shortCode: response.shortName,
      name: localizedName(response.name, response.shortName),
      kind,
      category: localizedName(response.category, kind === 'group' ? 'Holiday zone' : 'Region'),
    },
    ...flattenRegions(response.children ?? [], kind),
  ]);
}

async function getJson<T>(
  fetcher: typeof globalThis.fetch,
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error(`Holiday data returned ${response.status}`);
  return (await response.json()) as T;
}

function countryQuery(countryCode: string, languageCode: string): URLSearchParams {
  return new URLSearchParams({ countryIsoCode: countryCode, languageIsoCode: languageCode });
}

async function requestCountries(
  fetcher: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<Country[]> {
  const query = new URLSearchParams({ languageIsoCode: 'EN' });
  const countries = await getJson<CountryResponse[]>(
    fetcher,
    `https://openholidaysapi.org/Countries?${query}`,
    signal,
  );
  return countries
    .map((country) => ({
      code: country.isoCode,
      name: localizedName(country.name, country.isoCode),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

async function requestCalendarData(
  fetcher: typeof globalThis.fetch,
  countryCode: string,
  years: readonly number[],
  signal?: AbortSignal,
): Promise<CalendarData> {
  const languageCode = 'EN';
  const metadataQuery = countryQuery(countryCode, languageCode);
  const subdivisionsRequest = getJson<RegionResponse[]>(
    fetcher,
    `https://openholidaysapi.org/Subdivisions?${metadataQuery}`,
    signal,
  );
  const groupsRequest = getJson<RegionResponse[]>(
    fetcher,
    `https://openholidaysapi.org/Groups?${metadataQuery}`,
    signal,
  );
  const holidayRequests = years.flatMap((year) => {
    const query = countryQuery(countryCode, languageCode);
    query.set('validFrom', `${year}-01-01`);
    query.set('validTo', `${year}-12-31`);
    return [
      getJson<HolidayResponse[]>(
        fetcher,
        `https://openholidaysapi.org/SchoolHolidays?${query}`,
        signal,
      ),
      getJson<HolidayResponse[]>(
        fetcher,
        `https://openholidaysapi.org/PublicHolidays?${query}`,
        signal,
      ),
    ];
  });

  const [subdivisions, groups, ...responses] = await Promise.all([
    subdivisionsRequest,
    groupsRequest,
    ...holidayRequests,
  ]);
  const schoolResponses = responses.filter((_, index) => index % 2 === 0).flat();
  const publicResponses = responses.filter((_, index) => index % 2 === 1).flat();
  const regions = uniqueBy(
    [
      ...flattenRegions(subdivisions as RegionResponse[], 'subdivision'),
      ...flattenRegions(groups as RegionResponse[], 'group'),
    ],
    (region) => region.code,
  ).sort((left, right) => left.name.localeCompare(right.name, 'en'));

  const school = uniqueBy(
    (schoolResponses as HolidayResponse[]).map((holiday) => ({
      id: holiday.id,
      name: localizedName(holiday.name, 'School holiday'),
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      regionCodes: [
        ...(holiday.subdivisions?.map((region) => region.code) ?? []),
        ...(holiday.groups?.map((region) => region.code) ?? []),
      ],
      nationwide: holiday.nationwide,
    })),
    (holiday) => holiday.id,
  );
  const publicHolidays = uniqueBy(
    (publicResponses as HolidayResponse[]).map((holiday) => ({
      id: holiday.id,
      name: localizedName(holiday.name, 'Public holiday'),
      date: holiday.startDate,
      regionCodes: holiday.subdivisions?.map((region) => region.code) ?? [],
      nationwide: holiday.nationwide,
      regionalScope: holiday.regionalScope,
    })),
    (holiday) => holiday.id,
  );

  return { regions, school, public: publicHolidays };
}

export function createHolidayDataSource(fetcher: typeof globalThis.fetch): HolidayDataSource {
  return {
    fetchCountries: (signal) => requestCountries(fetcher, signal),
    fetchCalendarData: (countryCode, years, signal) =>
      requestCalendarData(fetcher, countryCode, years, signal),
  };
}

export const openHolidays = createHolidayDataSource(globalThis.fetch);

export function filterRegions(regions: readonly HolidayRegion[], query: string): HolidayRegion[] {
  const normalized = query.trim().toLocaleLowerCase('en');
  if (!normalized) return [...regions];
  return regions.filter((region) =>
    `${region.name} ${region.shortCode} ${region.category}`
      .toLocaleLowerCase('en')
      .includes(normalized),
  );
}
