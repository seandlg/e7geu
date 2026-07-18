<script lang="ts">
  import {
    timerCopy,
    timerPresets,
    type AlertPreferences,
    type TimerLocale,
  } from './content';
  import type { ReminderConfig } from './timer';

  let {
    locale,
    preferences,
    notificationStatus,
    showInstallHint,
    onLocale,
    onPreferences,
    onRequestNotifications,
    onStart,
  }: {
    locale: TimerLocale;
    preferences: AlertPreferences;
    notificationStatus: NotificationPermission | 'unsupported';
    showInstallHint: boolean;
    onLocale: (locale: TimerLocale) => void;
    onPreferences: (preferences: AlertPreferences) => void;
    onRequestNotifications: () => Promise<void>;
    onStart: (config: ReminderConfig) => void;
  } = $props();

  const text = $derived(timerCopy[locale]);
  const presets = $derived(timerPresets(locale));
  let selectedId = $state('eye-break');
  let customLabel = $state('Custom break');
  let customInstruction = $state('Look away and move for a moment.');
  let customMinutes = $state(25);
  let customSeconds = $state(60);

  $effect(() => {
    if (locale === 'de') {
      customLabel = 'Eigene Pause';
      customInstruction = 'Schau weg und bewege dich kurz.';
    }
  });

  const selectedConfig = $derived.by<ReminderConfig>(() => {
    const preset = presets.find((option) => option.id === selectedId);
    return (
      preset ?? {
        id: 'custom',
        label: customLabel.trim() || text.custom,
        workMs: clamp(customMinutes, 1, 180) * 60 * 1000,
        breakMs: clamp(customSeconds, 10, 600) * 1000,
        instruction: customInstruction.trim() || text.lookFar,
      }
    );
  });

  function togglePreference(key: keyof AlertPreferences): void {
    onPreferences({ ...preferences, [key]: !preferences[key] });
  }

  function selectCustom(): void {
    selectedId = 'custom';
  }

  function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
  }
</script>

