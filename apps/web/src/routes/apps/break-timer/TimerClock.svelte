<script lang="ts">
  import type { TimerCopy } from './content';
  import { remainingMs, type TimerSession } from './timer';

  let {
    session,
    now,
    text,
    onPause,
    onResume,
    onBreak,
    onEnd,
  }: {
    session: TimerSession;
    now: number;
    text: TimerCopy;
    onPause: () => void;
    onResume: () => void;
    onBreak: () => void;
    onEnd: () => void;
  } = $props();

  const remaining = $derived(remainingMs(session, now));
  const progress = $derived(Math.min(100, (remaining / session.config.workMs) * 100));
  const dueAt = $derived(
    session.phase === 'paused' ? now + session.remainingMs : session.deadline,
  );

  function clock(value: number): string {
    const totalSeconds = Math.ceil(value / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
</script>

<section class="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/58 p-5 shadow-[0_28px_90px_rgb(0_0_0_/_0.35)] backdrop-blur-xl sm:p-8">
  <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"></div>
  <div class="relative grid items-center gap-8 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)] lg:gap-12">
    <div class="mx-auto w-full max-w-md">
      <div
        class="mx-auto grid aspect-square w-full max-w-[24rem] place-items-center rounded-full p-[7px] shadow-[0_24px_70px_rgb(0_0_0_/_0.35)]"
        style:background={`conic-gradient(#67e8f9 ${progress}%, rgb(255 255 255 / .065) 0)`}
      >
        <div class="grid h-full w-full place-items-center rounded-full border border-white/8 bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238_/_0.09),transparent_58%),#07111f] text-center shadow-[inset_0_0_80px_rgb(0_0_0_/_0.35)]">
          <div>
            <div class="text-[0.67rem] font-750 tracking-[0.2em] text-slate-500 uppercase">{session.phase === 'paused' ? text.paused : text.nextBreak}</div>
            <div class="mt-3 text-[clamp(4.5rem,20vw,7.5rem)] font-260 leading-none tabular-nums tracking-[-0.075em] text-white">{clock(remaining)}</div>
            <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">
              <span class={`h-1.5 w-1.5 rounded-full ${session.phase === 'paused' ? 'bg-amber-300' : 'bg-emerald-300 shadow-[0_0_9px_#6ee7b7]'}`}></span>
              {session.phase === 'paused' ? text.paused : `${text.dueAt} ${new Date(dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.045] px-3 py-1.5 text-xs font-650 text-slate-400"><span aria-hidden="true">◎</span>{session.config.label}</div>
      <h2 class="mb-0 mt-5 text-3xl font-760 tracking-[-0.035em] text-white sm:text-4xl">{text.focusTime}</h2>
      <p class="mb-0 mt-3 max-w-lg text-sm leading-6 text-slate-500"><span class="mr-1 font-700 text-slate-400">{text.atBreak}:</span>{session.config.instruction}</p>

      <div class="mt-7 grid grid-cols-3 gap-2.5">
        <div class="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-center"><strong class="block text-2xl font-750 tabular-nums text-white">{session.reminders}</strong><span class="text-[0.65rem] text-slate-600">{text.reminders}</span></div>
        <div class="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-center"><strong class="block text-2xl font-750 tabular-nums text-white">{session.breaksFinished}</strong><span class="text-[0.65rem] text-slate-600">{text.finished}</span></div>
        <div class="rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-center"><strong class="block text-2xl font-750 tabular-nums text-white">{session.breaksSkipped}</strong><span class="text-[0.65rem] text-slate-600">{text.skipped}</span></div>
      </div>

      <div class="mt-7 grid gap-2.5 sm:grid-cols-2">
        <button class="focus-ring cursor-pointer rounded-2xl border-0 bg-cyan-300 px-5 py-4 font-760 text-slate-950 shadow-[0_14px_36px_rgb(34_211_238_/_0.16)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-35" disabled={session.phase === 'paused'} onclick={onBreak}>{text.takeBreak}</button>
        <button class="focus-ring cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 font-700 text-white transition hover:bg-white/[0.1]" onclick={session.phase === 'paused' ? onResume : onPause}>{session.phase === 'paused' ? text.resume : text.pause}</button>
      </div>
      <button class="focus-ring mt-3 w-full cursor-pointer border-0 bg-transparent py-2 text-sm font-650 text-slate-600 transition hover:text-rose-300" onclick={onEnd}>{text.endSession}</button>

      <div class="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-300/8 bg-amber-300/[0.035] p-3 text-[0.68rem] leading-5 text-slate-600">
        <svg class="mt-0.5 shrink-0 text-amber-300/65" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5m0-8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>{text.leaveOpen}
      </div>
    </div>
  </div>
</section>
