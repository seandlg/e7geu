<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import CardView from './Card.svelte';
  import { legalHand, suits, type GameAction, type Suit } from './game';
  import { HostRoom, parseRoomRequest, type GameView, type RoomRequest } from './room';
  import { createSecret, createTransport, type ArcanaTransport } from './transport';

  type Screen = 'setup' | 'connecting' | 'table';

  let screen: Screen = $state('setup');
  let name = $state('');
  let inviteToken = $state<string | null>(null);
  let transport: ArcanaTransport | null = $state(null);
  let room: HostRoom | null = $state(null);
  let view = $state<GameView | null>(null);
  let hostId: string | null = $state(null);
  let secret: string | null = $state(null);
  let inviteUrl = $state('');
  let error = $state('');
  let busy = $state(false);
  let copied = $state(false);
  let syncTimer: ReturnType<typeof setInterval> | null = null;

  const self = $derived(view?.players.find((player) => player.id === view?.selfId) ?? null);
  const isHost = $derived(view?.selfId === view?.hostId);
  const activePlayer = $derived(
    view && view.phase !== 'lobby' ? view.players[view.activePlayerIndex] : null,
  );
  const isMyTurn = $derived(activePlayer?.id === view?.selfId);
  const legalIds = $derived(
    new Set(view && view.phase === 'playing' ? legalHand(view.hand, view.trick).map((card) => card.id) : []),
  );
  const sortedPlayers = $derived(
    view ? [...view.players].sort((left, right) => right.score - left.score) : [],
  );

  onMount(() => {
    name = localStorage.getItem('arcana-name') ?? '';
    inviteToken = new URL(window.location.href).searchParams.get('join');
    return () => {
      if (syncTimer) clearInterval(syncTimer);
    };
  });

  async function hostGame(): Promise<void> {
    const cleanName = validName();
    if (!cleanName) return;
    screen = 'connecting';
    error = '';
    try {
      transport = await createTransport();
      secret = createSecret();
      hostId = transport.endpointId;
      room = new HostRoom(hostId, cleanName, secret);
      const response = room.handle(hostId, { type: 'sync', secret });
      if (!response.ok) throw new Error(response.error);
      view = response.view;
      const url = new URL(window.location.href);
      url.searchParams.set('join', `${hostId}.${secret}`);
      inviteUrl = url.toString();
      screen = 'table';
      localStorage.setItem('arcana-name', cleanName);
      void serveHost(transport, room);
    } catch (cause) {
      fail(cause);
      screen = 'setup';
    }
  }

  async function joinGame(): Promise<void> {
    const cleanName = validName();
    if (!cleanName || !inviteToken) return;
    const separator = inviteToken.lastIndexOf('.');
    if (separator < 1) {
      error = 'This invite link is incomplete.';
      return;
    }
    hostId = inviteToken.slice(0, separator);
    secret = inviteToken.slice(separator + 1);
    screen = 'connecting';
    error = '';
    try {
      transport = await createTransport();
      const response = await transport.request(hostId, { type: 'join', secret, name: cleanName });
      if (!response.ok) throw new Error(response.error);
      view = response.view;
      screen = 'table';
      localStorage.setItem('arcana-name', cleanName);
      syncTimer = setInterval(() => void sync(), 1200);
    } catch (cause) {
      fail(cause);
      screen = 'setup';
    }
  }

  async function serveHost(server: ArcanaTransport, hostedRoom: HostRoom): Promise<void> {
    const reader = server.requests.getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      const incoming = result.value;
      try {
        const response = hostedRoom.handle(incoming.endpointId, parseRoomRequest(incoming.payload));
        server.respond(incoming.requestId, response);
        const own = hostedRoom.handle(server.endpointId, { type: 'sync', secret: secret! });
        if (own.ok) view = own.view;
      } catch (cause) {
        server.respond(incoming.requestId, {
          ok: false,
          error: cause instanceof Error ? cause.message : 'Invalid request',
        });
      }
    }
  }

  async function sync(): Promise<void> {
    if (!transport || !hostId || !secret || room) return;
    try {
      const response = await transport.request(hostId, { type: 'sync', secret });
      if (response.ok) view = response.view;
    } catch {
      // A missed refresh is expected while a relay path reconnects. The next poll retries.
    }
  }

  async function act(action: GameAction): Promise<void> {
    if (!transport || !secret || !view || busy) return;
    busy = true;
    error = '';
    try {
      const request: RoomRequest = { type: 'action', secret, action };
      const response = room
        ? room.handle(transport.endpointId, request)
        : await transport.request(hostId!, request);
      if (!response.ok) throw new Error(response.error);
      view = response.view;
    } catch (cause) {
      fail(cause);
    } finally {
      busy = false;
    }
  }

  async function copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      error = 'Copy failed. Select and share the link manually.';
    }
  }

  function validName(): string | null {
    const cleanName = name.trim().slice(0, 24);
    if (!cleanName) {
      error = 'Enter your name first.';
      return null;
    }
    return cleanName;
  }

  function fail(cause: unknown): void {
    error = cause instanceof Error ? cause.message : 'Something went wrong.';
  }

  function playerName(playerId: string): string {
    return view?.players.find((player) => player.id === playerId)?.name ?? 'Player';
  }

  function suitName(suit: Suit | null): string {
    return suit ? suit[0]!.toUpperCase() + suit.slice(1) : 'No trump';
  }

  function statusText(): string {
    if (!view) return '';
    if (view.phase === 'lobby') return 'Waiting for the circle to gather';
    if (view.phase === 'choose-trump') return `${activePlayer?.name} chooses the trump suit`;
    if (view.phase === 'bidding') return `${activePlayer?.name} is making a bid`;
    if (view.phase === 'playing') return `${activePlayer?.name} leads the next card`;
    if (view.phase === 'round-over') return `Round ${view.round} is complete`;
    return 'The final omen has been read';
  }
