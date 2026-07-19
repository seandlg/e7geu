<script lang="ts">
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    activeFilterCount,
    cafeDistricts,
    cafes,
    emptyCafeFilters,
    filterCafes,
    type Availability,
  } from './cafes';

  const districts = cafeDistricts(cafes);
  const featureRows: readonly {
    key: 'wifi' | 'power' | 'indoor' | 'outdoor' | 'toilet' | 'food';
    label: string;
  }[] = [
    { key: 'wifi', label: 'Wi-Fi' },
    { key: 'power', label: 'Sockets' },
    { key: 'indoor', label: 'Indoor' },
    { key: 'outdoor', label: 'Outdoor' },
    { key: 'toilet', label: 'Toilet' },
    { key: 'food', label: 'Food' },
  ];

  let query = $state(emptyCafeFilters.query);
  let district = $state(emptyCafeFilters.district);
  let wifi = $state(emptyCafeFilters.wifi);
  let power = $state(emptyCafeFilters.power);
  let outdoor = $state(emptyCafeFilters.outdoor);
  const matchingCafes = $derived(
    filterCafes(cafes, { query, district, wifi, power, outdoor }),
  );
  const filterCount = $derived(
    activeFilterCount({ query, district, wifi, power, outdoor }),
  );

  function resetFilters(): void {
    query = emptyCafeFilters.query;
    district = emptyCafeFilters.district;
    wifi = emptyCafeFilters.wifi;
    power = emptyCafeFilters.power;
    outdoor = emptyCafeFilters.outdoor;
  }

  function availabilityLabel(value: Availability): string {
    if (value === 'yes') return 'Yes';
    if (value === 'reported') return 'Reported';
    if (value === 'limited') return 'Limited';
    if (value === 'no') return 'No';
    if (value === 'reported-no') return 'Reported no';
    return 'Unknown';
  }

  function availabilityClass(value: Availability): string {
    if (value === 'yes') return 'border-emerald-300/15 bg-emerald-300/8 text-emerald-200';
    if (value === 'reported' || value === 'limited') return 'border-amber-300/15 bg-amber-300/8 text-amber-200';
    if (value === 'no' || value === 'reported-no') return 'border-white/8 bg-white/[0.025] text-slate-500';
    return 'border-white/8 bg-white/[0.025] text-slate-600';
  }
</script>

