<script lang="ts">
  import { onDestroy } from 'svelte';
  import { startSoundMeter, type SoundMeterSession } from '$lib/browser/sound-meter';
  import { estimateSoundLevel, soundContext } from '$lib/domain/sound';
  import AppHeader from '$lib/ui/AppHeader.svelte';

  let status: 'idle' | 'starting' | 'active' | 'error' = $state('idle');
  let session: SoundMeterSession | null = null;
  let level = $state<number | null>(null);
  let peak = $state<number | null>(null);
  let average = $state<number | null>(null);
  let spectrum = $state<number[]>(Array.from({ length: 24 }, () => 0.04));
  let error = $state('');
  let recentLevels: number[] = [];

  const context = $derived(soundContext(level ?? 20));
  const meterPosition = $derived(level === null ? 0 : Math.min(100, Math.max(0, level - 25)));

  async function start(): Promise<void> {
    stop();
    status = 'starting';
    error = '';
    level = null;
    peak = null;
    average = null;
    recentLevels = [];
    try {
      session = await startSoundMeter((reading) => {
        const nextLevel = estimateSoundLevel(reading.decibelsFullScale);
        level = nextLevel;
        peak = Math.max(peak ?? nextLevel, nextLevel);
        recentLevels = [...recentLevels.slice(-59), nextLevel];
        average = recentLevels.reduce((sum, value) => sum + value, 0) / recentLevels.length;
        spectrum = reading.spectrum;
        status = 'active';
      });
    } catch (cause) {
      status = 'error';
      error = microphoneError(cause);
    }
  }

  function stop(): void {
    session?.stop();
    session = null;
    if (status === 'active' || status === 'starting') status = 'idle';
  }

  function microphoneError(cause: unknown): string {
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      return 'Microphone permission was denied. Enable it in your browser settings and try again.';
    }
    return 'The microphone could not start. Check that another app is not using it.';
  }

  onDestroy(stop);
</script>

<svelte:head>
  <title>Sound meter — e7g.eu</title>
  <meta name="description" content="Estimate ambient sound levels privately in your browser." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Sound meter" subtitle="Live estimate · no audio recorded" icon="sound" />

  <section class="glass-panel mt-8 overflow-hidden rounded-[2rem] p-5 sm:p-8" aria-live="polite">
    <div class="mx-auto flex aspect-square max-w-sm flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/45 shadow-[inset_0_0_90px_rgb(52_211_153_/_0.08)]">
      <div class="mb-2 text-xs font-700 tracking-[0.22em] text-emerald-300/70 uppercase">Estimated level</div>
      <div class="tabular-nums text-[clamp(5rem,25vw,8rem)] font-250 leading-none tracking-[-0.08em] text-white">
        {level === null ? '—' : Math.round(level)}
      </div>
      <div class="mt-2 text-lg font-650 text-emerald-300">dB</div>
      <div class={`mt-6 rounded-full px-4 py-2 text-sm font-700 ${context.caution ? 'bg-rose-400/15 text-rose-200' : 'bg-white/7 text-slate-300'}`}>
        {level === null ? 'Ready to listen' : context.label}
      </div>
    </div>

    <div class="mt-8">
      <div class="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-500 opacity-90">
        <div class="absolute inset-y-0 right-0 bg-slate-900/85 transition-[width] duration-150" style:width={`${100 - meterPosition}%`}></div>
      </div>
      <div class="mt-2 flex justify-between text-[0.65rem] text-slate-600"><span>25</span><span>50</span><span>75</span><span>100+ dB</span></div>
    </div>

    <div class="mt-7 flex h-24 items-end gap-1 rounded-2xl bg-black/18 px-3 py-3" aria-label="Frequency spectrum">
      {#each spectrum as value}
        <div class="min-h-1 flex-1 rounded-full bg-emerald-300/75 transition-[height] duration-100" style:height={`${Math.max(4, value * 100)}%`}></div>
      {/each}
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3">
      <div class="rounded-2xl bg-white/5 p-4 text-center"><span class="block text-xs text-slate-500">Short average</span><strong class="mt-1 block text-xl font-650 tabular-nums">{average === null ? '—' : Math.round(average)} <small class="text-xs font-500 text-slate-500">dB</small></strong></div>
      <div class="rounded-2xl bg-white/5 p-4 text-center"><span class="block text-xs text-slate-500">Peak</span><strong class="mt-1 block text-xl font-650 tabular-nums">{peak === null ? '—' : Math.round(peak)} <small class="text-xs font-500 text-slate-500">dB</small></strong></div>
    </div>

    {#if level !== null}
      <div class={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${context.caution ? 'border-rose-300/15 bg-rose-300/8 text-rose-100' : 'border-white/8 bg-white/4 text-slate-400'}`}>
        <strong class="text-current">{context.label}:</strong> {context.detail}.
      </div>
    {/if}

    {#if error}<p class="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-4 text-center text-sm leading-6 text-amber-100" role="alert">{error}</p>{/if}

    <div class="mt-7 flex justify-center">
      {#if status === 'active' || status === 'starting'}
        <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-7 py-3 font-650 text-white transition hover:bg-white/14" onclick={stop}>{status === 'starting' ? 'Starting…' : 'Stop listening'}</button>
      {:else}
        <button class="focus-ring cursor-pointer rounded-full border-0 bg-emerald-300 px-8 py-3.5 font-700 text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200" onclick={start}>Use microphone</button>
      {/if}
    </div>
  </section>

  <p class="mx-auto mt-5 max-w-xl text-center text-xs leading-5 text-slate-600">Your browser provides an uncalibrated microphone signal, so this is a useful estimate—not a certified safety instrument. Audio is analyzed live and never stored.</p>
</main>
