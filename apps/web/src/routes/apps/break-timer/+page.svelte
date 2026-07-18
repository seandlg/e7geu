<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import { configureTimerAudio, playBreakDue, playBreakFinished } from './audio';
  import BreakScreen from './BreakScreen.svelte';
  import { timerCopy, type AlertPreferences } from './content';
  import SessionSummaryView from './SessionSummary.svelte';
  import {
    createSession,
    restoreSession,
    summarizeSession,
    transitionTimer,
    type ReminderConfig,
    type SessionSummary,
    type TimerSession,
  } from './timer';
  import TimerClock from './TimerClock.svelte';
  import TimerSetup from './TimerSetup.svelte';

  const SETTINGS_KEY = 'e7g-break-timer-settings';
  const SESSION_KEY = 'e7g-break-timer-session';

  let preferences: AlertPreferences = $state({
    sound: true,
    vibration: true,
    notifications: false,
  });
  let session: TimerSession | null = $state(null);
  let summary: SessionSummary | null = $state(null);
  let now = $state(Date.now());
  let notificationStatus: NotificationPermission | 'unsupported' = $state('unsupported');
  let showInstallHint = $state(false);

  const text = timerCopy;

  function start(config: ReminderConfig): void {
    configureTimerAudio(preferences.sound);
    now = Date.now();
    session = createSession(config, now);
    summary = null;
    persistSession();
  }

  function tick(): void {
    if (!session) return;
    now = Date.now();
    const previous = session;
    const next = transitionTimer(previous, { type: 'tick', now });
    session = next;
    if (next !== previous) {
      announceTransition(previous, next);
      persistSession();
    }
  }

  function takeBreak(): void {
    if (!session) return;
    now = Date.now();
    session = transitionTimer(session, { type: 'take-break', now });
    persistSession();
  }

  function skipBreak(): void {
    if (!session) return;
    now = Date.now();
    session = transitionTimer(session, { type: 'skip-break', now });
    persistSession();
  }

  function pause(): void {
    if (!session) return;
    now = Date.now();
    session = transitionTimer(session, { type: 'pause', now });
    persistSession();
  }

  function resume(): void {
    if (!session) return;
    configureTimerAudio(preferences.sound);
    now = Date.now();
    session = transitionTimer(session, { type: 'resume', now });
    persistSession();
  }

  function endSession(): void {
    if (!session) return;
    now = Date.now();
    summary = summarizeSession(session, now);
    session = null;
    localStorage.removeItem(SESSION_KEY);
  }

  function startAgain(): void {
    summary = null;
  }

  function updatePreferences(nextPreferences: AlertPreferences): void {
    const previewSound = nextPreferences.sound && !preferences.sound;
    preferences = nextPreferences;
    configureTimerAudio(preferences.sound);
    if (previewSound) playBreakFinished();
    persistSettings();
  }

  async function requestNotifications(): Promise<void> {
    if (preferences.notifications) {
      updatePreferences({ ...preferences, notifications: false });
      return;
    }
    if (!('Notification' in window) || showInstallHint) return;
    notificationStatus = await Notification.requestPermission();
    if (notificationStatus === 'granted') {
      updatePreferences({ ...preferences, notifications: true });
    }
  }

  function announceTransition(previous: TimerSession, next: TimerSession): void {
    if (previous.phase === 'work' && next.phase === 'break') {
      playBreakDue();
      vibrate([70, 40, 70]);
      if (document.hidden) void showBreakNotification();
    } else if (previous.phase === 'break' && next.phase === 'work') {
      playBreakFinished();
      vibrate(40);
    }
  }

  async function showBreakNotification(): Promise<void> {
    if (
      !preferences.notifications ||
      notificationStatus !== 'granted' ||
      session?.phase !== 'break'
    ) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const isEyeBreak = session.config.id === 'eye-break' || session.config.id === 'frequent';
      await registration.showNotification(
        isEyeBreak ? text.notificationTitle : session.config.label,
        {
          body: isEyeBreak ? text.notificationBody : session.config.instruction,
          icon: '/icon.svg',
          tag: 'break-timer',
        },
      );
    } catch {
      // The visible timer remains the authoritative fallback.
    }
  }

  function vibrate(pattern: number | number[]): void {
    if (preferences.vibration && 'vibrate' in navigator) navigator.vibrate(pattern);
  }

  function persistSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ preferences }));
  }

  function persistSession(): void {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function restoreLocalState(): void {
    try {
      const settings: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
      if (settings && typeof settings === 'object') {
        const saved = settings as {
          preferences?: Partial<AlertPreferences>;
        };
        if (
          typeof saved.preferences?.sound === 'boolean' &&
          typeof saved.preferences.vibration === 'boolean' &&
          typeof saved.preferences.notifications === 'boolean'
        ) {
          preferences = saved.preferences as AlertPreferences;
        }
      }
      const savedSession: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      session = restoreSession(savedSession);
    } catch {
      session = null;
    }
  }

  onMount(() => {
    restoreLocalState();
    notificationStatus = 'Notification' in window ? Notification.permission : 'unsupported';
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    showInstallHint = isIos && !isStandalone;
    if (notificationStatus !== 'granted' || showInstallHint) {
      preferences = { ...preferences, notifications: false };
      persistSettings();
    }
    tick();

    const ticker = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', tick);
    };
  });
</script>

<svelte:head>
  <title>Break Timer — e7g.eu</title>
  <meta name="description" content="A private repeating break timer for eyes, movement, and focused work." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-9">
  <AppHeader title="Break Timer" subtitle={text.subtitle} icon="break" />

  {#if session?.phase === 'break'}
    <BreakScreen {session} {now} {text} onSkip={skipBreak} />
  {:else if session}
    <TimerClock
      {session}
      {now}
      {text}
      onPause={pause}
      onResume={resume}
      onBreak={takeBreak}
      onEnd={endSession}
    />
  {:else if summary}
    <SessionSummaryView {summary} {text} onAgain={startAgain} />
  {:else}
    <TimerSetup
      {preferences}
      {notificationStatus}
      {showInstallHint}
      onPreferences={updatePreferences}
      onRequestNotifications={requestNotifications}
      onStart={start}
    />
  {/if}
</main>
