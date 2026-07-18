<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    drawImageFile,
    sampleCanvasColor,
    startColorCamera,
    type ColorCameraSession,
  } from '$lib/browser/color-inspector';
  import type { CameraDevice } from '$lib/browser/camera';
  import {
    clientPointToPixel,
    contrastRatio,
    nudgePixel,
    rgbToHex,
    rgbToHsl,
    type PixelPoint,
    type RgbColor,
  } from '$lib/domain/color';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import PixelLoupe from './PixelLoupe.svelte';

  type SavedColor = { hex: string; color: RgbColor };

  const HISTORY_KEY = 'e7g-color-history';
  const white: RgbColor = { red: 255, green: 255, blue: 255 };
  const black: RgbColor = { red: 0, green: 0, blue: 0 };

  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();
  let fileInput = $state<HTMLInputElement>();
  let session: ColorCameraSession | null = null;
  let mode: 'idle' | 'starting' | 'live' | 'frozen' | 'error' = $state('idle');
  let color: RgbColor | null = $state(null);
  let pickerX = $state(50);
  let pickerY = $state(50);
  let pixel: PixelPoint = $state({ x: 0, y: 0 });
  let loupeVisible = $state(false);
  let cameras: CameraDevice[] = $state([]);
  let selectedCamera = $state('');
  let cameraChanging = $state(false);
  let error = $state('');
  let copied = $state(false);
  let history: SavedColor[] = $state([]);

  const details = $derived(colorDetails(color));
  const whiteContrast = $derived(color ? contrastRatio(color, white) : 1);
  const blackContrast = $derived(color ? contrastRatio(color, black) : 1);

  async function startCamera(): Promise<void> {
    if (!video) return;
    stopCamera();
    mode = 'starting';
    error = '';
    copied = false;
    pickerX = 50;
    pickerY = 50;
    try {
      session = await startColorCamera(video, (nextColor) => {
        color = nextColor;
        mode = 'live';
      });
      cameras = await session.cameras();
      selectedCamera = session.activeDeviceId() ?? cameras[0]?.id ?? '';
    } catch (cause) {
      mode = 'error';
      error = cameraError(cause);
    }
  }

  function freeze(): void {
    if (!session || !canvas) return;
    session.capture(canvas);
    session.stop();
    session = null;
    selectPixel({ x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) });
    copied = false;
    mode = 'frozen';
  }

  function stopCamera(): void {
    session?.stop();
    session = null;
  }

  async function chooseImage(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !canvas) return;
    stopCamera();
    mode = 'starting';
    error = '';
    try {
      color = await drawImageFile(file, canvas);
      if (!color) throw new Error('Image could not be read');
      selectPixel({ x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) });
      copied = false;
      mode = 'frozen';
    } catch {
      mode = 'error';
      error = 'That image could not be read. Try a JPEG, PNG, or HEIF image.';
    }
  }

  async function chooseCamera(event: Event): Promise<void> {
    if (!session) return;
    const cameraId = (event.currentTarget as HTMLSelectElement).value;
    selectedCamera = cameraId;
    cameraChanging = true;
    error = '';
    try {
      await session.setCamera(cameraId);
      selectedCamera = session.activeDeviceId() ?? cameraId;
    } catch (cause) {
      stopCamera();
      mode = 'error';
      error = cameraError(cause);
    } finally {
      cameraChanging = false;
    }
  }

  function inspectPoint(event: PointerEvent): void {
    if (!canvas || mode !== 'frozen') return;
    const bounds = canvas.getBoundingClientRect();
    const point = clientPointToPixel(
      event.clientX,
      event.clientY,
      bounds,
      canvas.width,
      canvas.height,
    );
    if (point) selectPixel(point);
  }

  function beginInspect(event: PointerEvent): void {
    const target = event.currentTarget as HTMLCanvasElement;
    target.setPointerCapture(event.pointerId);
    target.focus();
    loupeVisible = true;
    inspectPoint(event);
  }

  function moveInspect(event: PointerEvent): void {
    if ((event.currentTarget as HTMLCanvasElement).hasPointerCapture(event.pointerId)) {
      inspectPoint(event);
    }
  }

  function selectPixel(point: PixelPoint): void {
    if (!canvas) return;
    const nextColor = sampleCanvasColor(canvas, point.x, point.y, 0);
    if (!nextColor) return;
    pixel = point;
    color = nextColor;
    pickerX = ((point.x + 0.5) / canvas.width) * 100;
    pickerY = ((point.y + 0.5) / canvas.height) * 100;
    copied = false;
  }

  function movePixel(deltaX: number, deltaY: number): void {
    if (!canvas || mode !== 'frozen') return;
    loupeVisible = true;
    selectPixel(nudgePixel(pixel, deltaX, deltaY, canvas.width, canvas.height));
  }

  function handlePickerKey(event: KeyboardEvent): void {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    movePixel(...delta);
  }

  async function copyHex(): Promise<void> {
    if (!color) return;
    try {
      await navigator.clipboard.writeText(rgbToHex(color));
      copied = true;
      remember(color);
    } catch {
      error = 'Clipboard access is unavailable. Select the value and copy it manually.';
    }
  }

  function remember(nextColor: RgbColor): void {
    const saved = { hex: rgbToHex(nextColor), color: nextColor };
    history = [saved, ...history.filter((item) => item.hex !== saved.hex)].slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function selectSaved(saved: SavedColor): void {
    color = saved.color;
    copied = false;
  }

  function colorDetails(value: RgbColor | null): {
    hex: string;
    rgb: string;
    hsl: string;
    css: string;
  } | null {
    if (!value) return null;
    const hsl = rgbToHsl(value);
    return {
      hex: rgbToHex(value),
      rgb: `${value.red}, ${value.green}, ${value.blue}`,
      hsl: `${hsl.hue}°, ${hsl.saturation}%, ${hsl.lightness}%`,
      css: `rgb(${value.red} ${value.green} ${value.blue})`,
    };
  }

  function cameraError(cause: unknown): string {
    if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
      return 'Camera permission was denied. Enable it in browser settings or choose a photo.';
    }
    return 'The camera could not start. You can still choose a photo to inspect.';
  }

  function isSavedColor(value: unknown): value is SavedColor {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { hex?: unknown; color?: Record<string, unknown> };
    return (
      typeof candidate.hex === 'string' &&
      typeof candidate.color?.red === 'number' &&
      typeof candidate.color.green === 'number' &&
      typeof candidate.color.blue === 'number'
    );
  }

  onMount(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      if (Array.isArray(saved)) history = saved.filter(isSavedColor).slice(0, 8);
    } catch {
      history = [];
    }
  });
  onDestroy(stopCamera);
