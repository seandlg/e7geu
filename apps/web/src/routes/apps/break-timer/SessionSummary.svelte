<script lang="ts">
  import type { TimerCopy } from './content';
  import type { SessionSummary } from './timer';

  let { summary, text, onAgain }: { summary: SessionSummary; text: TimerCopy; onAgain: () => void } =
    $props();

  function duration(milliseconds: number): string {
    const minutes = Math.max(1, Math.round(milliseconds / 60_000));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours}h ${remainder}m` : `${minutes}m`;
  }
</script>

<section class="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/58 px-5 py-10 text-center shadow-[0_28px_90px_rgb(0_0_0_/_0.35)] backdrop-blur-xl sm:px-10 sm:py-14">
  <div class="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl"></div>
  <div class="relative">
    <div class="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-emerald-200/15 bg-emerald-300/10 text-3xl text-emerald-200 shadow-[0_12px_40px_rgb(52_211_153_/_0.1)]">✓</div>
    <h2 class="mb-0 mt-6 text-3xl font-760 tracking-[-0.035em] text-white sm:text-4xl">{text.complete}</h2>
    <p class="mx-auto mb-0 mt-3 max-w-lg text-sm leading-6 text-slate-500">{text.completeHint}</p>

    <div class="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4">
      <div class="rounded-2xl border border-white/8 bg-white/[0.04] p-4"><strong class="block text-2xl font-750 tabular-nums text-white">{duration(summary.elapsedMs)}</strong><span class="mt-1 block text-[0.68rem] text-slate-600">{text.elapsed}</span></div>
      <div class="rounded-2xl border border-white/8 bg-white/[0.04] p-4"><strong class="block text-2xl font-750 tabular-nums text-white">{summary.reminders}</strong><span class="mt-1 block text-[0.68rem] text-slate-600">{text.reminders}</span></div>
      <div class="rounded-2xl border border-white/8 bg-white/[0.04] p-4"><strong class="block text-2xl font-750 tabular-nums text-white">{summary.breaksFinished}</strong><span class="mt-1 block text-[0.68rem] text-slate-600">{text.finished}</span></div>
      <div class="rounded-2xl border border-white/8 bg-white/[0.04] p-4"><strong class="block text-2xl font-750 tabular-nums text-white">{summary.breaksSkipped}</strong><span class="mt-1 block text-[0.68rem] text-slate-600">{text.skipped}</span></div>
    </div>

    <button class="focus-ring mt-8 cursor-pointer rounded-2xl border-0 bg-cyan-300 px-7 py-4 font-760 text-slate-950 shadow-[0_14px_36px_rgb(34_211_238_/_0.16)] transition hover:bg-cyan-200" onclick={onAgain}>{text.again}</button>
  </div>
</section>
