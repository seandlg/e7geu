<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    captureVideoFrame,
    safeWebUrl,
    scanQrImage,
    startQrCamera,
    type CameraChoice,
    type QrCamera
  } from '$lib/browser/qr-scanner';
  import { downloadQrCode, renderQrCode } from '$lib/browser/qr-generator';
  import {
    addQrHistory,
    parseQrHistory,
    type QrHistoryItem
  } from '$lib/domain/qr-history';

  let video = $state<HTMLVideoElement>();
  let fileInput = $state<HTMLInputElement>();
  let qrCanvas = $state<HTMLCanvasElement>();
  let camera: QrCamera | null = null;
  let tab: 'scan' | 'generate' = $state('scan');
  let cameras: CameraChoice[] = $state([]);
  let selectedCamera = $state('');
  let status: 'idle' | 'starting' | 'scanning' | 'result' | 'error' = $state('idle');
  let result = $state('');
  let error = $state('');
  let flashAvailable = $state(false);
  let flashOn = $state(false);
  let copied = $state(false);
  let frozenFrame = $state('');
  let generateValue = $state('');
  let generateError = $state('');
  let history: QrHistoryItem[] = $state([]);
  let generateTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeAfterVisibility = false;
  const resultUrl = $derived(safeWebUrl(result));

  const HISTORY_KEY = 'e7g-qr-history';

  async function startCamera(): Promise<void> {
    if (!video) return;
    status = 'starting';
    error = '';
    result = '';
    frozenFrame = '';
    copied = false;
    camera?.destroy();
    camera = null;
    try {
      camera = await startQrCamera(
        video,
        ({ data }) => handleResult(data),
        (message) => (error = message)
      );
      cameras = await camera.cameras();
      selectedCamera = cameras[0]?.id ?? '';
      flashAvailable = await camera.hasFlash();
      status = 'scanning';
    } catch (cause) {
      status = 'error';
      error = cameraError(cause);
    }
  }

  function handleResult(data: string): void {
    frozenFrame = video ? (captureVideoFrame(video) ?? '') : '';
    result = data;
    status = 'result';
    camera?.stop();
    if ('vibrate' in navigator) navigator.vibrate(80);
    remember('scan', data);
  }

  async function switchTab(nextTab: 'scan' | 'generate'): Promise<void> {
    tab = nextTab;
    if (nextTab === 'generate') {
      camera?.destroy();
      camera = null;
      status = 'idle';
      await tick();
      if (generateValue.trim()) await updateGeneratedCode();
    }
  }

  async function updateGeneratedCode(): Promise<void> {
    if (generateTimer) clearTimeout(generateTimer);
    const value = generateValue.trim();
    generateError = '';
    if (!value || !qrCanvas) return;
    try {
      await renderQrCode(qrCanvas, value);
      generateTimer = setTimeout(() => remember('generate', value), 800);
    } catch {
      generateError = 'That QR code could not be generated.';
    }
  }

  function remember(type: QrHistoryItem['type'], value: string): void {
    history = addQrHistory(history, {
      id: crypto.randomUUID(),
      type,
      value,
      timestamp: Date.now()
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function removeHistory(id: string): void {
    history = history.filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  async function useHistory(item: QrHistoryItem): Promise<void> {
    if (item.type === 'scan') {
      await switchTab('scan');
      handleResult(item.value);
    } else {
      await switchTab('generate');
      generateValue = item.value;
      await tick();
      await updateGeneratedCode();
    }
  }

  function formatAge(timestamp: number): string {
    const minutes = Math.floor((Date.now() - timestamp) / 60_000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  function handleVisibilityChange(): void {
    if (document.hidden && status === 'scanning') {
      resumeAfterVisibility = true;
      camera?.stop();
      return;
    }
    if (!document.hidden && resumeAfterVisibility && tab === 'scan') {
      resumeAfterVisibility = false;
      void resume();
    }
  }

  async function resume(): Promise<void> {
    result = '';
    frozenFrame = '';
    copied = false;
    error = '';
    if (!camera) {
      await startCamera();
      return;
    }
    try {
      await camera.start();
      status = 'scanning';
    } catch (cause) {
      status = 'error';
      error = cameraError(cause);
    }
  }

  async function chooseCamera(): Promise<void> {
    if (!camera || !selectedCamera) return;
    await camera.setCamera(selectedCamera);
    flashAvailable = await camera.hasFlash();
    flashOn = false;
  }

  async function toggleFlash(): Promise<void> {
    if (!camera) return;
    try {
      await camera.toggleFlash();
      flashOn = !flashOn;
    } catch {
      error = 'The camera could not change its torch setting.';
    }
  }

  async function chooseImage(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    camera?.stop();
    status = 'starting';
    error = '';
    try {
      const scan = await scanQrImage(file);
      handleResult(scan.data);
    } catch {
      status = 'error';
      error = 'No QR code was found in that image.';
    }
  }

  async function copyResult(): Promise<void> {
    try {
      await navigator.clipboard.writeText(result);
      copied = true;
    } catch {
      error = 'Clipboard access is unavailable. Select the result and copy it manually.';
    }
  }

  function cameraError(cause: unknown): string {
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      return 'Camera permission was denied. Enable it in your browser settings or scan an image.';
    }
    return 'The camera could not start. Check that no other app is using it, or scan an image.';
  }

  onMount(() => {
    history = parseQrHistory(localStorage.getItem(HISTORY_KEY));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
  onDestroy(() => {
    camera?.destroy();
    if (generateTimer) clearTimeout(generateTimer);
  });
</script>

<svelte:head>
  <title>QR scanner — e7g.eu</title>
  <meta name="description" content="Scan QR codes privately with your camera or an image." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="QR scanner" subtitle="Camera stays on your device" icon="qr" />

  <div class="mt-8 flex rounded-full bg-black/20 p-1" role="tablist" aria-label="QR tools">
    <button class={`focus-ring flex-1 cursor-pointer rounded-full border-0 px-5 py-3 text-sm font-700 transition ${tab === 'scan' ? 'bg-white text-slate-950' : 'bg-transparent text-slate-400'}`} role="tab" aria-selected={tab === 'scan'} onclick={() => switchTab('scan')}>Scan QR</button>
    <button class={`focus-ring flex-1 cursor-pointer rounded-full border-0 px-5 py-3 text-sm font-700 transition ${tab === 'generate' ? 'bg-white text-slate-950' : 'bg-transparent text-slate-400'}`} role="tab" aria-selected={tab === 'generate'} onclick={() => switchTab('generate')}>Generate QR</button>
  </div>

  {#if tab === 'scan'}
    <section class="glass-panel mt-4 overflow-hidden rounded-[2rem]">
      <div class="relative aspect-[4/5] max-h-[65dvh] min-h-96 bg-black sm:aspect-[4/3]">
        <video bind:this={video} class="h-full w-full object-cover" playsinline muted aria-label="Camera preview"></video>
        {#if status === 'result' && frozenFrame}
          <img class="absolute inset-0 h-full w-full object-cover" src={frozenFrame} alt="" aria-hidden="true" />
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10"></div>
          <div class="absolute left-4 top-4 rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-700 text-slate-950 shadow-lg">Code captured</div>
        {/if}
        {#if status === 'idle' || status === 'error'}
          <div class="absolute inset-0 grid place-items-center bg-slate-950/88 p-7 text-center backdrop-blur-sm">
            <div>
              <div class="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-sky-400/12 text-sky-300">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 7 13 5H8L6.5 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5.5Z" stroke="currentColor" stroke-width="1.8"/><circle cx="11.5" cy="13" r="3.2" stroke="currentColor" stroke-width="1.8"/></svg>
              </div>
              <h2 class="m-0 text-xl font-700">Point, scan, done.</h2>
              <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Camera frames are processed locally and are never uploaded.</p>
              {#if error}<p class="mx-auto mt-4 max-w-sm text-sm leading-6 text-amber-200" role="alert">{error}</p>{/if}
              <button class="focus-ring mt-6 cursor-pointer rounded-full border-0 bg-sky-300 px-7 py-3.5 font-700 text-slate-950 transition hover:bg-sky-200" onclick={startCamera}>Use camera</button>
            </div>
          </div>
        {:else if status === 'starting'}
          <div class="absolute inset-0 grid place-items-center bg-slate-950/80 text-sm font-650 text-slate-300">Starting scanner…</div>
        {/if}
        {#if status === 'scanning'}
          <div class="pointer-events-none absolute inset-x-10 top-1/2 h-px bg-sky-300 shadow-[0_0_14px_2px_#38bdf8]"></div>
          <div class="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-650 backdrop-blur">Looking for a code</div>
        {/if}
      </div>

      <div class="p-4 sm:p-5">
        {#if status === 'result'}
          <div class="rounded-2xl border border-emerald-300/15 bg-emerald-300/7 p-4">
            <div class="mb-2 text-xs font-700 tracking-wide text-emerald-300 uppercase">QR code found</div>
            <p class="m-0 max-h-32 overflow-auto whitespace-pre-wrap break-all text-sm leading-6 text-slate-200">{result}</p>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:flex">
            {#if resultUrl}<a class="focus-ring flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-700 text-slate-950 no-underline" href={resultUrl} target="_blank" rel="noopener noreferrer">Open link</a>{/if}
            <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-650 text-white" onclick={copyResult}>{copied ? 'Copied' : 'Copy'}</button>
            <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-650 text-white" onclick={resume}>Scan another</button>
          </div>
        {:else}
          <div class="flex flex-wrap items-center gap-3">
            {#if cameras.length > 1}
              <label class="sr-only" for="camera">Camera</label>
              <select id="camera" class="focus-ring max-w-48 rounded-full border border-white/12 bg-slate-900 px-4 py-2.5 text-sm text-white" bind:value={selectedCamera} onchange={chooseCamera}>
                {#each cameras as option}<option value={option.id}>{option.label || 'Camera'}</option>{/each}
              </select>
            {/if}
            {#if flashAvailable}
              <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-650 text-white" onclick={toggleFlash}>{flashOn ? 'Torch off' : 'Torch on'}</button>
            {/if}
            <button class="focus-ring ml-auto cursor-pointer rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-650 text-white" onclick={() => fileInput?.click()}>Scan image</button>
            <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={chooseImage} />
          </div>
        {/if}
      </div>
    </section>
  {:else}
    <section class="glass-panel mt-4 rounded-[2rem] p-5 sm:p-8">
      <label class="text-sm font-700 text-slate-300" for="qr-value">Content</label>
      <textarea id="qr-value" class="focus-ring mt-3 min-h-32 w-full resize-y rounded-2xl border border-white/12 bg-black/20 p-4 text-base leading-6 text-white placeholder:text-slate-600" bind:value={generateValue} oninput={updateGeneratedCode} placeholder="Type text or paste a link…"></textarea>
      {#if generateValue.trim()}
        <div class="mt-5 flex flex-col items-center rounded-3xl bg-white p-5">
          <canvas bind:this={qrCanvas} class="h-auto max-w-full" aria-label="Generated QR code"></canvas>
          {#if generateError}<p class="text-sm text-red-700" role="alert">{generateError}</p>{/if}
        </div>
        <button class="focus-ring mx-auto mt-5 block cursor-pointer rounded-full border border-white/12 bg-white/8 px-6 py-3 text-sm font-650 text-white" onclick={() => qrCanvas && downloadQrCode(qrCanvas)}>Download PNG</button>
      {:else}
        <div class="grid min-h-64 place-items-center text-center text-sm text-slate-500">Your generated QR code will appear here.</div>
      {/if}
    </section>
  {/if}

  <section class="mt-8" aria-labelledby="history-title">
    <div class="mb-3 flex items-center justify-between">
      <h2 id="history-title" class="m-0 text-sm font-700 tracking-wide text-slate-300 uppercase">Recent</h2>
      {#if history.length}
        <button class="focus-ring cursor-pointer border-0 bg-transparent text-xs text-slate-500 hover:text-white" onclick={() => { history = []; localStorage.removeItem(HISTORY_KEY); }}>Clear</button>
      {/if}
    </div>
    {#if history.length}
      <div class="grid gap-2">
        {#each history as item (item.id)}
          <div class="glass-panel flex items-center gap-3 rounded-2xl p-3">
            <button class="focus-ring min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-left" onclick={() => useHistory(item)}>
              <span class="block truncate text-sm text-slate-200">{item.value}</span>
              <span class="mt-1 block text-[0.68rem] font-650 tracking-wide text-slate-600 uppercase">{item.type} · {formatAge(item.timestamp)}</span>
            </button>
            <button class="focus-ring grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-white/6 text-slate-500 hover:text-white" aria-label={`Delete ${item.value} from history`} onclick={() => removeHistory(item.id)}>×</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="glass-panel m-0 rounded-2xl p-5 text-center text-sm text-slate-600">Scans and generated codes will appear here.</p>
    {/if}
  </section>

  <p class="mx-auto mt-5 max-w-lg text-center text-xs leading-5 text-slate-600">Camera access requires HTTPS. Scanned content is untrusted—check a link before opening it.</p>
</main>