<section class="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 shadow-[0_28px_90px_rgb(0_0_0_/_0.34)] backdrop-blur-xl">
  <div class="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-cyan-400/12 blur-3xl"></div>
  <div class="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl"></div>

  <header class="relative border-b border-white/8 px-5 py-7 sm:px-8 sm:py-9">
    <div class="flex flex-wrap items-start justify-between gap-5">
      <div>
        <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/8 px-3 py-1.5 text-[0.68rem] font-700 tracking-[0.14em] text-cyan-200 uppercase">
          <span class="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]"></span>{text.setupEyebrow}
        </div>
        <h2 class="m-0 max-w-2xl text-3xl font-760 leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">{text.setupTitle}</h2>
        <p class="mb-0 mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{text.setupDescription}</p>
      </div>
      <div class="grid grid-cols-2 rounded-xl bg-black/25 p-1" aria-label="Language">
        <button class={`focus-ring cursor-pointer rounded-lg border-0 px-3.5 py-2 text-xs font-750 ${locale === 'en' ? 'bg-white text-slate-950' : 'bg-transparent text-slate-500'}`} onclick={() => onLocale('en')}>EN</button>
        <button class={`focus-ring cursor-pointer rounded-lg border-0 px-3.5 py-2 text-xs font-750 ${locale === 'de' ? 'bg-white text-slate-950' : 'bg-transparent text-slate-500'}`} onclick={() => onLocale('de')}>DE</button>
      </div>
    </div>
  </header>

  <div class="relative grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
    <div>
      <h3 class="m-0 mb-3 text-xs font-750 tracking-[0.14em] text-slate-400 uppercase">{text.chooseRhythm}</h3>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {#each presets as preset (preset.id)}
          <button
            class={`focus-ring relative min-h-34 cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition ${selectedId === preset.id ? 'border-cyan-300/45 bg-cyan-300/10 shadow-[0_10px_30px_rgb(34_211_238_/_0.09)]' : 'border-white/9 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.06]'}`}
            onclick={() => (selectedId = preset.id)}
            aria-pressed={selectedId === preset.id}
          >
            <span class="block text-sm font-750 leading-5 text-white">{preset.label}</span>
            <span class="mt-4 block text-2xl font-800 tabular-nums tracking-tight text-cyan-200">{preset.workMs / 60_000}<span class="ml-1 text-xs font-650 text-slate-500">min</span></span>
            <span class="mt-1 block text-[0.65rem] text-slate-500">{preset.breakMs >= 60_000 ? `${preset.breakMs / 60_000} min` : `${preset.breakMs / 1000} sec`} break</span>
          </button>
        {/each}
        <button
          class={`focus-ring relative min-h-34 cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition ${selectedId === 'custom' ? 'border-cyan-300/45 bg-cyan-300/10 shadow-[0_10px_30px_rgb(34_211_238_/_0.09)]' : 'border-white/9 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.06]'}`}
          onclick={selectCustom}
          aria-pressed={selectedId === 'custom'}
        >
          <span class="block text-sm font-750 text-white">{text.custom}</span>
          <span class="mt-5 block text-3xl font-300 text-cyan-200">＋</span>
          <span class="mt-1 block text-[0.65rem] text-slate-500">1–180 min</span>
        </button>
      </div>

      {#if selectedId === 'custom'}
        <div class="mt-4 rounded-2xl border border-white/9 bg-black/18 p-4 sm:p-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="text-xs font-650 text-slate-400">{text.customName}<input class="focus-ring mt-2 block w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-3 text-sm text-white" maxlength="32" bind:value={customLabel} /></label>
            <label class="text-xs font-650 text-slate-400">{text.customInstruction}<input class="focus-ring mt-2 block w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 py-3 text-sm text-white" maxlength="100" bind:value={customInstruction} /></label>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <label class="rounded-xl bg-white/[0.04] p-3 text-xs font-650 text-slate-500">{text.every}<span class="mt-2 flex items-baseline gap-2"><input class="focus-ring min-w-0 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xl font-750 tabular-nums text-white" type="number" min="1" max="180" bind:value={customMinutes} /><span>{text.minutes}</span></span></label>
            <label class="rounded-xl bg-white/[0.04] p-3 text-xs font-650 text-slate-500">{text.breakFor}<span class="mt-2 flex items-baseline gap-2"><input class="focus-ring min-w-0 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xl font-750 tabular-nums text-white" type="number" min="10" max="600" bind:value={customSeconds} /><span>{text.seconds}</span></span></label>
          </div>
        </div>
      {/if}

      <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.045] px-4 py-3.5">
        <div><div class="text-xs font-700 text-cyan-100">{selectedConfig.label}</div><div class="mt-1 text-xs text-slate-500">{text.every} {selectedConfig.workMs / 60_000} {text.minutes} · {text.breakFor} {selectedConfig.breakMs / 1000} {text.seconds}</div></div>
        <span class="text-2xl" aria-hidden="true">↗</span>
      </div>
    </div>

    <aside class="flex flex-col rounded-2xl border border-white/8 bg-black/18 p-4 sm:p-5">
      <h3 class="m-0 text-xs font-750 tracking-[0.14em] text-slate-400 uppercase">{text.alerts}</h3>
      <div class="mt-3 divide-y divide-white/7">
        <button class="focus-ring flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-3.5 text-left" onclick={() => togglePreference('sound')} role="switch" aria-checked={preferences.sound}>
          <span class={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${preferences.sound ? 'bg-cyan-300/12 text-cyan-200' : 'bg-white/[0.045] text-slate-600'}`}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10v4h3l4 3V7l-4 3H5Zm11-1.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="min-w-0"><strong class="block text-sm font-700 text-white">{text.sound}</strong><span class="mt-0.5 block text-[0.68rem] leading-4 text-slate-600">{text.soundHint}</span></span>
          <span class={`ml-auto h-6 w-11 shrink-0 rounded-full p-1 transition ${preferences.sound ? 'bg-cyan-300' : 'bg-white/10'}`}><span class={`block h-4 w-4 rounded-full bg-slate-950 transition ${preferences.sound ? 'translate-x-5' : ''}`}></span></span>
        </button>

        <button class="focus-ring flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-3.5 text-left" onclick={() => togglePreference('vibration')} role="switch" aria-checked={preferences.vibration}>
          <span class={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${preferences.vibration ? 'bg-cyan-300/12 text-cyan-200' : 'bg-white/[0.045] text-slate-600'}`}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5h6v14H9zM5 8v8M2 10v4m17-6v8m3-6v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
          <span class="min-w-0"><strong class="block text-sm font-700 text-white">{text.vibration}</strong><span class="mt-0.5 block text-[0.68rem] leading-4 text-slate-600">{text.vibrationHint}</span></span>
          <span class={`ml-auto h-6 w-11 shrink-0 rounded-full p-1 transition ${preferences.vibration ? 'bg-cyan-300' : 'bg-white/10'}`}><span class={`block h-4 w-4 rounded-full bg-slate-950 transition ${preferences.vibration ? 'translate-x-5' : ''}`}></span></span>
        </button>

        <button class="focus-ring flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-45" onclick={onRequestNotifications} disabled={notificationStatus === 'unsupported' || notificationStatus === 'denied' || showInstallHint} role="switch" aria-checked={preferences.notifications}>
          <span class={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${preferences.notifications ? 'bg-cyan-300/12 text-cyan-200' : 'bg-white/[0.045] text-slate-600'}`}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8Zm-8 11h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="min-w-0"><strong class="block text-sm font-700 text-white">{text.notifications}</strong><span class="mt-0.5 block text-[0.68rem] leading-4 text-slate-600">{notificationStatus === 'denied' ? text.notificationsDenied : notificationStatus === 'unsupported' ? text.notificationsUnavailable : showInstallHint ? text.notificationInstallHint : text.notificationsHint}</span></span>
          <span class={`ml-auto h-6 w-11 shrink-0 rounded-full p-1 transition ${preferences.notifications ? 'bg-cyan-300' : 'bg-white/10'}`}><span class={`block h-4 w-4 rounded-full bg-slate-950 transition ${preferences.notifications ? 'translate-x-5' : ''}`}></span></span>
        </button>
      </div>

      <button class="focus-ring mt-6 w-full cursor-pointer rounded-2xl border-0 bg-cyan-300 px-5 py-4 font-780 text-slate-950 shadow-[0_14px_38px_rgb(34_211_238_/_0.18)] transition hover:-translate-y-0.5 hover:bg-cyan-200" onclick={() => onStart(selectedConfig)}>{text.start}<span class="ml-2" aria-hidden="true">→</span></button>
    </aside>
  </div>

  <p class="relative m-0 border-t border-white/8 px-5 py-4 text-center text-[0.68rem] leading-5 text-slate-600 sm:px-8">{text.noMedicalClaim}</p>
</section>
