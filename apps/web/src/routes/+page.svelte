<script lang="ts">
  import { toolboxApps } from '$lib/apps/catalog';
  import AppIcon from '$lib/ui/AppIcon.svelte';
</script>

<svelte:head>
  <title>e7g.eu — useful browser tools</title>
  <meta name="description" content="Private, useful tools that run entirely in your browser." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] sm:px-8 sm:pt-20">
  <header class="mb-10 sm:mb-14">
    <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/8 px-3 py-1.5 text-xs font-650 tracking-wide text-sky-200 uppercase">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></span>
      Runs on your device
    </div>
    <h1 class="m-0 max-w-2xl text-4xl font-750 leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl">Useful tools.<br /><span class="text-slate-400">Nothing leaves your browser.</span></h1>
    <p class="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">A small drawer of everyday utilities. No accounts, uploads, or tracking.</p>
  </header>

  <section aria-labelledby="tools-heading">
    <div class="mb-4 flex items-center justify-between">
      <h2 id="tools-heading" class="m-0 text-sm font-650 tracking-wide text-slate-300 uppercase">Tools</h2>
      <span class="text-sm text-slate-500">{toolboxApps.length} available</span>
    </div>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each toolboxApps as app}
        <a class="focus-ring group glass-panel relative min-h-52 overflow-hidden rounded-[1.75rem] p-4 text-white no-underline transition duration-250 hover:-translate-y-1 hover:border-white/20 hover:bg-white/11 sm:min-h-56 sm:p-5" href={app.href}>
          <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-15 blur-2xl transition group-hover:opacity-25" style:background={app.accent}></div>
          <div class="relative flex h-full flex-col">
            <div class="grid h-16 w-16 place-items-center rounded-[1.35rem] shadow-lg" style:background={`linear-gradient(145deg, ${app.accent}, color-mix(in srgb, ${app.accent} 55%, #151b34))`}>
              <AppIcon icon={app.icon} size={36} />
            </div>
            <div class="mt-auto pt-8">
              <p class="m-0 text-lg font-700 tracking-tight">{app.name}</p>
              <p class="m-0 mt-1.5 line-clamp-2 text-sm leading-5 text-slate-400">{app.description}</p>
              <span class="mt-3 inline-block rounded-full bg-white/7 px-2.5 py-1 text-[0.68rem] font-650 tracking-wide text-slate-400 uppercase">{app.capability}</span>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </section>

  <footer class="mt-16 border-t border-white/8 pt-5 text-sm text-slate-600">e7g.eu · built for the modern web</footer>
</main>
