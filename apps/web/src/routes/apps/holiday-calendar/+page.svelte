<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    affectedRegionCodes,
    filterRegions,
    monthGrid,
    openHolidays,
    publicHolidaysOn,
    schoolHolidaysOn,
    weekdays,
    type CalendarData,
    type Country,
    type HolidayRegion,
    type PublicHoliday,
    type SchoolHoliday,
  } from './calendar';

  const now = new Date();
  const firstYear = now.getFullYear();
  const lastYear = firstYear + 3;
  const years = [firstYear, firstYear + 1, firstYear + 2, lastYear];
  const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
  const fullDateFormatter = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  let countries = $state<Country[]>([{ code: 'DE', name: 'Germany' }]);
  let countryCode = $state('DE');
  let year = $state(firstYear);
  let month = $state(now.getMonth());
  let regionQuery = $state('');
  let selectedRegionCodes = $state<string[]>([]);
  let regions = $state<HolidayRegion[]>([]);
  let showPublicHolidays = $state(true);
  let overlapOnly = $state(false);
  let schoolHolidays = $state<SchoolHoliday[]>([]);
  let publicHolidays = $state<PublicHoliday[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let selectedDate = $state(localIsoDate(now));
  let calendarController: AbortController | undefined;

  const countryName = $derived(
    countries.find((country) => country.code === countryCode)?.name ?? countryCode,
  );
  const selectedRegions = $derived(
    regions.filter((region) => selectedRegionCodes.includes(region.code)),
  );
  const selectedRegionSet = $derived(new Set(selectedRegionCodes));
  const matchingRegions = $derived(filterRegions(regions, regionQuery));
  const days = $derived(monthGrid(year, month));
  const selectedSchoolHolidays = $derived(
    schoolHolidaysOn(schoolHolidays, selectedDate, selectedRegionSet),
  );
  const selectedPublicHolidays = $derived(
    showPublicHolidays ? publicHolidaysOn(publicHolidays, selectedDate, selectedRegionSet) : [],
  );
  const canShowOverlap = $derived(selectedRegionCodes.length >= 2 && schoolHolidays.length > 0);

  onMount(() => {
    const countriesController = new AbortController();
    openHolidays
      .fetchCountries(countriesController.signal)
      .then((result) => (countries = result))
      .catch(() => {
        // Germany remains available if the country catalog cannot be refreshed.
      });
    void loadCountry('DE');
    return () => {
      countriesController.abort();
      calendarController?.abort();
    };
  });

  function cacheKey(code: string): string {
    return `holiday-calendar-${code}-${firstYear}-${lastYear}`;
  }

  function applyCalendarData(data: CalendarData): void {
    regions = data.regions;
    schoolHolidays = data.school;
    publicHolidays = data.public;
    status = 'ready';
  }

  function defaultRegions(code: string, availableRegions: readonly HolidayRegion[]): string[] {
    if (code === 'DE' && availableRegions.some((region) => region.code === 'DE-BE')) return ['DE-BE'];
    return [];
  }

  async function loadCountry(code: string): Promise<void> {
    calendarController?.abort();
    const controller = new AbortController();
    calendarController = controller;
    countryCode = code;
    regionQuery = '';
    selectedRegionCodes = [];
    regions = [];
    schoolHolidays = [];
    publicHolidays = [];
    overlapOnly = false;
    status = 'loading';
    let hasCachedData = false;

    try {
      const cached = localStorage.getItem(cacheKey(code));
      if (cached) {
        const data = JSON.parse(cached) as CalendarData;
        if (Array.isArray(data.regions) && Array.isArray(data.school) && Array.isArray(data.public)) {
          applyCalendarData(data);
          selectedRegionCodes = defaultRegions(code, data.regions);
          hasCachedData = true;
        }
      }
    } catch {
      // An unavailable browser store should not prevent the calendar from working.
    }

    try {
      const data = await openHolidays.fetchCalendarData(code, years, controller.signal);
      if (controller !== calendarController) return;
      applyCalendarData(data);
      if (selectedRegionCodes.length === 0) {
        selectedRegionCodes = defaultRegions(code, data.regions);
      }
      try {
        localStorage.setItem(cacheKey(code), JSON.stringify(data));
      } catch {
        // A full or unavailable browser store should not prevent the calendar from working.
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!hasCachedData) status = 'error';
    }
  }

  function localIsoDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  function displayDate(date: string): string {
    return fullDateFormatter.format(new Date(`${date}T12:00:00Z`));
  }

  function displayMonth(): string {
    return monthFormatter.format(new Date(year, month, 1));
  }

  function previousMonth(): void {
    if (month === 0) {
      year -= 1;
      month = 11;
    } else {
      month -= 1;
    }
    selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }

  function nextMonth(): void {
    if (month === 11) {
      year += 1;
      month = 0;
    } else {
      month += 1;
    }
    selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }

  function goToToday(): void {
    year = now.getFullYear();
    month = now.getMonth();
    selectedDate = localIsoDate(now);
  }

  function toggleRegion(code: string): void {
    selectedRegionCodes = selectedRegionCodes.includes(code)
      ? selectedRegionCodes.filter((selected) => selected !== code)
      : [...selectedRegionCodes, code];
    if (selectedRegionCodes.length < 2) overlapOnly = false;
  }

  function schoolFor(date: string): SchoolHoliday[] {
    return schoolHolidaysOn(schoolHolidays, date, selectedRegionSet);
  }

  function publicFor(date: string): PublicHoliday[] {
    return showPublicHolidays ? publicHolidaysOn(publicHolidays, date, selectedRegionSet) : [];
  }

  function regionName(code: string): string {
    return regions.find((region) => region.code === code)?.name ?? code;
  }

  function regionShortCode(code: string): string {
    return regions.find((region) => region.code === code)?.shortCode ?? code;
  }

  function dayClass(
    inMonth: boolean,
    hasSchoolHoliday: boolean,
    affectedCount: number,
    date: string,
  ): string {
    const selected = date === selectedDate ? 'ring-2 ring-white/75 ring-inset' : '';
    const tone = overlapOnly
      ? affectedCount >= 2
        ? 'bg-violet-400/22 hover:bg-violet-400/28'
        : 'bg-transparent hover:bg-white/[0.055]'
      : hasSchoolHoliday
        ? 'bg-teal-300/13 hover:bg-teal-300/19'
        : 'bg-transparent hover:bg-white/[0.055]';
    return `${selected} ${tone} ${inMonth ? 'text-white' : 'text-slate-700'}`;
  }

  function publicScope(holiday: PublicHoliday): string {
    if (holiday.nationwide) return `Nationwide in ${countryName}`;
    const names = holiday.regionCodes
      .filter((code) => selectedRegionSet.has(code))
      .map(regionName);
    return `${holiday.regionalScope === 'Local' ? 'Local · ' : ''}${names.join(', ')}`;
  }

  function schoolScope(holiday: SchoolHoliday): string {
    if (holiday.nationwide) return `Nationwide in ${countryName}`;
    return holiday.regionCodes
      .filter((code) => selectedRegionSet.has(code))
      .map(regionName)
      .join(', ');
  }
</script>

<svelte:head>
  <title>Holiday Calendar — e7g.eu</title>
  <meta
    name="description"
    content="Compare school breaks and public holidays across countries and regions."
  />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-6xl px-3 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <div class="px-2 sm:px-0">
    <AppHeader
      title="Holiday Calendar"
      subtitle={`${firstYear}–${lastYear} · school & public holidays`}
      icon="calendar"
    />
  </div>

  <section class="mt-8 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
    <aside class="glass-panel rounded-[1.75rem] p-4 sm:p-5" aria-labelledby="calendar-options-heading">
      <p class="m-0 text-xs font-750 tracking-[0.15em] text-teal-300 uppercase">Plan time off</p>
      <h2 id="calendar-options-heading" class="mb-0 mt-1 text-xl font-750 tracking-tight text-white">Choose a country</h2>

      <label class="mt-4 block" for="holiday-country">
        <span class="sr-only">Country</span>
        <select
          id="holiday-country"
          class="focus-ring min-h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-[#111b2b] px-3.5 text-sm font-650 text-white"
          value={countryCode}
          onchange={(event) => void loadCountry(event.currentTarget.value)}
        >
          {#each countries as country (country.code)}
            <option value={country.code}>{country.name}</option>
          {/each}
        </select>
      </label>

      {#if status === 'ready' && regions.length > 0}
        <div class="mt-5 flex items-start justify-between gap-3 border-t border-white/8 pt-4">
          <div>
            <p class="m-0 text-xs font-750 tracking-[0.12em] text-slate-500 uppercase">Regions & zones</p>
            <p class="mb-0 mt-1 text-sm text-slate-400">Choose one or more</p>
          </div>
          {#if selectedRegionCodes.length > 0}
            <button
              type="button"
              class="focus-ring cursor-pointer border-0 bg-transparent px-1 py-1 text-xs font-700 text-slate-500 hover:text-white"
              onclick={() => {
                selectedRegionCodes = [];
                overlapOnly = false;
              }}>Clear</button
            >
          {/if}
        </div>

        <label class="focus-within:ring-teal-300/30 mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-slate-500 transition focus-within:border-teal-300/30 focus-within:ring-3">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input
            class="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            type="search"
            placeholder="Search regions or zones"
            aria-label="Search regions and school holiday zones"
            autocomplete="off"
            bind:value={regionQuery}
          />
        </label>

        <div class="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1" aria-label="Regions and holiday zones">
          {#each matchingRegions as region (region.code)}
            {@const active = selectedRegionCodes.includes(region.code)}
            <button
              type="button"
              class={`focus-ring flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left transition ${active ? 'bg-teal-300/13 text-white' : 'bg-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
              aria-pressed={active}
              onclick={() => toggleRegion(region.code)}
            >
              <span class={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${active ? 'border-teal-300 bg-teal-300 font-900 text-slate-950' : 'border-white/15'}`}>{active ? '✓' : ''}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-650">{region.name}</span>
                {#if region.kind === 'group'}
                  <span class="block truncate text-[0.62rem] text-slate-600">{region.category}</span>
                {/if}
              </span>
              <span class="text-[0.65rem] font-750 tracking-wider text-slate-600">{region.shortCode}</span>
            </button>
          {/each}
          {#if matchingRegions.length === 0}
            <p class="m-0 px-3 py-5 text-center text-sm text-slate-600">No region found.</p>
          {/if}
        </div>

        {#if selectedRegions.length > 0}
          <div class="mt-4 flex flex-wrap gap-1.5 border-t border-white/8 pt-4" aria-label="Selected regions">
            {#each selectedRegions as region (region.code)}
              <button
                type="button"
                class="focus-ring cursor-pointer rounded-full border border-teal-300/20 bg-teal-300/8 px-2.5 py-1 text-xs font-700 text-teal-200"
                aria-label={`Remove ${region.name}`}
                onclick={() => toggleRegion(region.code)}>{region.shortCode} <span aria-hidden="true">×</span></button
              >
            {/each}
          </div>
        {/if}
      {:else if status === 'ready'}
        <p class="mb-0 mt-5 border-t border-white/8 pt-4 text-sm leading-5 text-slate-500">This country uses a nationwide calendar, so there are no regions to choose.</p>
      {/if}

      <div class="mt-4 space-y-2 border-t border-white/8 pt-4">
        <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2 text-sm font-650 text-slate-300">
          <span>
            Public holidays
            <span class="mt-0.5 block text-xs font-450 text-slate-600">National and selected regions</span>
          </span>
          <input class="peer sr-only" type="checkbox" bind:checked={showPublicHolidays} />
          <span class="relative h-7 w-12 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-rose-400/80 peer-focus-visible:ring-3 peer-focus-visible:ring-white/40 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"></span>
        </label>
        <label class={`flex items-center justify-between gap-4 rounded-xl px-1 py-2 text-sm font-650 ${canShowOverlap ? 'cursor-pointer text-slate-300' : 'cursor-not-allowed text-slate-600'}`}>
          <span>
            School overlap only
            <span class="mt-0.5 block text-xs font-450 text-slate-600">Select at least two regions</span>
          </span>
          <input class="peer sr-only" type="checkbox" bind:checked={overlapOnly} disabled={!canShowOverlap} />
          <span class="relative h-7 w-12 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-violet-400/80 peer-focus-visible:ring-3 peer-focus-visible:ring-white/40 peer-disabled:opacity-40 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"></span>
        </label>
      </div>
    </aside>

    <div class="min-w-0">
      <section class="glass-panel overflow-hidden rounded-[1.75rem]" aria-labelledby="month-heading">
        <div class="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-3 sm:px-5 sm:py-4">
          <button type="button" class="focus-ring grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25" aria-label="Previous month" disabled={year === firstYear && month === 0} onclick={previousMonth}>‹</button>
          <div class="text-center">
            <p class="m-0 text-[0.65rem] font-750 tracking-wider text-teal-300 uppercase">{countryName}</p>
            <h2 id="month-heading" class="m-0 mt-0.5 text-lg font-780 tracking-tight text-white sm:text-2xl">{displayMonth()}</h2>
            <button type="button" class="focus-ring mt-0.5 cursor-pointer border-0 bg-transparent text-xs font-650 text-teal-300 hover:text-teal-200" onclick={goToToday}>Today</button>
          </div>
          <button type="button" class="focus-ring grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25" aria-label="Next month" disabled={year === lastYear && month === 11} onclick={nextMonth}>›</button>
        </div>

        {#if status === 'loading'}
          <div class="grid min-h-96 place-items-center p-8" aria-live="polite">
            <div class="text-center">
              <span class="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-teal-300/20 border-t-teal-300"></span>
              <p class="mb-0 mt-4 text-sm text-slate-500">Loading {countryName} through {lastYear}…</p>
            </div>
          </div>
        {:else if status === 'error'}
          <div class="grid min-h-96 place-items-center p-8 text-center" aria-live="polite">
            <div>
              <p class="m-0 text-base font-700 text-white">Holiday data is unavailable</p>
              <p class="mb-0 mt-2 max-w-sm text-sm leading-6 text-slate-500">This country may not have data for the selected years, or the service may be temporarily unavailable. Try another country or reload.</p>
            </div>
          </div>
        {:else}
          <div class="p-1.5 sm:p-4">
            <div class="grid grid-cols-7" aria-hidden="true">
              {#each weekdays as weekday}
                <span class="py-2 text-center text-[0.62rem] font-750 tracking-wider text-slate-600 uppercase sm:text-xs">{weekday}</span>
              {/each}
            </div>
            <div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-white/6" role="grid" aria-label={`${displayMonth()}, ${countryName}`}>
              {#each days as day (day.date)}
                {@const daySchool = schoolFor(day.date)}
                {@const regionCodes = affectedRegionCodes(daySchool, selectedRegionSet)}
                {@const dayPublic = publicFor(day.date)}
                {@const visibleSchool = daySchool.length > 0 && (!overlapOnly || regionCodes.length >= 2)}
                <button
                  type="button"
                  class={`focus-ring relative min-h-14 min-w-0 cursor-pointer border-0 p-1.5 text-left transition sm:min-h-23 sm:p-2.5 ${dayClass(day.inMonth, daySchool.length > 0, regionCodes.length, day.date)}`}
                  role="gridcell"
                  aria-label={`${displayDate(day.date)}${daySchool.length ? `, school holiday${regionCodes.length ? ` in ${regionCodes.length} selected regions` : ''}` : ''}${dayPublic.length ? `, ${dayPublic.map((holiday) => holiday.name).join(', ')}` : ''}`}
                  aria-selected={day.date === selectedDate}
                  onclick={() => (selectedDate = day.date)}
                >
                  <span class={`text-xs font-700 sm:text-sm ${day.date === localIsoDate(now) ? 'grid h-6 w-6 place-items-center rounded-full bg-white text-slate-950' : ''}`}>{day.day}</span>
                  {#if visibleSchool}
                    <span class={`absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md px-1.5 py-0.5 text-[0.54rem] font-800 leading-3 sm:bottom-2 sm:left-2 sm:text-[0.65rem] ${overlapOnly ? 'bg-violet-300 text-violet-950' : 'bg-teal-300/18 text-teal-200'}`}>
                      {regionCodes.length === 0 ? 'School' : regionCodes.length === 1 ? regionShortCode(regionCodes[0]) : `${regionCodes.length} regions`}
                    </span>
                  {/if}
                  {#if dayPublic.length > 0}
                    <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgb(251_113_133_/_0.55)] sm:right-2.5 sm:top-2.5" title={dayPublic.map((holiday) => holiday.name).join(', ')}></span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <section class="mt-4 rounded-[1.5rem] border border-white/8 bg-white/[0.025] p-4 sm:p-5" aria-live="polite" aria-labelledby="day-heading">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="day-heading" class="m-0 text-base font-750 text-white sm:text-lg">{displayDate(selectedDate)}</h2>
          <div class="flex gap-3 text-[0.68rem] font-650 text-slate-500">
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-teal-300"></span>School</span>
            <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-rose-400"></span>Public</span>
          </div>
        </div>

        {#if selectedSchoolHolidays.length === 0 && selectedPublicHolidays.length === 0}
          <p class="mb-0 mt-3 text-sm text-slate-600">No selected holidays on this day.</p>
        {:else}
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            {#each selectedPublicHolidays as holiday (holiday.id)}
              <div class="rounded-xl border border-rose-300/12 bg-rose-300/[0.055] px-3.5 py-3">
                <p class="m-0 text-sm font-700 text-rose-100">{holiday.name}</p>
                <p class="mb-0 mt-1 text-xs text-rose-200/45">{publicScope(holiday)}</p>
              </div>
            {/each}
            {#each selectedSchoolHolidays as holiday (holiday.id)}
              <div class="rounded-xl border border-teal-300/12 bg-teal-300/[0.045] px-3.5 py-3">
                <p class="m-0 text-sm font-700 text-teal-100">{holiday.name}</p>
                <p class="mb-0 mt-1 text-xs text-teal-200/45">{schoolScope(holiday)}</p>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </section>

  <footer class="mt-6 px-2 text-center text-xs leading-5 text-slate-600 sm:px-0">
    Holiday data:
    <a class="text-slate-500 underline decoration-white/15 underline-offset-2 hover:text-white" href="https://www.openholidaysapi.org/en/" target="_blank" rel="noreferrer">OpenHolidays API</a>
    ·
    <a class="text-slate-500 underline decoration-white/15 underline-offset-2 hover:text-white" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a>.
    Coverage varies by country. Regional and local exceptions can apply; check official announcements when it matters.
  </footer>
</main>
