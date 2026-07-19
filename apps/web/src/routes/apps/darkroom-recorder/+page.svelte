<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    openCamera,
    type CameraController,
    type CameraDevice,
  } from '$lib/browser/camera';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    RECORDING_LIMIT_MS,
    RECORDING_WARNING_MS,
    isRecordingControlKey,
    startVideoRecording,
    type ActiveRecording,
    type RecordedClip,
  } from './recorder';

  type Mode =
    | 'idle'
    | 'starting'
    | 'ready'
    | 'armed'
    | 'recording'
    | 'finalizing'
    | 'finished'
    | 'error'
    | 'unsupported';

  let video = $state<HTMLVideoElement>();
  let camera = $state<CameraController | null>(null);
  let recording = $state<ActiveRecording | null>(null);
  let mode = $state<Mode>('idle');
  let blackout = $state(false);
  let audioEnabled = $state(true);
  let cameras: CameraDevice[] = $state([]);
  let selectedCamera = $state('');
  let cameraChanging = $state(false);
  let error = $state('');
  let warning = $state('');
  let elapsedMs = $state(0);
  let statusPeek = $state(false);
  let clip: RecordedClip | null = $state(null);
  let clipUrl = $state('');
  let shareAvailable = $state(false);
  let sharing = $state(false);
  let discardPending = $state(false);
  let anotherPending = $state(false);
  let destroyed = false;
  let wakeLock: WakeLockSentinel | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let limitTimer: ReturnType<typeof setTimeout> | null = null;
  let recordingStartedAt = 0;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let held = false;
  let multiTouch = false;
  const pointers = new Set<number>();

  const canEnterBlackout = $derived(mode === 'ready' && camera?.stream());
  const blackoutLabel = $derived(
    mode === 'recording'
      ? 'Recording. Tap to stop. Hold to check status. Use two fingers to show controls.'
      : mode === 'armed'
        ? 'Ready to record. Tap to start. Hold to check status. Use two fingers to show controls.'
        : 'Recording finished. Use two fingers to show controls.',
  );
  const spokenStatus = $derived(
    mode === 'recording'
      ? 'Recording started'
      : mode === 'finalizing'
        ? 'Finalizing recording'
        : mode === 'finished'
          ? 'Recording finished'
          : mode === 'armed'
            ? 'Ready to record'
            : '',
  );

  async function startCamera(): Promise<void> {
    if (!video) return;
    stopCamera();
    mode = 'starting';
    error = '';
    warning = '';
    try {
      camera = await openCamera(video, {
        audio: audioEnabled,
        video: {
          width: { max: 1920, ideal: 1920 },
          height: { max: 1080, ideal: 1080 },
          frameRate: { max: 30, ideal: 30 },
        },
      });
      cameras = await camera.devices();
      selectedCamera = camera.activeDeviceId() ?? cameras[0]?.id ?? '';
      mode = 'ready';
    } catch (cause) {
      mode = 'error';
      error = cameraError(cause, audioEnabled);
    }
  }

  async function changeCamera(event: Event): Promise<void> {
    if (!camera) return;
    const cameraId = (event.currentTarget as HTMLSelectElement).value;
    selectedCamera = cameraId;
    cameraChanging = true;
    error = '';
    try {
      await camera.start(cameraId);
      selectedCamera = camera.activeDeviceId() ?? cameraId;
    } catch (cause) {
      stopCamera();
      mode = 'error';
      error = cameraError(cause, audioEnabled);
    } finally {
      cameraChanging = false;
    }
  }

  async function changeAudio(): Promise<void> {
    if (mode === 'ready') await startCamera();
  }

  async function retryWithoutAudio(): Promise<void> {
    audioEnabled = false;
    await startCamera();
  }

  async function enterBlackout(): Promise<void> {
    if (!canEnterBlackout) return;
    mode = 'armed';
    blackout = true;
    statusPeek = false;
    await requestWakeLock();
  }

  function leaveBlackout(): void {
    blackout = false;
    statusPeek = false;
    clearHold();
    pointers.clear();
    multiTouch = false;
    if (mode !== 'recording' && mode !== 'finalizing') void releaseWakeLock();
  }

  function toggleRecording(): void {
    if (mode === 'armed') beginRecording();
    else if (mode === 'recording') stopRecording();
  }

  function beginRecording(): void {
    const stream = camera?.stream();
    if (!stream || mode !== 'armed') return;
    error = '';
    warning = '';
    elapsedMs = 0;
    recordingStartedAt = Date.now();
    try {
      const nextRecording = startVideoRecording(stream);
      recording = nextRecording;
      mode = 'recording';
      elapsedTimer = setInterval(() => {
        elapsedMs = Date.now() - recordingStartedAt;
      }, 250);
      limitTimer = setTimeout(stopRecording, RECORDING_LIMIT_MS);
      void nextRecording.finished.then(acceptClip).catch(recordingFailed);
    } catch (cause) {
      recordingFailed(cause);
    }
  }

  function stopRecording(): void {
    if (!recording || mode !== 'recording') return;
    elapsedMs = Date.now() - recordingStartedAt;
    mode = 'finalizing';
    clearRecordingTimers();
    recording.stop();
  }

  function acceptClip(nextClip: RecordedClip): void {
    if (destroyed) return;
    recording = null;
    clearRecordingTimers();
    replaceClip(nextClip);
    warning = nextClip.warning ?? '';
    mode = 'finished';
    stopCamera();
    void releaseWakeLock();
  }

  function recordingFailed(cause: unknown): void {
    if (destroyed) return;
    recording = null;
    clearRecordingTimers();
    stopCamera();
    blackout = false;
    mode = 'error';
    error = cause instanceof Error ? cause.message : 'The recording could not be completed.';
    void releaseWakeLock();
  }

  function replaceClip(nextClip: RecordedClip | null): void {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clip = nextClip;
    clipUrl = nextClip ? URL.createObjectURL(nextClip.blob) : '';
    if (!nextClip) {
      shareAvailable = false;
      return;
    }
    const file = clipFile(nextClip);
    shareAvailable =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });
  }

  async function shareClip(): Promise<void> {
    if (!clip || !shareAvailable) return;
    sharing = true;
    error = '';
    try {
      await navigator.share({ files: [clipFile(clip)], title: 'Darkroom recording' });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        error = 'The share sheet could not be opened. Download the clip instead.';
      }
    } finally {
      sharing = false;
    }
  }

  async function recordAnother(): Promise<void> {
    if (!anotherPending) {
      anotherPending = true;
      discardPending = false;
      return;
    }
    replaceClip(null);
    warning = '';
    discardPending = false;
    anotherPending = false;
    await startCamera();
  }

  function discardClip(): void {
    if (!discardPending) {
      discardPending = true;
      anotherPending = false;
      return;
    }
    replaceClip(null);
    warning = '';
    discardPending = false;
    anotherPending = false;
    mode = 'idle';
  }

  function pointerDown(event: PointerEvent): void {
    event.preventDefault();
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      multiTouch = true;
      clearHold();
      leaveBlackout();
      return;
    }
    held = false;
    holdTimer = setTimeout(() => {
      held = true;
      statusPeek = true;
    }, 450);
  }

  function pointerUp(event: PointerEvent): void {
    event.preventDefault();
    pointers.delete(event.pointerId);
    if (multiTouch) {
      if (pointers.size === 0) multiTouch = false;
      return;
    }
    clearHoldTimer();
    if (held) {
      statusPeek = false;
      held = false;
      return;
    }
    toggleRecording();
  }

  function pointerCancel(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) multiTouch = false;
    clearHold();
  }

  function keyboard(event: KeyboardEvent): void {
    if (!blackout || event.repeat) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      leaveBlackout();
      return;
    }
    if (isRecordingControlKey(event.key)) {
      event.preventDefault();
      toggleRecording();
    }
  }

  async function requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }

  async function releaseWakeLock(): Promise<void> {
    const current = wakeLock;
    wakeLock = null;
    await current?.release();
  }

  function visibilityChanged(): void {
    if (document.visibilityState === 'hidden' && mode === 'recording') stopRecording();
    else if (document.visibilityState === 'visible' && blackout && !wakeLock) void requestWakeLock();
  }

  function stopCamera(): void {
    camera?.stop();
    camera = null;
  }

  function clearRecordingTimers(): void {
    if (elapsedTimer) clearInterval(elapsedTimer);
    if (limitTimer) clearTimeout(limitTimer);
    elapsedTimer = null;
    limitTimer = null;
  }

  function clearHoldTimer(): void {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  }

  function clearHold(): void {
    clearHoldTimer();
    held = false;
    statusPeek = false;
  }

  function clipFile(value: RecordedClip): File {
    return new File([value.blob], value.filename, {
      type: value.blob.type,
      lastModified: Date.now(),
    });
  }

  function formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function cameraName(device: CameraDevice, index: number): string {
    return device.label || `Camera ${index + 1}`;
  }

  function cameraError(cause: unknown, requestedAudio: boolean): string {
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      return requestedAudio
        ? 'Camera or microphone permission was denied. Allow both permissions, or retry without sound.'
        : 'Camera permission was denied. Allow it in your browser settings and try again.';
    }
    if (cause instanceof DOMException && cause.name === 'NotReadableError') {
      return 'The camera is busy or unavailable. Close other camera apps and try again.';
    }
    return 'The camera could not start on this device.';
  }

  onMount(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) mode = 'unsupported';
    document.addEventListener('visibilitychange', visibilityChanged);
  });

  onDestroy(() => {
    destroyed = true;
    recording?.stop();
    stopCamera();
    clearRecordingTimers();
    clearHold();
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityChanged);
    }
    void releaseWakeLock();
  });
