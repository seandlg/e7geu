<script lang="ts">
  import type { GameCopy } from './content';
  import { currentCategory, finishPosition, timeRemaining, type Game } from './game';
  import HoldToReveal from './HoldToReveal.svelte';
  import { teamTheme } from './theme';

  let {
    game,
    now,
    text,
    onPrepare,
    onReveal,
    onAccept,
    onSkip,
  }: {
    game: Game;
    now: number;
    text: GameCopy;
    onPrepare: () => void;
    onReveal: () => void;
    onAccept: () => void;
    onSkip: () => void;
  } = $props();

  const currentTeam = $derived(game.teams[game.currentTeamIndex]!);
  const theme = $derived(teamTheme(currentTeam.palette));
  const remaining = $derived(timeRemaining(game, now));
  const timerProgress = $derived(
    game.phase === 'active' ? (remaining / game.round.seconds) * 100 : 100,
  );
  const category = $derived(currentCategory(game));
</script>

<aside class="flex min-h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/58 shadow-[0_24px_70px_rgb(0_0_0_/_0.3)] backdrop-blur-xl">
  <div class="relative overflow-hidden border-b border-white/8 px-5 py-5 sm:px-6">
    <div class="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-20 blur-3xl" style:background={theme.accent}></div>
    <div class="relative flex items-center gap-3">
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl shadow-lg" style:background={`linear-gradient(145deg,${theme.accent},${theme.deep})`} style:border-color={`${theme.accent}aa`} style:box-shadow={`0 8px 24px ${theme.glow}`}>{currentTeam.emoji}</span>
      <div class="min-w-0">
        <div class="text-[0.65rem] font-750 tracking-[0.16em] text-slate-500 uppercase">{game.phase === 'between-rounds' ? text.nextUp : text.currentTeam}</div>
        <h2 class="m-0 mt-0.5 truncate text-xl font-750 tracking-tight text-white">{currentTeam.name}</h2>
      </div>
      <div class="ml-auto rounded-full border border-white/8 bg-black/20 px-3 py-1.5 text-xs font-700 tabular-nums text-slate-400">{currentTeam.position}/{finishPosition}</div>
    </div>
  </div>

  <div class="flex flex-1 flex-col p-5 sm:p-6">
    {#if game.phase === 'between-rounds'}
      <div class="flex flex-1 flex-col justify-center py-5 text-center">
        <div class="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-white/10 bg-white/[0.045] text-4xl shadow-inner">{currentTeam.emoji}</div>
        <h3 class="mb-0 mt-5 text-2xl font-750 tracking-tight text-white">{text.ready}</h3>
        <p class="mx-auto mb-0 mt-2 max-w-sm text-sm leading-6 text-slate-500">{text.readyHint}</p>
      </div>
      <button class="focus-ring mt-5 w-full cursor-pointer rounded-2xl border-0 bg-amber-300 px-5 py-4 font-750 text-slate-950 shadow-[0_14px_36px_rgb(251_191_36_/_0.18)] transition hover:-translate-y-0.5 hover:bg-amber-200" onclick={onPrepare}>{text.drawLetter}</button>
    {:else if game.phase === 'ready'}
      <div class="flex flex-1 flex-col justify-center text-center">
        <div class="text-[0.65rem] font-750 tracking-[0.18em] text-slate-500 uppercase">{text.currentLetter}</div>
        <div class="my-2 text-[clamp(6rem,30vw,10rem)] font-850 leading-none tracking-[-0.08em] text-white drop-shadow-[0_12px_36px_rgb(255_255_255_/_0.12)]">{game.round.letter}</div>
        <div class="mx-auto flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-650 text-slate-500">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>
          {text.hiddenPrompt}
        </div>
      </div>
      <HoldToReveal label={text.holdReveal} hint={text.holdHint} {onReveal} />
    {:else if game.phase === 'active'}
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-[0.65rem] font-750 tracking-[0.16em] text-slate-500 uppercase">{text.currentLetter}</div>
          <div class="mt-1 text-5xl font-850 leading-none tracking-[-0.06em] text-white">{game.round.letter}</div>
        </div>
        <div
          class="grid h-24 w-24 shrink-0 place-items-center rounded-full p-[5px] shadow-[0_10px_35px_rgb(0_0_0_/_0.3)] transition"
          style:background={`conic-gradient(${remaining <= 5 ? '#fb7185' : '#fbbf24'} ${timerProgress}%, rgb(255 255 255 / .07) 0)`}
          aria-label={`${remaining} ${text.seconds}`}
        >
          <div class={`grid h-full w-full place-items-center rounded-full bg-slate-950 text-4xl font-800 tabular-nums ${remaining <= 5 ? 'text-rose-300' : 'text-white'}`}>{remaining}</div>
        </div>
      </div>

      <div class="my-5 flex min-h-40 flex-1 flex-col items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.045] px-5 py-7 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]" aria-live="polite">
        <div class="text-[0.65rem] font-750 tracking-[0.16em] text-slate-500 uppercase">{text.nameSomething}</div>
        <p class="m-0 mt-3 text-[clamp(1.35rem,5vw,2rem)] font-750 leading-[1.2] tracking-[-0.025em] text-white">{category}</p>
      </div>

      <div class="grid grid-cols-[1.25fr_0.75fr] gap-2.5">
        <button class="focus-ring cursor-pointer rounded-2xl border-0 bg-emerald-300 px-4 py-4 text-base font-800 text-slate-950 shadow-[0_12px_30px_rgb(52_211_153_/_0.18)] transition active:scale-[0.98] hover:bg-emerald-200" onclick={onAccept}>
          <span class="mr-1" aria-hidden="true">✓</span> {text.accept}
        </button>
        <button class="focus-ring cursor-pointer rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-750 text-white transition active:scale-[0.98] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30" disabled={game.round.skipsLeft <= 0} onclick={onSkip}>
          {text.skip}<span class="mt-0.5 block text-[0.62rem] font-650 text-slate-500">{game.round.skipsLeft} {text.skipsLeft}</span>
        </button>
      </div>
      <p class="mb-0 mt-3 text-center text-[0.68rem] leading-5 text-slate-600">{text.rules}</p>
    {/if}

    <div class="mt-5 border-t border-white/8 pt-4">
      <div class="space-y-2.5">
        {#each game.teams as team (team.id)}
          {@const option = teamTheme(team.palette)}
          <div class="grid grid-cols-[1.7rem_minmax(0,1fr)_2.2rem] items-center gap-2 text-xs">
            <span class="text-center text-base">{team.emoji}</span>
            <div class="min-w-0">
              <div class="mb-1 flex items-center justify-between gap-2"><span class={`truncate font-650 ${team.id === currentTeam.id ? 'text-white' : 'text-slate-500'}`}>{team.name}</span></div>
              <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full transition-[width] duration-300" style:width={`${(team.position / finishPosition) * 100}%`} style:background={option.accent}></div></div>
            </div>
            <span class="text-right font-700 tabular-nums text-slate-600">{team.position}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</aside>
