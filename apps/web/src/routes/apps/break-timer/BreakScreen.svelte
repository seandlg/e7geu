<script lang="ts">
  import type { TimerCopy } from './content';
  import { remainingMs, type RunningSession } from './timer';

  let {
    session,
    now,
    text,
    onSkip,
  }: { session: RunningSession; now: number; text: TimerCopy; onSkip: () => void } = $props();

  const remaining = $derived(Math.ceil(remainingMs(session, now) / 1000));
  const progress = $derived(Math.min(100, (remainingMs(session, now) / session.config.breakMs) * 100));
  const isEyeBreak = $derived(session.config.id === 'eye-break' || session.config.id === 'frequent');
</script>

<section class="relative mt-8 min-h-[min(42rem,calc(100dvh_-_8rem))] overflow-hidden rounded-[2rem] border border-cyan-200/12 bg-[#06141c] shadow-[0_30px_100px_rgb(0_0_0_/_0.45)]">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgb(45_212_191_/_0.22),transparent_34%),linear-gradient(180deg,#071725_0%,#092333_58%,#0a2f37_100%)]"></div>
  <div class="pointer-events-none absolute inset-x-0 bottom-[22%] h-px bg-cyan-100/20 shadow-[0_0_40px_8px_rgb(103_232_249_/_0.12)]"></div>
  <div class="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[130%] -translate-x-1/2 rounded-[50%] border border-cyan-100/12 bg-slate-950/35"></div>

  <div class="relative flex min-h-[min(42rem,calc(100dvh_-_8rem))] flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
    <p class="sr-only" aria-live="assertive">{text.breakEyebrow}. {isEyeBreak ? text.lookAway : session.config.label}</p>
    <div class="text-[0.68rem] font-750 tracking-[0.22em] text-cyan-200/70 uppercase">{text.breakEyebrow}</div>
    <h2 class="mb-0 mt-4 text-3xl font-760 tracking-[-0.035em] text-white sm:text-5xl">{isEyeBreak ? text.lookAway : session.config.label}</h2>
    <p class="mb-0 mt-3 max-w-lg text-sm leading-6 text-cyan-50/45 sm:text-base">{session.config.instruction}</p>

    <div class="my-8 grid h-48 w-48 place-items-center rounded-full p-[5px] shadow-[0_20px_70px_rgb(34_211_238_/_0.16)] sm:h-56 sm:w-56" style:background={`conic-gradient(#5eead4 ${progress}%, rgb(255 255 255 / .08) 0)`}>
      <div class="grid h-full w-full place-items-center rounded-full border border-white/8 bg-slate-950/68 backdrop-blur"><div><strong class="block text-7xl font-250 tabular-nums tracking-[-0.07em] text-white sm:text-8xl">{remaining}</strong><span class="mt-1 block text-[0.65rem] font-700 tracking-[0.16em] text-slate-500 uppercase">{text.seconds}</span></div></div>
    </div>

    <p class="m-0 max-w-md text-xs leading-5 text-cyan-50/40">{isEyeBreak ? text.breakHint : text.resetHint}</p>
    <div class="mt-8 flex flex-col items-center gap-2">
      <div class="text-[0.65rem] text-slate-600">{text.backSoon}</div>
      <button class="focus-ring cursor-pointer border-0 bg-transparent px-4 py-2 text-sm font-650 text-slate-500 transition hover:text-white" onclick={onSkip}>{text.skip}</button>
    </div>
  </div>
</section>
