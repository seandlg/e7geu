<script lang="ts">
  import { onDestroy } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import { modelSizeLabel, outputFilename, validateImageFile } from './image.ts';
  import { createBackgroundRemover, type BackgroundRemover } from './remover.ts';

  let fileInput = $state<HTMLInputElement>();
  let sourceFile = $state<File | null>(null);
  let sourceUrl = $state('');
  let outputUrl = $state('');
  let remover: BackgroundRemover | null = null;
  let modelState: 'disabled' | 'downloading' | 'ready' = $state('disabled');
  let modelProgress = $state(0);
  let processing = $state(false);
  let dragging = $state(false);
  let error = $state('');

  const modelDownloadSize = modelSizeLabel();
  const resultName = $derived(sourceFile ? outputFilename(sourceFile.name) : 'background-removed.png');

  function chooseFile(file: File | undefined): void {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      error = validationError;
      return;
    }

    clearImage();
    error = '';
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
  }

  function handleFileInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    chooseFile(input.files?.[0]);
    input.value = '';
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    dragging = false;
    chooseFile(event.dataTransfer?.files[0]);
  }

  async function downloadModel(): Promise<void> {
    if (modelState !== 'disabled') return;
    error = '';
    modelProgress = 0;
    modelState = 'downloading';
    remover ??= createBackgroundRemover();

    try {
      await remover.prepare(({ loaded, total }) => {
        modelProgress = total > 0 ? Math.min(1, loaded / total) : 0;
      });
      modelProgress = 1;
      modelState = 'ready';
    } catch (cause) {
      remover.dispose();
      remover = null;
      modelState = 'disabled';
      error = describeError(cause, 'The AI model could not be loaded.');
    }
  }

  async function removeBackground(): Promise<void> {
    if (!sourceFile || !remover || modelState !== 'ready' || processing) return;
    processing = true;
    error = '';
    clearOutput();
    try {
      const result = await remover.remove(sourceFile);
      outputUrl = URL.createObjectURL(result);
    } catch (cause) {
      error = describeError(cause, 'The background could not be removed.');
    } finally {
      processing = false;
    }
  }

  function clearOutput(): void {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
  }

  function clearImage(): void {
    clearOutput();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = '';
    sourceFile = null;
  }

  function describeError(cause: unknown, fallback: string): string {
    return cause instanceof Error && cause.message ? cause.message : fallback;
  }

  onDestroy(() => {
    clearImage();
    remover?.dispose();
  });
</script>