</script>

<svelte:head>
  <title>Color inspector — e7g.eu</title>
  <meta name="description" content="Pick exact colors from your camera or photos privately." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-3xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Color inspector" subtitle="Camera or photo · processed locally" icon="color" />

  <section class="glass-panel mt-8 overflow-hidden rounded-[2rem]">
    <div class={mode === 'frozen' ? 'relative bg-black' : 'relative aspect-[4/5] min-h-96 bg-black sm:aspect-[4/3]'}>
      <video bind:this={video} class={mode === 'live' || mode === 'starting' ? 'h-full w-full object-cover' : 'hidden'} playsinline muted aria-label="Camera preview"></video>
      <canvas
        bind:this={canvas}
        class={mode === 'frozen' ? 'focus-ring block h-auto w-full cursor-crosshair touch-none' : 'hidden'}
        tabindex={mode === 'frozen' ? 0 : undefined}
        onpointerdown={beginInspect}
        onpointermove={moveInspect}
        onkeydown={handlePickerKey}
        onblur={() => (loupeVisible = false)}
        aria-label="Frozen image color picker. Drag to inspect, or use arrow keys to move one pixel."
      ></canvas>

      {#if mode === 'frozen' && canvas && loupeVisible}
        <PixelLoupe source={canvas} x={pixel.x} y={pixel.y} left={pickerX} top={pickerY} below={pickerY < 30} />
      {/if}

      {#if mode === 'live' || mode === 'frozen'}
        <div class="pointer-events-none absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 border-white shadow-[0_1px_8px_rgb(0_0_0_/_0.8)]" style:left={`${pickerX}%`} style:top={`${pickerY}%`}>
          <div class="absolute inset-1 rounded-full border border-black/50" style:background={details?.css ?? 'transparent'}></div>
        </div>
      {/if}

      {#if mode === 'idle' || mode === 'error'}
        <div class="absolute inset-0 grid place-items-center bg-slate-950/90 p-7 text-center backdrop-blur-sm">
          <div>
            <div class="mx-auto mb-5 h-16 w-16 rounded-2xl border border-white/10 shadow-lg" style:background="linear-gradient(135deg,#fb7185,#fbbf24,#34d399,#38bdf8,#a78bfa)"></div>
            <h2 class="m-0 text-xl font-700">What color is that?</h2>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Sample the center live, then freeze to inspect any exact point.</p>
            {#if error}<p class="mx-auto mt-4 max-w-sm text-sm leading-6 text-amber-200" role="alert">{error}</p>{/if}
            <div class="mt-6 flex flex-wrap justify-center gap-3">
              <button class="focus-ring cursor-pointer rounded-full border-0 bg-rose-300 px-6 py-3 font-700 text-slate-950" onclick={startCamera}>Use camera</button>
              <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-6 py-3 font-650 text-white" onclick={() => fileInput?.click()}>Choose photo</button>
            </div>
          </div>
        </div>
      {:else if mode === 'starting'}
        <div class="absolute inset-0 grid place-items-center bg-slate-950/80 text-sm font-650 text-slate-300">Preparing image…</div>
      {/if}
    </div>

    <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={chooseImage} />

    {#if mode === 'live' && cameras.length > 1}
      <div class="border-t border-white/8 px-4 pt-4 sm:px-5">
        <label class="block text-xs font-650 tracking-wide text-slate-500 uppercase" for="color-camera">Camera</label>
        <select
          id="color-camera"
          class="focus-ring mt-2 w-full rounded-xl border border-white/12 bg-slate-900 px-3 py-2.5 text-sm text-white"
          value={selectedCamera}
          disabled={cameraChanging}
          onchange={chooseCamera}
        >
          {#each cameras as camera, index (camera.id)}
            <option value={camera.id}>{camera.label || `Camera ${index + 1}`}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if details && color}
      <div class="p-4 sm:p-5">
        <div class="flex items-center gap-4">
          <div class="h-16 w-16 shrink-0 rounded-2xl border border-white/15 shadow-lg" style:background={details.css}></div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-650 tracking-wide text-slate-500 uppercase">Selected color</div>
            <div class="mt-1 truncate text-3xl font-700 tracking-tight text-white">{details.hex}</div>
          </div>
          <button class="focus-ring cursor-pointer rounded-full border-0 bg-white px-5 py-2.5 text-sm font-700 text-slate-950" onclick={copyHex}>{copied ? 'Copied' : 'Copy HEX'}</button>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-white/5 p-4"><span class="text-xs text-slate-500">RGB</span><strong class="mt-1 block text-sm font-650 text-slate-200">{details.rgb}</strong></div>
          <div class="rounded-2xl bg-white/5 p-4"><span class="text-xs text-slate-500">HSL</span><strong class="mt-1 block text-sm font-650 text-slate-200">{details.hsl}</strong></div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl p-4 text-center font-700 text-white" style:background={details.css}>White · {whiteContrast.toFixed(1)}:1</div>
          <div class="rounded-2xl p-4 text-center font-700 text-black" style:background={details.css}>Black · {blackContrast.toFixed(1)}:1</div>
        </div>

        {#if mode === 'frozen'}
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
            <div>
              <div class="text-xs font-650 text-slate-300">Fine tune · one pixel</div>
              <div class="mt-0.5 text-xs tabular-nums text-slate-500">x {pixel.x + 1} · y {pixel.y + 1}</div>
            </div>
            <div class="grid grid-cols-3 gap-1" aria-label="Move pipette one pixel">
              <button class="focus-ring col-start-2 h-9 w-9 cursor-pointer rounded-lg border border-white/10 bg-white/8 text-white" onclick={() => movePixel(0, -1)} aria-label="Move up one pixel">↑</button>
              <button class="focus-ring row-start-2 h-9 w-9 cursor-pointer rounded-lg border border-white/10 bg-white/8 text-white" onclick={() => movePixel(-1, 0)} aria-label="Move left one pixel">←</button>
              <button class="focus-ring row-start-2 h-9 w-9 cursor-pointer rounded-lg border border-white/10 bg-white/8 text-white" onclick={() => movePixel(0, 1)} aria-label="Move down one pixel">↓</button>
              <button class="focus-ring row-start-2 h-9 w-9 cursor-pointer rounded-lg border border-white/10 bg-white/8 text-white" onclick={() => movePixel(1, 0)} aria-label="Move right one pixel">→</button>
            </div>
          </div>
        {/if}

        <div class="mt-5 flex flex-wrap justify-center gap-3">
          {#if mode === 'live'}
            <button class="focus-ring cursor-pointer rounded-full border-0 bg-rose-300 px-6 py-3 font-700 text-slate-950" onclick={freeze}>Freeze & inspect</button>
          {:else}
            <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-650 text-white" onclick={startCamera}>Use camera</button>
          {/if}
          <button class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-650 text-white" onclick={() => fileInput?.click()}>Choose photo</button>
        </div>
      </div>
    {/if}
  </section>

  {#if history.length}
    <section class="mt-7" aria-labelledby="recent-colors">
      <h2 id="recent-colors" class="m-0 mb-3 text-xs font-700 tracking-wide text-slate-500 uppercase">Recently copied</h2>
      <div class="flex flex-wrap gap-2">
        {#each history as saved (saved.hex)}
          <button class="focus-ring flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/6 py-1.5 pl-1.5 pr-3 text-xs font-650 text-slate-300" onclick={() => selectSaved(saved)}>
            <span class="h-7 w-7 rounded-full border border-white/15" style:background={`rgb(${saved.color.red} ${saved.color.green} ${saved.color.blue})`}></span>{saved.hex}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <p class="mx-auto mt-5 max-w-xl text-center text-xs leading-5 text-slate-600">Camera lighting and automatic exposure affect real-world readings. Photo pixels are exact; camera colors are a practical visual estimate.</p>
</main>
