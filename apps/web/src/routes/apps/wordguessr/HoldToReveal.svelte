<script lang="ts">
  import { onDestroy } from 'svelte';

  let { label, hint, onReveal }: { label: string; hint: string; onReveal: () => void } = $props();
  const duration = 500;
  let pressing = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function begin(): void {
    if (pressing) return;
    pressing = true;
    timer = setTimeout(() => {
      pressing = false;
      timer = null;
      onReveal();
    }, duration);
  }

  function cancel(): void {
    pressing = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function pointerDown(event: PointerEvent): void {
    event.preventDefault();
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    begin();
  }

  function keyDown(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    begin();
  }

  function keyUp(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') cancel();
  }

  onDestroy(cancel);
</script>

<div>
  <button
    class="focus-ring relative w-full touch-none select-none overflow-hidden rounded-2xl border border-emerald-200/20 bg-emerald-300 px-5 py-4 font-750 text-slate-950 shadow-[0_14px_36px_rgb(52_211_153_/_0.2)] transition hover:bg-emerald-200"
    class:scale-[0.985]={pressing}
    style="-webkit-touch-callout:none"
    onpointerdown={pointerDown}
    onpointerup={cancel}
    onpointercancel={cancel}
    onpointerleave={cancel}
    onkeydown={keyDown}
    onkeyup={keyUp}
    oncontextmenu={(event) => event.preventDefault()}
    aria-describedby="hold-reveal-hint"
  >
    <span
      class="absolute inset-y-0 left-0 bg-emerald-600/30"
      style:width={pressing ? '100%' : '0%'}
      style:transition={pressing ? `width ${duration}ms linear` : 'none'}
      aria-hidden="true"
    ></span>
    <span class="relative flex items-center justify-center gap-2">{label}<span class="text-lg" aria-hidden="true">◉</span></span>
  </button>
  <p id="hold-reveal-hint" class="mb-0 mt-2 text-center text-xs leading-5 text-slate-600">{hint}</p>
</div>