<svelte:head>
  <title>Background Remover — e7g.eu</title>
  <meta
    name="description"
    content="Remove image backgrounds privately with optional AI that runs in your browser."
  />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
  <AppHeader
    title="Background Remover"
    subtitle="Optional AI · entirely on your device"
    icon="cutout"
  />

  {#if !sourceFile}
    <section class="mt-8">
      <button
        type="button"
        class={`focus-ring grid min-h-96 w-full cursor-pointer place-items-center rounded-[2rem] border-2 border-dashed bg-white/[0.025] p-8 text-center transition hover:border-green-300/35 hover:bg-green-300/[0.04] ${dragging ? 'border-green-300 bg-green-300/8' : 'border-white/12'}`}
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
          <div class="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-green-300/12 text-green-200">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M8 13h9M8 13v9M40 13h-9M40 13v9M8 35h9M8 35v-9M40 35h-9M40 35v-9" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M27 14c-6 0-10 4.5-10 10.2 0 2.7 1.2 5.1 3.1 6.8L18 36h12l-2.1-5a9.3 9.3 0 0 0 3.1-6.8C31 18.5 30 14 27 14Z" fill="currentColor" opacity=".8"/>
            </svg>
          </div>
          <h2 class="mb-0 mt-6 text-2xl font-700 tracking-tight text-white">Choose an image</h2>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Drop one here or browse your device. Nothing is uploaded and no AI is downloaded yet.
          </p>
          <span class="mt-6 inline-flex rounded-full bg-green-300 px-6 py-3 text-sm font-750 text-slate-950">
            Browse images
          </span>
        </div>
      </button>
    </section>
  {:else}
    <section class="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
        <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div class="min-w-0">
            <p class="m-0 text-xs font-750 uppercase tracking-[0.16em] text-green-300">Original</p>
            <p class="m-0 mt-1 truncate text-sm text-slate-400">{sourceFile.name}</p>
          </div>
          <button type="button" class="focus-ring rounded-full border border-white/12 px-4 py-2 text-sm font-700 text-slate-200 hover:bg-white/6" onclick={() => fileInput?.click()}>
            Replace
          </button>
        </div>
        <div class="grid min-h-80 place-items-center p-5 sm:min-h-[32rem]">
          <img src={sourceUrl} alt="Selected original" class="max-h-[38rem] max-w-full rounded-xl object-contain" />
        </div>
      </div>

      <aside class="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        {#if modelState === 'disabled'}
          <p class="m-0 text-xs font-750 uppercase tracking-[0.16em] text-green-300">Your choice</p>
          <h2 class="mb-0 mt-3 text-xl font-750 text-white">Enable local AI?</h2>
          <p class="mb-0 mt-3 text-sm leading-6 text-slate-400">
            The model stays on this device and your image never leaves the browser.
          </p>
          <button type="button" class="focus-ring mt-6 w-full rounded-full bg-green-300 px-5 py-3.5 text-sm font-800 text-slate-950 hover:bg-green-200" onclick={downloadModel}>
            Download {modelDownloadSize} AI model
          </button>
          <p class="mb-0 mt-3 text-xs leading-5 text-slate-500">
            A local runtime is also loaded once and cached: about 23 MiB in most browsers, or 13 MiB in Safari.
          </p>
        {:else if modelState === 'downloading'}
          <p class="m-0 text-xs font-750 uppercase tracking-[0.16em] text-green-300">Preparing AI</p>
          <h2 class="mb-0 mt-3 text-xl font-750 text-white">Downloading locally…</h2>
          <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/8" aria-label="Model download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(modelProgress * 100)} role="progressbar">
            <div class="h-full rounded-full bg-green-300 transition-[width]" style={`width: ${Math.round(modelProgress * 100)}%`}></div>
          </div>
          <p class="mb-0 mt-3 text-sm tabular-nums text-slate-400">{Math.round(modelProgress * 100)}%</p>
        {:else}
          <p class="m-0 text-xs font-750 uppercase tracking-[0.16em] text-green-300">AI ready</p>
          <h2 class="mb-0 mt-3 text-xl font-750 text-white">Remove the background</h2>
          <p class="mb-0 mt-3 text-sm leading-6 text-slate-400">
            Best for images with one clear foreground subject. Fine hair and transparent edges may need care.
          </p>
          <button type="button" class="focus-ring mt-6 w-full rounded-full bg-green-300 px-5 py-3.5 text-sm font-800 text-slate-950 enabled:hover:bg-green-200 disabled:cursor-wait disabled:opacity-60" disabled={processing} onclick={removeBackground}>
            {processing ? 'Removing background…' : 'Remove background'}
          </button>
        {/if}

        {#if error}
          <p class="mt-5 rounded-2xl border border-red-300/20 bg-red-300/8 p-4 text-sm leading-6 text-red-200" role="alert">{error}</p>
        {/if}
      </aside>
    </section>

    {#if outputUrl}
      <section class="mt-6 overflow-hidden rounded-[2rem] border border-green-300/20 bg-white/[0.035]">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6">
          <div>
            <p class="m-0 text-xs font-750 uppercase tracking-[0.16em] text-green-300">Result</p>
            <h2 class="mb-0 mt-1 text-xl font-750 text-white">Transparent PNG</h2>
          </div>
          <a class="focus-ring rounded-full bg-green-300 px-5 py-3 text-sm font-800 text-slate-950 hover:bg-green-200" href={outputUrl} download={resultName}>
            Download PNG
          </a>
        </div>
        <div class="checkerboard grid min-h-80 place-items-center p-5 sm:min-h-[34rem] sm:p-8">
          <img src={outputUrl} alt="Background removed preview" class="max-h-[40rem] max-w-full object-contain" />
        </div>
      </section>
    {/if}
  {/if}

  <input bind:this={fileInput} class="sr-only" type="file" accept="image/*" onchange={handleFileInput} />
</main>

<style>
  .checkerboard {
    background-color: #111827;
    background-image:
      linear-gradient(45deg, rgb(255 255 255 / 0.07) 25%, transparent 25%),
      linear-gradient(-45deg, rgb(255 255 255 / 0.07) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgb(255 255 255 / 0.07) 75%),
      linear-gradient(-45deg, transparent 75%, rgb(255 255 255 / 0.07) 75%);
    background-position:
      0 0,
      0 12px,
      12px -12px,
      -12px 0;
    background-size: 24px 24px;
  }
</style>