<svelte:head>
  <title>Berlin Work Cafés — e7g.eu</title>
  <meta
    name="description"
    content="A candid, searchable guide to Berlin cafés that are practical for laptop work."
  />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Berlin Work Cafés" subtitle="Candid notes · practical details" icon="cafe" />

  <section class="relative mt-8 overflow-hidden rounded-[2rem] border border-orange-300/12 bg-[#17120f] sm:flex sm:min-h-[22rem] sm:items-end" aria-labelledby="guide-heading">
    <img class="h-48 w-full object-cover object-[35%_center] sm:absolute sm:inset-0 sm:h-full sm:object-center" src="/images/berlin-work-cafes-hero.webp" alt="Sunlit café interior with window seating and a wall-mounted coffee menu" width="1800" height="600" fetchpriority="high" />
    <div class="absolute inset-0 hidden bg-gradient-to-r from-[#100d0a]/95 via-[#100d0a]/78 to-[#100d0a]/25 sm:block"></div>
    <div class="absolute inset-0 hidden bg-gradient-to-t from-[#100d0a]/65 via-transparent to-black/10 sm:block"></div>
    <div class="relative max-w-2xl px-5 py-7 sm:px-8 sm:py-10">
      <p class="m-0 text-xs font-700 tracking-[0.18em] text-orange-300 uppercase">Small and opinionated</p>
      <h1 id="guide-heading" class="mb-0 mt-3 text-3xl font-750 leading-tight tracking-[-0.035em] text-white sm:text-5xl">A desk, a socket,<br />and decent coffee.</h1>
      <p class="mb-0 mt-4 max-w-xl text-sm leading-6 text-stone-400 sm:text-base sm:leading-7">Not every café with Wi-Fi is a work café. These are assessed for the details that decide whether opening a laptop is actually a good idea.</p>
    </div>
  </section>

  <section class="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-labelledby="filters-heading">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h2 id="filters-heading" class="m-0 text-sm font-700 tracking-wide text-slate-300 uppercase">Find a café</h2>
      {#if filterCount > 0}
        <button class="focus-ring cursor-pointer border-0 bg-transparent p-1 text-sm font-650 text-orange-300 hover:text-orange-200" type="button" onclick={resetFilters}>Clear {filterCount}</button>
      {/if}
    </div>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <label class="focus-within:ring-orange-300/30 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-slate-500 transition focus-within:border-orange-300/30 focus-within:ring-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <input class="min-w-0 flex-1 border-0 bg-transparent text-base text-white outline-none placeholder:text-slate-600" type="search" placeholder="Name, area, or use case" autocomplete="off" bind:value={query} />
      </label>

      <label class="sr-only" for="cafe-district">District</label>
      <select id="cafe-district" class="focus-ring min-h-12 cursor-pointer rounded-2xl border border-white/10 bg-[#121522] px-4 text-base text-white" bind:value={district}>
        <option value="all">All districts</option>
        {#each districts as district}
          <option value={district}>{district}</option>
        {/each}
      </select>
    </div>

    <div class="mt-3 flex flex-wrap gap-2" aria-label="Required amenities">
      <button class={`focus-ring cursor-pointer rounded-full border px-3.5 py-2 text-sm font-650 transition ${wifi ? 'border-orange-300/40 bg-orange-300/14 text-orange-200' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`} type="button" aria-pressed={wifi} onclick={() => (wifi = !wifi)}>Wi-Fi</button>
      <button class={`focus-ring cursor-pointer rounded-full border px-3.5 py-2 text-sm font-650 transition ${power ? 'border-orange-300/40 bg-orange-300/14 text-orange-200' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`} type="button" aria-pressed={power} onclick={() => (power = !power)}>Sockets</button>
      <button class={`focus-ring cursor-pointer rounded-full border px-3.5 py-2 text-sm font-650 transition ${outdoor ? 'border-orange-300/40 bg-orange-300/14 text-orange-200' : 'border-white/10 bg-white/[0.025] text-slate-400 hover:bg-white/[0.06]'}`} type="button" aria-pressed={outdoor} onclick={() => (outdoor = !outdoor)}>Outdoor seating</button>
    </div>
  </section>

  <div class="mb-4 mt-7 flex items-end justify-between gap-4">
    <div>
      <p class="m-0 text-xs font-700 tracking-[0.16em] text-orange-300 uppercase">The shortlist</p>
      <h2 class="mb-0 mt-1 text-2xl font-750 tracking-tight text-white">{matchingCafes.length} {matchingCafes.length === 1 ? 'place' : 'places'}</h2>
    </div>
    <p class="m-0 text-right text-xs leading-5 text-slate-600">Best-rated first</p>
  </div>

  {#if matchingCafes.length > 0}
    <section class="grid gap-4 md:grid-cols-2" aria-label="Matching cafés">
      {#each matchingCafes as cafe (cafe.id)}
        <article class="glass-panel flex min-w-0 flex-col overflow-hidden rounded-[1.75rem]">
          <div class="flex items-start justify-between gap-4 border-b border-white/8 p-5 sm:p-6">
            <div class="min-w-0">
              <p class="m-0 text-xs font-650 tracking-wide text-orange-300 uppercase">{cafe.area}</p>
              <h3 class="mb-0 mt-2 text-xl font-750 leading-tight tracking-tight text-white">{cafe.name}</h3>
              <p class="mb-0 mt-1.5 text-xs leading-5 text-slate-500">{cafe.address}</p>
            </div>
            <div class="shrink-0 rounded-2xl bg-orange-300/10 px-3 py-2 text-center" aria-label={`${cafe.score} out of 5 ${cafe.scoreBasis === 'research' ? 'provisional research' : 'firsthand'} work café rating`}>
              <span class="block text-xl font-800 leading-none text-orange-300">{cafe.score}</span>
              <span class="mt-1 block text-[0.58rem] font-700 tracking-wider text-orange-200/55 uppercase">{cafe.scoreBasis === 'research' ? 'research' : 'of 5'}</span>
            </div>
          </div>

          <div class="flex flex-1 flex-col p-5 sm:p-6">
            <p class="m-0 text-[0.95rem] leading-6 text-slate-300">{cafe.verdict}</p>

            <div class="mt-5 flex flex-wrap gap-2">
              {#each cafe.bestFor as useCase}
                <span class="rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-xs font-600 text-slate-400">{useCase}</span>
              {/each}
            </div>

            <dl class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {#each featureRows as feature}
                {@const value = cafe.features[feature.key]}
                <div class={`rounded-xl border px-3 py-2 ${availabilityClass(value)}`}>
                  <dt class="text-[0.65rem] font-650 tracking-wide opacity-65 uppercase">{feature.label}</dt>
                  <dd class="m-0 mt-0.5 text-sm font-700">{availabilityLabel(value)}</dd>
                </div>
              {/each}
            </dl>

            <div class="mt-5 rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] p-3.5">
              <p class="m-0 text-[0.65rem] font-700 tracking-[0.14em] text-amber-300/70 uppercase">Worth knowing</p>
              <p class="mb-0 mt-1.5 text-sm leading-5 text-stone-400">{cafe.watchOut}</p>
            </div>

            <details class="mt-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-sm text-slate-500">
              <summary class="focus-ring cursor-pointer font-650 text-slate-400">What is verified?</summary>
              <p class="mb-0 mt-2 leading-5">{cafe.evidence}</p>
            </details>

            <div class="mt-auto flex flex-wrap gap-2 pt-5">
              <a class="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-orange-300 px-4 text-sm font-750 text-slate-950 no-underline hover:bg-orange-200" href={cafe.links.maps} target="_blank" rel="noreferrer">Open Maps <span aria-hidden="true">↗</span></a>
              {#if cafe.links.website}
                <a class="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-sm font-700 text-slate-300 no-underline hover:bg-white/[0.07]" href={cafe.links.website} target="_blank" rel="noreferrer">Website <span aria-hidden="true">↗</span></a>
              {/if}
            </div>
            <p class="mb-0 mt-3 text-center text-[0.68rem] text-slate-600">Details checked {cafe.checked}</p>
          </div>
        </article>
      {/each}
    </section>
  {:else}
    <section class="rounded-[1.75rem] border border-dashed border-white/12 bg-white/[0.025] px-5 py-14 text-center">
      <p class="m-0 text-lg font-700 text-slate-300">No matching café yet</p>
      <p class="mb-0 mt-2 text-sm text-slate-600">Clear a requirement or try another area.</p>
      <button class="focus-ring mt-5 cursor-pointer rounded-full border border-orange-300/25 bg-orange-300/8 px-5 py-2.5 text-sm font-700 text-orange-200" type="button" onclick={resetFilters}>Show all cafés</button>
    </section>
  {/if}

  <aside class="mt-8 rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500">
    <h2 class="m-0 text-sm font-700 text-slate-300">How to read this guide</h2>
    <p class="mb-0 mt-2">Scores combine the curator's firsthand notes with current research; research-only scores are provisional until a visit. Wi-Fi, sockets, rules, and opening hours can change—confirm before making a special trip.</p>
  </aside>
</main>
