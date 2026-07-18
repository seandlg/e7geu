<script lang="ts">
  import { onDestroy } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import { watchSpeed, type LocationFailure, type SpeedReading } from '$lib/browser/geolocation';
  import { convertSpeed, type SpeedUnit } from '$lib/domain/speed';

  let unit: SpeedUnit = $state('km/h');
  let status: 'idle' | 'locating' | 'active' | 'failed' = $state('idle');
  let reading: SpeedReading | null = $state(null);
  let failure: LocationFailure | null = $state(null);
  let stopWatching: (() => void) | null = null;
  const units: readonly SpeedUnit[] = ['km/h', 'mph', 'kn'];

  const displaySpeed = $derived(toDisplaySpeed(reading, unit));
  const failureMessages: Record<LocationFailure, string> = {
    denied: 'Location permission was denied. Enable it in your browser settings and try again.',
    unavailable: 'Your position is currently unavailable. Move outdoors and try again.',
    timeout: 'Getting a GPS fix took too long. Move outdoors and try again.',
    unsupported: 'This browser does not provide the Geolocation API.'
  };

  function start(): void {
    stopWatching?.();
    reading = null;
    failure = null;
    status = 'locating';
    stopWatching = watchSpeed(
      (nextReading) => {
        reading = nextReading;
        status = 'active';
      },
      (nextFailure) => {
        failure = nextFailure;
        status = 'failed';
      }
    );
  }

  function toDisplaySpeed(value: SpeedReading | null, selectedUnit: SpeedUnit): number | null {
    return value?.metresPerSecond == null
      ? null
      : convertSpeed(value.metresPerSecond, selectedUnit);
  }

  function stop(): void {
    stopWatching?.();
    stopWatching = null;
    status = 'idle';
  }

  onDestroy(() => stopWatching?.());
</script>

<svelte:head>
  <title>GPS speedometer — e7g.eu</title>
  <meta name="description" content="A private GPS speedometer that runs entirely in your browser." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Speedometer" subtitle="Live GPS · stays on your device" icon="speed" />

  <section class="glass-panel mt-8 overflow-hidden rounded-[2rem] p-5 sm:p-8" aria-live="polite">
    <div class="mx-auto flex aspect-square max-w-md flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/45 shadow-[inset_0_0_80px_rgb(139_92_246_/_0.08)]">
      <div class="mb-2 text-xs font-650 tracking-[0.24em] text-slate-500 uppercase">
        {status === 'active' ? 'Current speed' : status === 'locating' ? 'Finding GPS' : 'Ready'}
      </div>
      <div class="tabular-nums text-[clamp(5rem,26vw,9rem)] font-250 leading-none tracking-[-0.08em] text-white">
        {displaySpeed === null ? '—' : displaySpeed < 10 ? displaySpeed.toFixed(1) : Math.round(displaySpeed)}
      </div>
      <div class="mt-2 text-lg font-650 text-violet-300">{unit}</div>
      {#if reading}
        <div class="mt-7 flex gap-6 text-center text-xs text-slate-500">
          <div><span class="block text-base font-650 text-slate-300">±{Math.round(reading.accuracy)} m</span>accuracy</div>
          <div><span class="block text-base font-650 text-slate-300">{reading.heading === null ? '—' : `${Math.round(reading.heading)}°`}</span>heading</div>
        </div>
      {/if}
    </div>

    <div class="mx-auto mt-7 flex w-fit rounded-full bg-black/20 p-1" aria-label="Speed unit">
      {#each units as option}
        <button class={`focus-ring min-w-18 cursor-pointer rounded-full border-0 px-4 py-2 text-sm font-650 transition ${unit === option ? 'bg-white text-slate-950' : 'bg-transparent text-slate-400'}`} onclick={() => (unit = option)}>{option}</button>
      {/each}
    </div>

    {#if failure}
      <p class="mx-auto mt-6 max-w-md rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-center text-sm leading-6 text-amber-100">{failureMessages[failure]}</p>
    {/if}

    <div class="mt-7 flex justify-center">
      {#if status === 'active' || status === 'locating'}
        <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-7 py-3 font-650 text-white transition hover:bg-white/14" onclick={stop}>Stop</button>
      {:else}
        <button class="focus-ring cursor-pointer rounded-full border-0 bg-violet-400 px-8 py-3.5 font-700 text-slate-950 shadow-lg shadow-violet-500/20 transition hover:bg-violet-300" onclick={start}>Start speedometer</button>
      {/if}
    </div>
  </section>

  <p class="mx-auto mt-5 max-w-lg text-center text-xs leading-5 text-slate-600">GPS speed is most accurate outdoors while moving. e7g.eu never stores or transmits your position.</p>
</main>