</script>

<svelte:head>
  <title>Darkroom Recorder — e7g.eu</title>
  <meta name="description" content="Record private video with a distraction-free black screen." />
  <meta name="theme-color" content="#000000" />
</svelte:head>

<svelte:window onkeydown={keyboard} />

<main class="mx-auto min-h-dvh max-w-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Darkroom Recorder" subtitle="Black-screen video · stays on your device" icon="record" />

  <section class="glass-panel mt-8 overflow-hidden rounded-[2rem]">
    <div class="relative aspect-[4/5] min-h-96 bg-black sm:aspect-video">
      <video
        bind:this={video}
        class={mode === 'ready' || mode === 'starting' ? 'h-full w-full object-cover' : 'invisible h-full w-full object-cover'}
        playsinline
        muted
        aria-label="Camera preview"
      ></video>

      {#if mode === 'idle' || mode === 'error' || mode === 'unsupported'}
        <div class="absolute inset-0 grid place-items-center bg-black/92 p-7 text-center">
          <div class="max-w-md">
            <div class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-400/10 text-red-300">
              <span class="h-5 w-5 rounded-full bg-current"></span>
            </div>
            {#if mode === 'unsupported'}
              <h2 class="mb-0 mt-5 text-xl font-700">Recording is unavailable</h2>
              <p class="mb-0 mt-2 text-sm leading-6 text-slate-400">This browser does not provide the camera recording features this tool needs.</p>
            {:else}
              <h2 class="mb-0 mt-5 text-xl font-700">Frame it, then go black</h2>
              <p class="mb-0 mt-2 text-sm leading-6 text-slate-400">Preview the rear camera first. In dark mode, the whole black screen becomes the record button.</p>
              {#if error}<p class="mb-0 mt-4 text-sm leading-6 text-red-300" role="alert">{error}</p>{/if}
              <div class="mt-5 flex flex-wrap justify-center gap-3">
                <button class="focus-ring cursor-pointer rounded-full bg-red-300 px-5 py-3 text-sm font-750 text-slate-950 hover:bg-red-200" onclick={startCamera}>Start camera</button>
                {#if mode === 'error' && audioEnabled}
                  <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/7 px-5 py-3 text-sm font-650 text-white hover:bg-white/12" onclick={retryWithoutAudio}>Retry without sound</button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {:else if mode === 'starting'}
        <div class="absolute inset-0 grid place-items-center bg-black/75 text-sm font-650 text-slate-300">Starting camera…</div>
      {:else if mode === 'finished' && clipUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video class="h-full w-full bg-black object-contain" src={clipUrl} controls playsinline aria-label="Recorded clip"></video>
      {/if}
    </div>

    {#if mode === 'ready'}
      <div class="border-t border-white/8 p-5 sm:p-6">
        <div class="grid gap-4 sm:grid-cols-2">
          {#if cameras.length > 1}
            <label class="text-sm font-650 text-slate-300">Camera
              <select class="focus-ring mt-2 w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-white" value={selectedCamera} onchange={changeCamera} disabled={cameraChanging}>
                {#each cameras as device, index (device.id)}
                  <option value={device.id}>{cameraName(device, index)}</option>
                {/each}
              </select>
            </label>
          {/if}
          <label class="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <input class="h-4 w-4 accent-red-400" type="checkbox" bind:checked={audioEnabled} onchange={changeAudio} />
            Record microphone audio
          </label>
        </div>
        <button class="focus-ring mt-5 w-full cursor-pointer rounded-full bg-red-300 px-5 py-3.5 text-sm font-750 text-slate-950 hover:bg-red-200" onclick={enterBlackout}>Enter dark mode</button>
      </div>
    {:else if mode === 'recording' || mode === 'finalizing'}
      <div class="border-t border-white/8 p-5 text-center sm:p-6">
        <p class="m-0 text-sm font-750 tracking-[0.18em] text-red-300 uppercase">{mode === 'recording' ? `Recording ${formatDuration(elapsedMs)}` : 'Finalizing…'}</p>
        {#if mode === 'recording'}
          <button class="focus-ring mt-4 cursor-pointer rounded-full bg-red-300 px-6 py-3 text-sm font-750 text-slate-950" onclick={stopRecording}>Stop recording</button>
        {/if}
      </div>
    {:else if mode === 'finished' && clip}
      <div class="border-t border-white/8 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="m-0 font-700 text-white">Clip ready</p>
            <p class="mb-0 mt-1 text-sm text-slate-400">{formatDuration(clip.durationMs)} · {formatSize(clip.blob.size)}</p>
          </div>
          <span class="rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-700 text-emerald-300">On this device</span>
        </div>
        {#if warning}<p class="mb-0 mt-4 text-sm leading-6 text-amber-300" role="status">{warning}</p>{/if}
        {#if error}<p class="mb-0 mt-4 text-sm leading-6 text-red-300" role="alert">{error}</p>{/if}
        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          {#if shareAvailable}
            <button class="focus-ring cursor-pointer rounded-full bg-red-300 px-5 py-3 text-sm font-750 text-slate-950 hover:bg-red-200 disabled:opacity-50" onclick={shareClip} disabled={sharing}>{sharing ? 'Opening share sheet…' : 'Share or save'}</button>
          {/if}
          <a class="focus-ring rounded-full border border-white/12 bg-white/8 px-5 py-3 text-center text-sm font-700 text-white no-underline hover:bg-white/13" href={clipUrl} download={clip.filename}>Download</a>
          <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-700 text-white hover:bg-white/13" onclick={recordAnother}>{anotherPending ? 'Tap again to replace clip' : 'Record another'}</button>
          <button class="focus-ring cursor-pointer rounded-full border border-red-300/20 bg-red-300/5 px-5 py-3 text-sm font-700 text-red-200 hover:bg-red-300/10" onclick={discardClip}>{discardPending ? 'Tap again to discard' : 'Discard clip'}</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="mt-6 rounded-[1.5rem] border border-white/8 bg-black/20 p-5 text-sm leading-6 text-slate-400">
    <h2 class="m-0 text-base font-700 text-white">Blind controls</h2>
    <ul class="mb-0 mt-3 space-y-1.5 pl-5">
      <li>Tap anywhere to start or stop.</li>
      <li>Hold to peek at recording status.</li>
      <li>Tap with two fingers to show controls.</li>
      <li>Volume and media buttons work only when your browser passes them through.</li>
    </ul>
    <p class="mb-0 mt-4">Clips are limited to 10 minutes and remain in memory until saved. Locking or leaving the app may stop recording. System camera and microphone indicators remain visible.</p>
    <p class="mb-0 mt-3 text-slate-500">Nothing is uploaded. Respect venue rules and the privacy of people around you.</p>
  </section>
</main>

{#if blackout}
  <button
    class="fixed inset-0 z-50 block h-dvh w-screen touch-none cursor-default border-0 bg-black p-0 text-white outline-none"
    type="button"
    aria-label={blackoutLabel}
    onpointerdown={pointerDown}
    onpointerup={pointerUp}
    onpointercancel={pointerCancel}
    oncontextmenu={(event) => event.preventDefault()}
  >
    {#if statusPeek}
      <span class="absolute inset-0 grid place-items-center bg-black text-[0.7rem] font-750 tracking-[0.22em] text-red-950 uppercase">
        {mode === 'recording'
          ? elapsedMs >= RECORDING_WARNING_MS
            ? `REC ${formatDuration(elapsedMs)} · stops at 10:00`
            : `REC ${formatDuration(elapsedMs)}`
          : mode === 'armed'
            ? 'Ready · tap to record'
            : mode === 'finalizing'
              ? 'Finalizing'
              : 'Clip ready · two-finger tap'}
      </span>
    {/if}
  </button>
{/if}

<div class="sr-only" aria-live="polite">{spokenStatus}</div>
