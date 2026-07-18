<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import { copy, type GameLocale } from './content';
  import GameBoard from './GameBoard.svelte';
  import {
    createGame,
    transitionGame,
    type Game,
    type Team,
    type TeamInput,
  } from './game';
  import RoundPanel from './RoundPanel.svelte';
  import TeamSetup from './TeamSetup.svelte';
  import { teamTheme } from './theme';

  let game: Game | null = $state(null);
  let initialLocale: GameLocale = $state('en');
  let now = $state(Date.now());
  let confirmEnd = $state(false);
  let confirmDialog = $state<HTMLDialogElement>();
  let winnerDialog = $state<HTMLDialogElement>();

  const text = $derived.by(() => copy[game ? game.locale : initialLocale]);
  const winner = $derived.by(findWinner);
  const winnerTheme = $derived(winner ? teamTheme(winner.palette) : teamTheme(0));

  $effect(() => {
    if (confirmEnd && confirmDialog && !confirmDialog.open) confirmDialog.showModal();
    if (!confirmEnd && confirmDialog?.open) confirmDialog.close();
  });

  $effect(() => {
    if (winner && winnerDialog && !winnerDialog.open) winnerDialog.showModal();
  });

  function startGame(teams: TeamInput[], locale: GameLocale): void {
    game = createGame(teams, locale);
    now = Date.now();
  }

  function findWinner(): Team | null {
    const currentGame = game;
    if (currentGame?.phase !== 'won') return null;
    return currentGame.teams.find((team) => team.id === currentGame.winnerId) ?? null;
  }

  function prepareRound(): void {
    if (!game) return;
    game = transitionGame(game, { type: 'prepare-round' });
  }

  function reveal(): void {
    if (!game) return;
    now = Date.now();
    game = transitionGame(game, { type: 'reveal', now });
    vibrate(35);
  }

  function accept(): void {
    if (!game) return;
    now = Date.now();
    const previousPhase = game.phase;
    game = transitionGame(game, { type: 'accept', now });
    vibrate(game.phase === 'won' && previousPhase !== 'won' ? [80, 60, 160] : 25);
  }

  function skip(): void {
    if (!game) return;
    now = Date.now();
    game = transitionGame(game, { type: 'skip', now });
  }

  function tick(): void {
    if (!game || game.phase !== 'active') return;
    const previous = game;
    now = Date.now();
    game = transitionGame(game, { type: 'tick', now });
    if (previous.phase === 'active' && game.phase === 'between-rounds') vibrate(80);
  }

  function resetGame(): void {
    winnerDialog?.close();
    confirmDialog?.close();
    confirmEnd = false;
    game = null;
  }

  function vibrate(pattern: number | number[]): void {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  onMount(() => {
    initialLocale = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
    const ticker = setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', tick);
    };
  });
</script>

<svelte:head>
  <title>Wordguessr — e7g.eu</title>
  <meta name="description" content="A fast pass-and-play word game for up to four teams." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-9">
  <div class="flex items-center justify-between gap-4">
    <AppHeader title="Wordguessr" subtitle="Fast words · friendly rivalry" icon="word" />
    {#if game}
      <button class="focus-ring grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/[0.055] text-slate-400 transition hover:border-rose-300/20 hover:bg-rose-300/8 hover:text-rose-200 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-700" onclick={() => (confirmEnd = true)} aria-label={text.endGame}>
        <svg class="sm:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8l8 8m0-8-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/></svg>
        <span class="hidden sm:inline">{text.endGame}</span>
      </button>
    {/if}
  </div>

  {#if !game}
    <TeamSetup locale={initialLocale} onLocale={(locale) => (initialLocale = locale)} onStart={startGame} />
  {:else}
    <div class="mt-6 grid items-stretch gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:gap-6">
      <div class="order-2 self-start lg:order-1">
        <GameBoard {game} {text} />
      </div>
      <div class="order-1 lg:order-2">
        <RoundPanel
          {game}
          {now}
          {text}
          onPrepare={prepareRound}
          onReveal={reveal}
          onAccept={accept}
          onSkip={skip}
        />
      </div>
    </div>
  {/if}

  <p class="mx-auto mb-0 mt-5 max-w-xl text-center text-xs leading-5 text-slate-600">No accounts, ads, or online players. Everything happens together on this device.</p>
</main>

<dialog
  bind:this={confirmDialog}
  aria-labelledby="end-game-title"
  class="m-auto w-[calc(100vw_-_2rem)] max-w-md rounded-[1.75rem] border border-white/12 bg-slate-950 p-0 text-white shadow-[0_30px_100px_rgb(0_0_0_/_0.7)] backdrop:bg-slate-950/75 backdrop:backdrop-blur-md"
  onclose={() => (confirmEnd = false)}
  oncancel={() => (confirmEnd = false)}
>
  <div class="p-6 sm:p-7">
    <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-300/10 text-rose-300">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v4m0 4h.01M10.3 3.7 2.8 17a2 2 0 0 0 1.75 3h14.9a2 2 0 0 0 1.75-3L13.7 3.7a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2 id="end-game-title" class="mb-0 mt-4 text-center text-2xl font-750 tracking-tight">{text.endTitle}</h2>
    <p class="mx-auto mb-0 mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">{text.endDescription}</p>
    <div class="mt-6 grid grid-cols-2 gap-2.5">
      <button class="focus-ring cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-700 text-white" onclick={() => (confirmEnd = false)}>{text.cancel}</button>
      <button class="focus-ring cursor-pointer rounded-xl border-0 bg-rose-300 px-3 py-3 text-sm font-750 text-slate-950" onclick={resetGame}>{text.confirm}</button>
    </div>
  </div>
</dialog>

<dialog
  bind:this={winnerDialog}
  aria-labelledby="winner-title"
  class="m-auto w-[calc(100vw_-_2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950 p-0 text-white shadow-[0_30px_100px_rgb(0_0_0_/_0.75)] backdrop:bg-slate-950/80 backdrop:backdrop-blur-md"
  oncancel={(event) => event.preventDefault()}
>
  {#if winner}
    <div class="relative overflow-hidden p-7 text-center sm:p-9">
      <div class="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl" style:background={winnerTheme.accent}></div>
      <div class="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
      <div class="relative">
        <div class="text-[0.68rem] font-800 tracking-[0.2em] text-amber-300 uppercase">{text.winnerEyebrow}</div>
        <div class="mx-auto mt-6 grid h-28 w-28 place-items-center rounded-[2rem] border-2 text-6xl shadow-2xl" style:background={`linear-gradient(145deg,${winnerTheme.accent},${winnerTheme.deep})`} style:border-color={`${winnerTheme.accent}cc`} style:box-shadow={`0 18px 60px ${winnerTheme.glow}`}>{winner.emoji}</div>
        <h2 id="winner-title" class="mb-0 mt-5 text-4xl font-850 tracking-[-0.045em] text-white">{winner.name}</h2>
        <p class="mb-0 mt-1 text-xl font-650 text-slate-400">{text.winnerTitle}</p>
        <button class="focus-ring mt-7 w-full cursor-pointer rounded-2xl border-0 bg-amber-300 px-5 py-4 font-800 text-slate-950 shadow-[0_14px_36px_rgb(251_191_36_/_0.18)] transition hover:bg-amber-200" onclick={resetGame}>{text.playAgain}</button>
      </div>
    </div>
  {/if}
</dialog>
