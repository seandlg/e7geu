<script lang="ts">
  import { onDestroy } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    defaultOutputDimensions,
    cropRectangle,
    fitWithin,
    formatBytes,
    outputFilename,
    preferredFormat,
    sizeDifference,
    validateDimensions,
    type OutputFormat,
  } from './image';
  import { loadImage, processImage, type LoadedImage } from './processor';

  let fileInput = $state<HTMLInputElement>();
  let sourceFile = $state<File | null>(null);
  let sourceImage = $state<LoadedImage | null>(null);
  let sourceUrl = $state('');
  let outputUrl = $state('');
  let outputBytes = $state(0);
  let width = $state(1);
  let height = $state(1);
  let format: OutputFormat = $state('image/jpeg');
  let quality = $state(0.82);
  let aspectLocked = $state(true);
  let cropRatio: number | null = $state(null);
  let cropX = $state(0.5);
  let cropY = $state(0.5);
  let loading = $state(false);
  let processing = $state(false);
  let dragging = $state(false);
  let error = $state('');
  let loadSequence = 0;

  const formatOptions: readonly { value: OutputFormat; label: string }[] = [
    { value: 'image/jpeg', label: 'JPEG' },
    { value: 'image/png', label: 'PNG' },
    { value: 'image/webp', label: 'WebP' },
  ];
  const cropOptions: readonly { value: number | null; label: string }[] = [
    { value: null, label: 'Original' },
    { value: 1, label: '1:1' },
    { value: 4 / 3, label: '4:3' },
    { value: 3 / 4, label: '3:4' },
    { value: 16 / 9, label: '16:9' },
    { value: 9 / 16, label: '9:16' },
  ];

  const dimensionError = $derived(validateDimensions({ width, height }));
  const filename = $derived(sourceFile ? outputFilename(sourceFile.name, format) : '');
  const difference = $derived(
    sourceFile && outputBytes ? sizeDifference(sourceFile.size, outputBytes) : '',
  );

  $effect(() => {
    const image = sourceImage;
    const outputWidth = width;
    const outputHeight = height;
    const outputFormat = format;
    const outputQuality = quality;
    const selectedCropRatio = cropRatio;
    const horizontalCrop = cropX;
    const verticalCrop = cropY;
    if (!image || validateDimensions({ width: outputWidth, height: outputHeight })) return;

    let cancelled = false;
    processing = true;
    error = '';
    const timer = window.setTimeout(() => {
      void processImage(
        image.bitmap,
        cropRectangle(image, selectedCropRatio, horizontalCrop, verticalCrop),
        { width: outputWidth, height: outputHeight },
        outputFormat,
        outputQuality,
      )
        .then((blob) => {
          if (cancelled) return;
          replaceOutput(URL.createObjectURL(blob), blob.size);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          clearOutput();
          error = cause instanceof Error ? cause.message : 'The image could not be processed.';
        })
        .finally(() => {
          if (!cancelled) processing = false;
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  });

  async function chooseFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const sequence = ++loadSequence;
    loading = true;
    processing = false;
    error = '';
    clearImage();
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(file);
      if (sequence !== loadSequence) {
        image.bitmap.close();
        return;
      }
      sourceImage = image;
      const initial = defaultOutputDimensions(image);
      width = initial.width;
      height = initial.height;
      format = preferredFormat(file.type);
      cropRatio = null;
      cropX = 0.5;
      cropY = 0.5;
    } catch (cause) {
      if (sequence !== loadSequence) return;
      error = cause instanceof Error ? cause.message : 'The image could not be opened.';
      clearImage();
    } finally {
      if (sequence === loadSequence) loading = false;
    }
  }

  function handleFileInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    void chooseFile(file);
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    void chooseFile(event.dataTransfer?.files[0]);
  }

  function updateWidth(event: Event): void {
    width = Number((event.currentTarget as HTMLInputElement).value);
    if (aspectLocked && sourceImage && Number.isFinite(width)) {
      height = Math.max(1, Math.round(width / outputRatio()));
    }
  }

  function updateHeight(event: Event): void {
    height = Number((event.currentTarget as HTMLInputElement).value);
    if (aspectLocked && sourceImage && Number.isFinite(height)) {
      width = Math.max(1, Math.round(height * outputRatio()));
    }
  }

  function applyMaximum(maximum: number): void {
    if (!sourceImage) return;
    const next = fitWithin(cropRectangle(sourceImage, cropRatio), maximum, maximum);
    width = next.width;
    height = next.height;
  }

  function resetDimensions(): void {
    if (!sourceImage) return;
    const crop = cropRectangle(sourceImage, cropRatio);
    width = crop.width;
    height = crop.height;
  }

  function selectCrop(ratio: number | null): void {
    if (!sourceImage) return;
    const previousLongestSide = Math.max(width, height);
    cropRatio = ratio;
    cropX = 0.5;
    cropY = 0.5;
    const crop = cropRectangle(sourceImage, ratio);
    const next = fitWithin(crop, previousLongestSide, previousLongestSide);
    width = next.width;
    height = next.height;
  }

  function outputRatio(): number {
    if (cropRatio) return cropRatio;
    if (sourceImage) return sourceImage.width / sourceImage.height;
    return width / height;
  }

  function replaceOutput(url: string, bytes: number): void {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = url;
    outputBytes = bytes;
  }

  function clearOutput(): void {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    outputBytes = 0;
  }

  function clearImage(): void {
    sourceImage?.bitmap.close();
    sourceImage = null;
    sourceFile = null;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = '';
    clearOutput();
  }

  onDestroy(() => {
    loadSequence += 1;
    clearImage();
  });
</script>

<svelte:head>
  <title>Image Compressor — e7g.eu</title>
  <meta
    name="description"
    content="Resize, compress, and convert images privately in your browser."
  />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader title="Image Compressor" subtitle="Resize · compress · convert locally" icon="image" />

  {#if !sourceImage}
    <section class="mt-8">
      <button
        type="button"
        class={`focus-ring grid min-h-96 w-full cursor-pointer place-items-center rounded-[2rem] border-2 border-dashed bg-white/[0.025] p-8 text-center transition hover:border-purple-300/35 hover:bg-purple-300/[0.04] ${dragging ? 'border-purple-300 bg-purple-300/8' : 'border-white/12'}`}
        onclick={() => fileInput?.click()}
        ondragenter={(event) => {
          event.preventDefault();
          dragging = true;
        }}
        ondragover={(event) => event.preventDefault()}
        ondragleave={(event) => {
          if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
            dragging = false;
          }
        }}
        ondrop={handleDrop}
      >
        <div>
          <div class="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-purple-300/12 text-purple-200">
            <svg width="43" height="43" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="6" y="8" width="36" height="32" rx="7" stroke="currentColor" stroke-width="3"/>
              <circle cx="17" cy="18" r="4" fill="currentColor"/>
              <path d="m10 35 9-9 6 6 5-5 8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="mb-0 mt-6 text-2xl font-700 tracking-tight text-white">
            {loading ? 'Opening image…' : 'Choose an image'}
          </h2>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Drop one here or browse your device. JPEG, PNG, WebP, and other formats supported by your browser work best.
          </p>
          <span class="mt-6 inline-flex rounded-full bg-purple-300 px-6 py-3 text-sm font-750 text-slate-950">
            Browse images
          </span>
          <p class="mb-0 mt-5 text-xs text-slate-600">Your image never leaves this device.</p>
        </div>
      </button>
      {#if error}<p class="mt-4 text-center text-sm text-rose-300" role="alert">{error}</p>{/if}
    </section>
  {:else if sourceFile}
    <div class="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section class="glass-panel overflow-hidden rounded-[2rem]" aria-label="Image preview">
        <div class="relative grid min-h-80 place-items-center overflow-hidden bg-[linear-gradient(45deg,#111827_25%,transparent_25%),linear-gradient(-45deg,#111827_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#111827_75%),linear-gradient(-45deg,transparent_75%,#111827_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-4 sm:min-h-[32rem]">
          <img
            class="block max-h-[70dvh] max-w-full object-contain shadow-2xl"
            src={outputUrl || sourceUrl}
            alt="Preview of {sourceFile.name}"
          />
          {#if processing}
            <div class="absolute inset-0 grid place-items-center bg-slate-950/45 backdrop-blur-[2px]">
              <span class="rounded-full bg-slate-950/85 px-4 py-2 text-xs font-650 text-slate-200">Updating preview…</span>
            </div>
          {/if}
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 p-4 sm:px-5">
          <div class="min-w-0">
            <p class="m-0 max-w-sm truncate text-sm font-650 text-slate-200">{sourceFile.name}</p>
            <p class="m-0 mt-1 text-xs tabular-nums text-slate-500">
              Original · {sourceImage.width} × {sourceImage.height} · {formatBytes(sourceFile.size)}
            </p>
          </div>
          <button
            class="focus-ring cursor-pointer rounded-full border border-white/12 bg-white/7 px-4 py-2 text-xs font-700 text-slate-300 hover:bg-white/12"
            type="button"
            onclick={() => fileInput?.click()}
          >Choose another</button>
        </div>
      </section>

      <aside class="glass-panel rounded-[2rem] p-5 sm:p-6" aria-label="Output settings">
        <h2 class="m-0 text-lg font-700 text-white">Output settings</h2>

        <fieldset class="m-0 mt-6 border-0 p-0">
          <legend class="text-xs font-700 tracking-wide text-slate-500 uppercase">Crop</legend>
          <div class="mt-2 grid grid-cols-3 gap-2">
            {#each cropOptions as option}
              <button class={`focus-ring cursor-pointer rounded-lg border px-2 py-2 text-xs font-700 ${cropRatio === option.value ? 'border-purple-300 bg-purple-300/12 text-purple-100' : 'border-white/10 bg-transparent text-slate-400'}`} type="button" aria-pressed={cropRatio === option.value} onclick={() => selectCrop(option.value)}>{option.label}</button>
            {/each}
          </div>
          {#if cropRatio && sourceImage.width / sourceImage.height > cropRatio}
            <label class="mt-3 block text-xs text-slate-500">Horizontal position
              <input class="mt-2 w-full cursor-pointer accent-purple-300" type="range" min="0" max="1" step="0.01" bind:value={cropX} />
            </label>
          {:else if cropRatio && sourceImage.width / sourceImage.height < cropRatio}
            <label class="mt-3 block text-xs text-slate-500">Vertical position
              <input class="mt-2 w-full cursor-pointer accent-purple-300" type="range" min="0" max="1" step="0.01" bind:value={cropY} />
            </label>
          {/if}
        </fieldset>

        <fieldset class="m-0 mt-6 border-0 p-0">
          <legend class="text-xs font-700 tracking-wide text-slate-500 uppercase">Format</legend>
          <div class="mt-2 grid grid-cols-3 gap-2">
            {#each formatOptions as option}
              <label class={`focus-within:ring-purple-300/40 cursor-pointer rounded-xl border px-2 py-2.5 text-center text-xs font-700 transition focus-within:ring-2 ${format === option.value ? 'border-purple-300 bg-purple-300/12 text-purple-100' : 'border-white/10 text-slate-400'}`}>
                <input class="sr-only" type="radio" name="format" value={option.value} bind:group={format} />{option.label}
              </label>
            {/each}
          </div>
        </fieldset>

        <fieldset class="m-0 mt-6 border-0 p-0" aria-labelledby="image-dimensions-label">
          <div class="flex items-center justify-between gap-3">
            <span id="image-dimensions-label" class="text-xs font-700 tracking-wide text-slate-500 uppercase">Dimensions</span>
            <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input class="accent-purple-300" type="checkbox" bind:checked={aspectLocked} /> Lock ratio
            </label>
          </div>
          <div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label class="text-xs text-slate-500">Width
              <input class="focus-ring mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm tabular-nums text-white" type="number" min="1" max="16384" value={width} oninput={updateWidth} />
            </label>
            <span class="pb-2.5 text-sm text-slate-600" aria-hidden="true">×</span>
            <label class="text-xs text-slate-500">Height
              <input class="focus-ring mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm tabular-nums text-white" type="number" min="1" max="16384" value={height} oninput={updateHeight} />
            </label>
          </div>
          <div class="mt-2 flex gap-2">
            <button class="focus-ring flex-1 cursor-pointer rounded-lg border border-white/8 bg-white/5 px-2 py-2 text-[0.68rem] font-650 text-slate-400 hover:bg-white/9" type="button" onclick={() => applyMaximum(1280)}>1280 px</button>
            <button class="focus-ring flex-1 cursor-pointer rounded-lg border border-white/8 bg-white/5 px-2 py-2 text-[0.68rem] font-650 text-slate-400 hover:bg-white/9" type="button" onclick={() => applyMaximum(2048)}>2048 px</button>
            <button class="focus-ring flex-1 cursor-pointer rounded-lg border border-white/8 bg-white/5 px-2 py-2 text-[0.68rem] font-650 text-slate-400 hover:bg-white/9" type="button" onclick={resetDimensions}>Original</button>
          </div>
          {#if dimensionError}<p class="mb-0 mt-2 text-xs leading-5 text-rose-300" role="alert">{dimensionError}</p>{/if}
        </fieldset>

        {#if format !== 'image/png'}
          <label class="mt-6 block">
            <span class="flex items-center justify-between text-xs font-700 tracking-wide text-slate-500 uppercase"><span>Quality</span><strong class="text-purple-200">{Math.round(quality * 100)}%</strong></span>
            <input class="mt-3 w-full cursor-pointer accent-purple-300" type="range" min="0.1" max="1" step="0.01" bind:value={quality} aria-label="Output quality" />
            <span class="mt-1 flex justify-between text-[0.65rem] text-slate-600"><span>Smaller</span><span>Sharper</span></span>
          </label>
        {:else}
          <div class="mt-6 rounded-xl bg-white/5 px-3 py-3 text-xs leading-5 text-slate-400">PNG uses lossless compression, so quality does not apply.</div>
        {/if}

        {#if format === 'image/jpeg'}
          <p class="mb-0 mt-4 text-xs leading-5 text-slate-500">Transparent areas become white in JPEG.</p>
        {/if}

        <div class="mt-6 border-t border-white/8 pt-5">
          {#if outputUrl && !dimensionError}
            <div class="mb-4 flex items-end justify-between gap-3">
              <div><span class="block text-xs text-slate-500">New file size</span><strong class="mt-1 block text-xl font-750 tabular-nums text-white">{formatBytes(outputBytes)}</strong></div>
              <span class:text-emerald-300={outputBytes <= sourceFile.size} class:text-amber-300={outputBytes > sourceFile.size} class="pb-1 text-xs font-700">{difference}</span>
            </div>
            <a class="focus-ring block rounded-full bg-purple-300 px-5 py-3.5 text-center text-sm font-750 text-slate-950 no-underline hover:bg-purple-200" href={outputUrl} download={filename}>Download {filename}</a>
          {:else}
            <button class="w-full cursor-not-allowed rounded-full bg-white/8 px-5 py-3.5 text-sm font-700 text-slate-500" type="button" disabled>{processing ? 'Preparing image…' : 'Download unavailable'}</button>
          {/if}
          {#if error}<p class="mb-0 mt-3 text-xs leading-5 text-rose-300" role="alert">{error}</p>{/if}
          <p class="mb-0 mt-4 text-center text-[0.68rem] leading-5 text-slate-600">Re-encoding removes embedded metadata. Processing stays on this device.</p>
        </div>
      </aside>
    </div>
  {/if}

  <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={handleFileInput} />
</main>
