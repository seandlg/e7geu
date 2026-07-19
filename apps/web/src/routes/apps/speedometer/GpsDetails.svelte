<script lang="ts">
  import { onMount } from 'svelte';
  import type { SpeedReading } from '$lib/browser/geolocation';
  import { convertSpeed, type SpeedUnit } from '$lib/domain/speed';

  let {
    reading,
    unit,
    open = $bindable(false)
  }: { reading: SpeedReading; unit: SpeedUnit; open?: boolean } = $props();

  let now = $state(Date.now());
  let container = $state<HTMLDivElement>();
  let trigger = $state<HTMLButtonElement>();
  const updateRate = $derived(
    reading.updateInterval === null ? null : 1_000 / reading.updateInterval
  );
  const fixAge = $derived(Math.max(0, now - reading.timestamp));
  const freshness = $derived(
    fixAge < 3_000 ? 'Fresh fix' : fixAge < 10_000 ? 'Aging fix' : 'Stale fix'
  );

  onMount(() => {
    const timer = window.setInterval(() => (now = Date.now()), 500);
    return () => window.clearInterval(timer);
  });

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) close(true);
  }

  function windowClick(event: MouseEvent): void {
    if (open && event.target instanceof Node && !container?.contains(event.target)) close(false);
  }

  function close(refocus: boolean): void {
    open = false;
    if (refocus) trigger?.focus();
  }

  function formatAge(milliseconds: number): string {
    if (milliseconds < 1_000) return '<1 s';
    return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
  }

  function formatSpeed(metresPerSecond: number | null): string {
    if (metresPerSecond === null) return 'Unavailable';
    return `${convertSpeed(metresPerSecond, unit).toFixed(1)} ${unit}`;
  }
</script>

<svelte:window onkeydown={keydown} onclick={windowClick} />

<div class="relative" bind:this={container}>
  <button
    bind:this={trigger}
    type="button"
    class="focus-ring flex cursor-pointer items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-[0.65rem] font-700 tracking-[0.08em] text-slate-500 uppercase transition hover:border-white/15 hover:bg-white/[0.07] hover:text-slate-300"
    aria-expanded={open}
    aria-controls="gps-details"
    title="GPS details"
    onclick={() => (open = !open)}
  >
    <span aria-hidden="true" class={`h-1.5 w-1.5 rounded-full ${fixAge < 3_000 ? 'bg-emerald-400' : fixAge < 10_000 ? 'bg-amber-300' : 'bg-rose-400'}`}></span>
    <span class="sr-only">{freshness}.</span>
    GPS
  </button>

  {#if open}
    <section
      id="gps-details"
      class="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 max-h-[calc(100dvh_-_1.5rem)] overflow-y-auto rounded-2xl border border-white/12 bg-slate-950/95 text-left shadow-[0_22px_70px_rgb(0_0_0_/_0.65)] backdrop-blur-xl sm:absolute sm:bottom-[calc(100%_+_0.65rem)] sm:left-auto sm:right-0 sm:w-72"
      aria-label="GPS details"
      aria-live="off"
    >
      <header class="flex items-start justify-between border-b border-white/8 px-4 py-3.5">
        <div>
          <h2 class="m-0 text-sm font-750 text-slate-100">GPS details</h2>
          <p class="m-0 mt-0.5 text-[0.66rem] leading-4 text-slate-500">Live browser location data</p>
        </div>
        <button type="button" class="focus-ring -mr-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-lg leading-none text-slate-500 hover:bg-white/8 hover:text-white" aria-label="Close GPS details" onclick={() => close(true)}>×</button>
      </header>

      <dl class="m-0 grid grid-cols-2 gap-px bg-white/8">
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Update rate</dt>
          <dd class="m-0 mt-1 font-mono text-xs text-slate-200">{updateRate === null ? 'Waiting…' : `${updateRate.toFixed(1)} Hz`}</dd>
        </div>
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Fix age</dt>
          <dd class="m-0 mt-1 font-mono text-xs text-slate-200">{formatAge(fixAge)}</dd>
        </div>
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Speed source</dt>
          <dd class="m-0 mt-1 text-xs text-slate-200">{reading.speedSource === 'receiver' ? 'Device' : reading.speedSource === 'positions' ? 'Position delta' : 'Waiting…'}</dd>
        </div>
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Raw speed</dt>
          <dd class="m-0 mt-1 font-mono text-xs text-slate-200">{formatSpeed(reading.rawSpeed)}</dd>
        </div>
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Horizontal accuracy</dt>
          <dd class="m-0 mt-1 font-mono text-xs text-slate-200">±{Math.round(reading.accuracy)} m</dd>
        </div>
        <div class="bg-slate-950/95 px-4 py-3">
          <dt class="text-[0.62rem] font-650 tracking-wide text-slate-600 uppercase">Heading</dt>
          <dd class="m-0 mt-1 font-mono text-xs text-slate-200">{reading.heading === null ? 'Unavailable' : `${Math.round(reading.heading)}°`}</dd>
        </div>
      </dl>

      <div class="grid gap-2.5 border-t border-white/8 px-4 py-3.5 text-[0.68rem]">
        <div class="flex justify-between gap-4"><span class="text-slate-600">Coordinates</span><span class="font-mono text-slate-400">{reading.latitude.toFixed(5)}, {reading.longitude.toFixed(5)}</span></div>
        <div class="flex justify-between gap-4"><span class="text-slate-600">Altitude</span><span class="font-mono text-slate-400">{reading.altitude === null ? 'Unavailable' : `${Math.round(reading.altitude)} m${reading.altitudeAccuracy === null ? '' : ` ±${Math.round(reading.altitudeAccuracy)} m`}`}</span></div>
      </div>
      <p class="m-0 border-t border-white/8 px-4 py-3 text-[0.62rem] leading-4 text-slate-600">Rate averages the latest five fix intervals. Accuracy is a 95% confidence radius. Browsers do not expose satellite data.</p>
    </section>
  {/if}
</div>
