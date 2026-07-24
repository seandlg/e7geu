<script lang="ts">
  import { onMount } from 'svelte';
  import { appCategories, toolboxApps, type ToolboxApp } from '$lib/apps/catalog';
  import AppIcon from '$lib/ui/AppIcon.svelte';
  import {
    addRecentApp,
    parseRecentAppHrefs,
    resolveRecentApps,
    type AppHref,
  } from './recent';
  import { searchApps } from './search';

  const RECENT_APPS_KEY = 'e7g-recent-apps';

  let query = $state('');
  let recentHrefs = $state<readonly AppHref[]>([]);
  const matchingApps = $derived(searchApps(toolboxApps, query));
  const recentApps = $derived(resolveRecentApps(toolboxApps, recentHrefs));
  const groupedApps = $derived(
    appCategories
      .map((category) => ({
        ...category,
        apps: matchingApps.filter((app) => app.category === category.id),
      }))
      .filter((group) => group.apps.length > 0),
  );

  onMount(() => {
    try {
      recentHrefs = parseRecentAppHrefs(localStorage.getItem(RECENT_APPS_KEY), toolboxApps);
    } catch {
      recentHrefs = [];
    }
  });

  function rememberApp(href: AppHref): void {
    recentHrefs = addRecentApp(recentHrefs, href);
    try {
      localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(recentHrefs));
    } catch {
      // Storage availability should never prevent navigation.
    }
  }

  function openApp(app: ToolboxApp): void {
    rememberApp(app.href);
  }
</script>

<svelte:head>
  <title>e7g.eu — useful browser tools</title>
  <meta name="description" content="Private, useful tools that run entirely in your browser." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-14">
  <header class="mb-9 sm:mb-11">
    <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/8 px-3 py-1.5 text-xs font-650 tracking-wide text-sky-200 uppercase">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></span>
      Runs on your device
    </div>
    <h1 class="m-0 max-w-2xl text-4xl font-750 leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">Useful tools. <span class="text-slate-400">Private by default.</span></h1>
    <p class="mt-4 max-w-xl text-base leading-7 text-slate-400">A small drawer of everyday utilities. No accounts, ads, or tracking.</p>
  </header>

  {#if recentApps.length > 0 && query.trim().length === 0}
    <section class="mb-10" aria-labelledby="recent-heading">
      <h2 id="recent-heading" class="m-0 mb-3 text-sm font-650 tracking-wide text-slate-300 uppercase">Recent</h2>
      <div class="grid gap-3 sm:grid-cols-3">
        {#each recentApps as app (app.href)}
          <a class="focus-ring group glass-panel relative min-h-32 overflow-hidden rounded-lg p-4 text-white no-underline transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/11" href={app.href} onclick={() => openApp(app)}>
            <div class="relative flex h-full items-start gap-4 sm:flex-col sm:gap-3">
              <div class="grid h-13 w-13 shrink-0 place-items-center rounded-xl shadow-lg" style:background={`linear-gradient(145deg, ${app.accent}, color-mix(in srgb, ${app.accent} 55%, #151b34))`}>
                <AppIcon icon={app.icon} size={30} />
              </div>
              <div class="min-w-0">
                <p class="m-0 font-700 tracking-tight">{app.name}</p>
                <p class="m-0 mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{app.description}</p>
              </div>
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <section aria-labelledby="tools-heading">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-baseline gap-3">
        <h2 id="tools-heading" class="m-0 text-sm font-650 tracking-wide text-slate-300 uppercase">All tools</h2>
        <span class="text-sm text-slate-500" aria-live="polite">{matchingApps.length}</span>
      </div>
      <label class="focus-within:ring-sky-300/35 flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.045] px-3.5 text-slate-500 transition focus-within:border-sky-300/30 focus-within:ring-3 sm:w-72">
        <svg class="shrink-0" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <input class="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" type="search" aria-label="Search all tools" placeholder="Search all tools" autocomplete="off" bind:value={query} />
      </label>
    </div>

    {#if matchingApps.length > 0}
      <div class="space-y-8">
        {#each groupedApps as group (group.id)}
          <section aria-labelledby={`group-${group.id}`}>
            <h3 id={`group-${group.id}`} class="m-0 mb-3 text-sm font-700 text-slate-400">{group.label}</h3>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {#each group.apps as app (app.href)}
                <a class="focus-ring group glass-panel flex min-h-24 items-start gap-4 overflow-hidden rounded-lg p-4 text-white no-underline transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/11" href={app.href} onclick={() => openApp(app)}>
                  <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-md" style:background={`linear-gradient(145deg, ${app.accent}, color-mix(in srgb, ${app.accent} 55%, #151b34))`}>
                    <AppIcon icon={app.icon} size={28} />
                  </div>
                  <div class="min-w-0 pt-0.5">
                    <p class="m-0 font-700 tracking-tight">{app.name}</p>
                    <p class="m-0 mt-1 line-clamp-2 text-sm leading-5 text-slate-400">{app.description}</p>
                  </div>
                </a>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {:else}
      <div class="rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-5 py-12 text-center">
        <p class="m-0 text-base font-650 text-slate-300">No tools found</p>
        <p class="mb-0 mt-1.5 text-sm text-slate-600">Try a name, feature, or category.</p>
      </div>
    {/if}
  </section>

  <footer class="mt-14 border-t border-white/8 pt-5 text-sm text-slate-600">e7g.eu · built for the modern web</footer>
</main>