</script>

<svelte:head>
  <title>Arcana — e7g.eu</title>
  <meta name="description" content="A private, backendless trick-taking card game for 3 to 6 friends." />
</svelte:head>

<main class="mx-auto min-h-dvh max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-9">
  <div class="flex items-center justify-between gap-4">
    <AppHeader title="Arcana" subtitle="Read the table · name your fate" icon="cards" />
    {#if screen === 'table'}
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/8 px-3 py-1.5 text-xs font-700 text-emerald-200">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_#6ee7b7]"></span>
        Iroh relay
      </div>
    {/if}
  </div>

  {#if screen === 'setup' || screen === 'connecting'}
    <section class="mx-auto mt-10 max-w-xl overflow-hidden rounded-[2rem] border border-amber-200/12 bg-[#0b1220]/85 shadow-[0_30px_90px_rgb(0_0_0_/.35)] sm:mt-14">
      <div class="relative overflow-hidden px-6 pb-6 pt-8 text-center sm:px-10 sm:pb-9 sm:pt-11">
        <div class="pointer-events-none absolute left-1/2 top-0 h-48 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/16 blur-3xl"></div>
        <div class="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-amber-200/20 bg-amber-200/8 text-4xl text-amber-200 shadow-[0_0_45px_rgb(251_191_36_/.12)]">✺</div>
        <h2 class="relative mb-0 mt-5 text-3xl font-850 tracking-[-0.04em] text-white">Gather your circle</h2>
        <p class="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-slate-400">Bid on the tricks you will take. Hit your prediction exactly to master the round.</p>

        <label class="mt-7 block text-left text-xs font-750 tracking-wide text-slate-400 uppercase" for="player-name">Your name</label>
        <input id="player-name" class="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-600" maxlength="24" autocomplete="nickname" placeholder="Ada" bind:value={name} disabled={screen === 'connecting'} />

        {#if error}<p class="mb-0 mt-3 text-sm text-rose-300" role="alert">{error}</p>{/if}

        {#if inviteToken}
          <button class="focus-ring mt-5 w-full cursor-pointer rounded-xl border-0 bg-amber-300 px-5 py-4 font-800 text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60" disabled={screen === 'connecting'} onclick={joinGame}>
            {screen === 'connecting' ? 'Finding the table…' : 'Join this table'}
          </button>
          <p class="mb-0 mt-4 text-xs text-slate-600">Your cards travel over an end-to-end encrypted Iroh connection.</p>
        {:else}
          <button class="focus-ring mt-5 w-full cursor-pointer rounded-xl border-0 bg-amber-300 px-5 py-4 font-800 text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60" disabled={screen === 'connecting'} onclick={hostGame}>
            {screen === 'connecting' ? 'Opening the table…' : 'Host a game'}
          </button>
          <p class="mb-0 mt-4 text-xs leading-5 text-slate-600">3–6 players · no account · no game server</p>
        {/if}
        <details class="mt-5 rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-left">
          <summary class="cursor-pointer text-sm font-750 text-slate-300">How to play</summary>
          <div class="mt-3 space-y-2 text-xs leading-5 text-slate-500">
            <p class="m-0">Each round, predict exactly how many tricks you will take. Follow the led suit when possible; the highest trump wins.</p>
            <p class="m-0"><strong class="text-amber-200">Apex</strong> wins any trick. <strong class="text-slate-300">Mote</strong> loses unless only Motes are played.</p>
            <p class="m-0">An exact bid scores 20 + 10 per trick. A miss loses 10 per trick above or below your bid.</p>
          </div>
        </details>
      </div>
    </section>
  {:else if view}
    <section class="mt-6 sm:mt-8">
      <div class="flex gap-2 overflow-x-auto pb-2">
        {#each view.players as player (player.id)}
          <div class:active-player={activePlayer?.id === player.id} class:self-player={player.id === view.selfId} class="player-pill min-w-36 flex-1 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-750 text-white">{player.name}{player.id === view.hostId ? ' ◇' : ''}</span>
              <strong class="text-sm text-amber-200">{player.score}</strong>
            </div>
            <div class="mt-1.5 flex items-center justify-between text-[.68rem] font-650 text-slate-500 uppercase">
              <span>{player.handSize} cards</span>
              {#if player.bid !== null}<span>{player.tricks}/{player.bid} tricks</span>{/if}
            </div>
          </div>
        {/each}
      </div>

      {#if view.phase === 'lobby'}
        <div class="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div class="rounded-[1.75rem] border border-white/9 bg-white/[0.035] p-5 sm:p-7">
            <p class="m-0 text-xs font-800 tracking-[.16em] text-amber-300 uppercase">The circle</p>
            <h2 class="mb-0 mt-2 text-2xl font-800 text-white">{view.players.length} of 6 players seated</h2>
            <div class="mt-5 grid gap-2.5">
              {#each view.players as player, index (player.id)}
                <div class="flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 px-3.5 py-3">
                  <span class="grid h-9 w-9 place-items-center rounded-full bg-amber-300/9 text-sm font-800 text-amber-200">{index + 1}</span>
                  <span class="font-700 text-slate-200">{player.name}</span>
                  {#if player.id === view.hostId}<span class="ml-auto text-[.65rem] font-750 tracking-wide text-slate-500 uppercase">Host</span>{/if}
                </div>
              {/each}
            </div>
          </div>
          <div class="rounded-[1.75rem] border border-amber-200/10 bg-amber-200/[0.035] p-5 sm:p-7">
            {#if isHost}
              <p class="m-0 text-xs font-800 tracking-[.16em] text-amber-300 uppercase">Invite friends</p>
              <p class="mb-0 mt-2 text-sm leading-6 text-slate-400">Share this private link. It contains the Iroh address and room secret.</p>
              <div class="mt-4 flex gap-2">
                <input class="min-w-0 flex-1 rounded-xl border border-white/9 bg-black/15 px-3 text-xs text-slate-400 outline-none" readonly value={inviteUrl} aria-label="Invite link" />
                <button class="focus-ring cursor-pointer rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-750 text-white" onclick={copyInvite}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <button class="focus-ring mt-4 w-full cursor-pointer rounded-xl border-0 bg-amber-300 px-4 py-3.5 font-800 text-slate-950 disabled:cursor-not-allowed disabled:opacity-35" disabled={view.players.length < 3 || busy} onclick={() => act({ type: 'start' })}>Start game</button>
              {#if view.players.length < 3}<p class="mb-0 mt-2 text-center text-xs text-slate-600">Invite at least {3 - view.players.length} more</p>{/if}
            {:else}
              <div class="grid min-h-52 place-items-center text-center">
                <div><div class="text-4xl">◇</div><h2 class="mb-0 mt-3 text-xl font-800">Waiting for the host</h2><p class="mb-0 mt-2 text-sm text-slate-500">Keep this tab open. The first deal will appear here.</p></div>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div class="relative min-h-92 overflow-hidden rounded-[2rem] border border-white/9 bg-[radial-gradient(circle_at_50%_40%,rgb(30_64_70_/.75),rgb(9_20_31)_68%)] p-4 sm:min-h-112 sm:p-7">
            <div class="flex items-center justify-between gap-3">
              <div><p class="m-0 text-[.65rem] font-800 tracking-[.16em] text-slate-500 uppercase">Round {view.round} of {view.maxRounds}</p><p class="mb-0 mt-1 text-sm font-750 text-slate-200">Trump · <span class="text-amber-200">{suitName(view.trump)}</span></p></div>
              {#if view.turnedCard}<div class="scale-75"><CardView card={view.turnedCard} compact /></div>{/if}
            </div>

            <div class="grid min-h-62 place-items-center py-6">
              {#if view.trick.length > 0}
                <div class="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                  {#each view.trick as play (play.playerId)}
                    <div class="text-center"><CardView card={play.card} compact /><p class="mb-0 mt-1.5 max-w-16 truncate text-[.65rem] font-700 text-slate-400">{playerName(play.playerId)}</p></div>
                  {/each}
                </div>
              {:else}
                <div class="text-center"><div class="text-4xl text-white/12">✦</div><p class="mb-0 mt-3 text-sm text-slate-500">The table awaits a card</p></div>
              {/if}
            </div>
            <div class="rounded-xl border border-white/7 bg-black/15 px-4 py-3 text-center text-sm font-700 text-slate-300">{statusText()}</div>
          </div>

          <aside class="rounded-[1.75rem] border border-white/9 bg-white/[0.035] p-5">
            {#if view.phase === 'choose-trump'}
              <p class="m-0 text-xs font-800 tracking-[.15em] text-amber-300 uppercase">Apex turned</p><h2 class="mb-0 mt-2 text-xl font-800">Choose the trump</h2>
              {#if isMyTurn}<div class="mt-5 grid grid-cols-2 gap-2">{#each suits as suit}<button class="focus-ring cursor-pointer rounded-xl border border-white/9 bg-white/6 px-3 py-3 text-sm font-750 capitalize text-white hover:bg-white/10" onclick={() => act({ type: 'choose-trump', suit })}>{suit}</button>{/each}</div>{:else}<p class="mb-0 mt-3 text-sm text-slate-500">{activePlayer?.name} is choosing.</p>{/if}
            {:else if view.phase === 'bidding'}
              <p class="m-0 text-xs font-800 tracking-[.15em] text-amber-300 uppercase">Name your fate</p><h2 class="mb-0 mt-2 text-xl font-800">How many tricks?</h2>
              {#if isMyTurn}<div class="mt-5 grid grid-cols-4 gap-2">{#each Array.from({ length: view.round + 1 }, (_, bid) => bid) as bid}<button class="focus-ring cursor-pointer rounded-xl border border-white/9 bg-white/6 py-3 text-sm font-800 text-white hover:bg-amber-300 hover:text-slate-950" onclick={() => act({ type: 'bid', bid })}>{bid}</button>{/each}</div><p class="mb-0 mt-3 text-xs leading-5 text-slate-600">The dealer may not make all bids add up to {view.round}.</p>{:else}<p class="mb-0 mt-3 text-sm text-slate-500">Waiting for {activePlayer?.name}.</p>{/if}
            {:else if view.phase === 'playing'}
              <p class="m-0 text-xs font-800 tracking-[.15em] text-amber-300 uppercase">Current omen</p><h2 class="mb-0 mt-2 text-xl font-800">{self?.tricks ?? 0} taken · {self?.bid ?? 0} bid</h2><p class="mb-0 mt-3 text-sm leading-6 text-slate-500">{isMyTurn ? 'Choose a glowing card. Follow the led suit when you can.' : `Waiting for ${activePlayer?.name}.`}</p>
            {:else if view.phase === 'round-over'}
              <p class="m-0 text-xs font-800 tracking-[.15em] text-amber-300 uppercase">Round complete</p><h2 class="mb-0 mt-2 text-xl font-800">The scores are written</h2>
              <div class="mt-4 space-y-2">{#each sortedPlayers as player}<div class="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{player.name}</span><strong class="text-amber-200">{player.score}</strong></div>{/each}</div>
              {#if isHost}<button class="focus-ring mt-4 w-full cursor-pointer rounded-xl border-0 bg-amber-300 px-3 py-3 font-800 text-slate-950" onclick={() => act({ type: 'next-round' })}>Deal round {view.round + 1}</button>{:else}<p class="mb-0 mt-3 text-xs text-slate-600">The host will deal the next round.</p>{/if}
            {:else}
              <p class="m-0 text-xs font-800 tracking-[.15em] text-amber-300 uppercase">Final standings</p><h2 class="mb-0 mt-2 text-2xl font-850">{sortedPlayers[0]?.name} prevails</h2>
              <div class="mt-4 space-y-2">{#each sortedPlayers as player, index}<div class="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><span>{index + 1}. {player.name}</span><strong class="text-amber-200">{player.score}</strong></div>{/each}</div>
            {/if}
            {#if error}<p class="mb-0 mt-3 text-sm text-rose-300" role="alert">{error}</p>{/if}
          </aside>
        </div>

        {#if view.phase === 'playing'}
          <section aria-label="Your hand" class="mt-4 rounded-[1.75rem] border border-white/9 bg-black/15 px-3 pb-4 pt-4 sm:px-5">
            <div class="mb-3 flex items-center justify-between px-1"><h2 class="m-0 text-xs font-800 tracking-[.14em] text-slate-400 uppercase">Your hand</h2><span class="text-xs text-slate-600">{view.hand.length} cards</span></div>
            <div class="flex gap-2 overflow-x-auto px-1 pb-2 pt-2 sm:justify-center sm:gap-3">
              {#each view.hand as card (card.id)}<CardView {card} playable={isMyTurn && legalIds.has(card.id) && !busy} onclick={() => act({ type: 'play', cardId: card.id })} />{/each}
            </div>
          </section>
        {/if}
      {/if}
    </section>
  {/if}

  <p class="mx-auto mb-0 mt-6 max-w-2xl text-center text-xs leading-5 text-slate-600">Host-authoritative for friendly play. Traffic is end-to-end encrypted and routed through Iroh relay infrastructure; no application server stores your game.</p>
</main>

<style>
  .player-pill { transition: border-color .2s ease, background .2s ease; }
  .player-pill.active-player { border-color: rgb(251 191 36 / .28); background: rgb(251 191 36 / .065); }
  .player-pill.self-player { box-shadow: inset 0 -2px rgb(56 189 248 / .35); }
</style>
