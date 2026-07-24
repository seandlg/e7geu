<script lang="ts">
  import { onMount, tick } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import {
    MAX_FILE_BYTES,
    cleanName,
    createRoom,
    formatBytes,
    joinRoom,
    type CollaborationSession,
    type FileOffer,
    type RoomEvent,
  } from './transport';

  type Screen = 'setup' | 'connecting' | 'room';
  type Peer = { id: string; name: string; lastSeen: number; self?: boolean };
  type ChatMessage = {
    id: string;
    from: string;
    name: string;
    text: string;
    sentAt: number;
    self: boolean;
  };
  type SharedFile = {
    key: string;
    from: string;
    name: string;
    offer: FileOffer;
    sentAt: number;
    self: boolean;
  };

  let screen: Screen = $state('setup');
  let name = $state('');
  let inviteToken: string | null = $state(null);
  let session = $state<CollaborationSession | null>(null);
  let reader: ReadableStreamDefaultReader<RoomEvent> | null = null;
  let messages = $state<ChatMessage[]>([]);
  let peers = $state<Record<string, Peer>>({});
  let files = $state<SharedFile[]>([]);
  let messageText = $state('');
  let selectedFile = $state<File | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let messageList = $state<HTMLDivElement | null>(null);
  let inviteUrl = $state('');
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);
  let copied = $state(false);
  let downloading = $state(new Set<string>());
  let now = $state(Date.now());
  let clock: ReturnType<typeof setInterval> | null = null;
  let messageSequence = 0;

  const activePeers = $derived.by(() =>
    Object.values(peers).filter((peer) => peer.self || now - peer.lastSeen < 16_000),
  );

  onMount(() => {
    name = localStorage.getItem('collaboration-name') ?? '';
    inviteToken = new URL(window.location.href).searchParams.get('join');
    clock = setInterval(() => (now = Date.now()), 2_000);
    return () => {
      if (clock) clearInterval(clock);
      void closeSession();
    };
  });

  async function hostRoom(): Promise<void> {
    await connect((clean) => createRoom(clean));
  }

  async function joinInvitedRoom(): Promise<void> {
    if (!inviteToken) {
      error = 'This invite link is incomplete.';
      return;
    }
    await connect((clean) => joinRoom(inviteToken!, clean));
  }

  async function connect(
    open: (cleanName: string) => Promise<CollaborationSession>,
  ): Promise<void> {
    let clean: string;
    try {
      clean = cleanName(name);
    } catch (cause) {
      fail(cause);
      return;
    }
    screen = 'connecting';
    error = '';
    notice = '';
    try {
      const connected = await open(clean);
      session = connected;
      peers = {
        [connected.endpointId]: {
          id: connected.endpointId,
          name: clean,
          lastSeen: Date.now(),
          self: true,
        },
      };
      inviteUrl = currentInviteUrl();
      reader = connected.events.getReader();
      void consumeEvents(reader);
      localStorage.setItem('collaboration-name', clean);
      screen = 'room';
    } catch (cause) {
      session = null;
      fail(cause);
      screen = 'setup';
    }
  }

  async function consumeEvents(
    eventReader: ReadableStreamDefaultReader<RoomEvent>,
  ): Promise<void> {
    try {
      while (reader === eventReader) {
        const result = await eventReader.read();
        if (result.done) return;
        handleEvent(result.value);
      }
    } catch (cause) {
      if (reader === eventReader) fail(cause);
    }
  }

  function handleEvent(event: RoomEvent): void {
    if (event.type === 'presence') {
      rememberPeer(event.from, event.nickname, toMilliseconds(event.sentTimestamp));
      return;
    }
    if (event.type === 'chat') {
      if (event.from === session?.endpointId) return;
      const sentAt = toMilliseconds(event.sentTimestamp);
      rememberPeer(event.from, event.nickname, sentAt);
      appendMessage({
        id: `${event.from}:${event.sentTimestamp}`,
        from: event.from,
        name: event.nickname,
        text: event.text,
        sentAt,
        self: false,
      });
      return;
    }
    if (event.type === 'fileOffered') {
      if (event.from === session?.endpointId) return;
      const sentAt = toMilliseconds(event.sentTimestamp);
      rememberPeer(event.from, event.nickname, sentAt);
      appendFile(event.from, event.nickname, event.offer, sentAt, false);
      return;
    }
    if (event.type === 'neighborUp') {
      const existing = peers[event.endpointId];
      peers[event.endpointId] = existing ?? {
        id: event.endpointId,
        name: 'Joining…',
        lastSeen: Date.now(),
      };
      peers = { ...peers };
      inviteUrl = currentInviteUrl();
      return;
    }
    if (event.type === 'neighborDown') {
      const peer = peers[event.endpointId];
      if (peer && !peer.self) {
        peer.lastSeen = 0;
        peers = { ...peers };
      }
      return;
    }
    notice = 'Some room events arrived too quickly and were skipped.';
  }

  function rememberPeer(id: string, peerName: string, lastSeen: number): void {
    if (id === session?.endpointId) return;
    peers[id] = { id, name: peerName, lastSeen };
    peers = { ...peers };
  }

  async function sendMessage(): Promise<void> {
    if (!session || busy) return;
    busy = true;
    error = '';
    try {
      const text = await session.sendChat(messageText);
      const self = peers[session.endpointId]!;
      appendMessage({
        id: `self:${++messageSequence}`,
        from: session.endpointId,
        name: self.name,
        text,
        sentAt: Date.now(),
        self: true,
      });
      messageText = '';
    } catch (cause) {
      fail(cause);
    } finally {
      busy = false;
    }
  }

  function appendMessage(message: ChatMessage): void {
    messages = [...messages.slice(-199), message];
    void tick().then(() => messageList?.scrollTo({ top: messageList.scrollHeight }));
  }

  function chooseFile(event: Event): void {
    selectedFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    error = '';
  }

  async function shareSelectedFile(): Promise<void> {
    if (!session || !selectedFile || busy) return;
    busy = true;
    error = '';
    notice = 'Preparing and announcing the file…';
    try {
      const file = selectedFile;
      const offer = await session.offerFile(file);
      const self = peers[session.endpointId]!;
      appendFile(session.endpointId, self.name, offer, Date.now(), true);
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      notice = 'File shared. Keep this tab open while others download it.';
    } catch (cause) {
      fail(cause);
      notice = '';
    } finally {
      busy = false;
    }
  }

  function appendFile(
    from: string,
    peerName: string,
    offer: FileOffer,
    sentAt: number,
    self: boolean,
  ): void {
    const key = `${from}:${offer.id}`;
    if (files.some((file) => file.key === key)) return;
    files = [
      { key, from, name: peerName, offer, sentAt, self },
      ...files,
    ].slice(0, 40);
  }

  async function downloadFile(shared: SharedFile): Promise<void> {
    if (!session || downloading.has(shared.key)) return;
    downloading = new Set(downloading).add(shared.key);
    error = '';
    try {
      const blob = await session.downloadFile(shared.offer);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = shared.offer.name;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (cause) {
      fail(cause);
    } finally {
      const next = new Set(downloading);
      next.delete(shared.key);
      downloading = next;
    }
  }

  async function copyInvite(): Promise<void> {
    inviteUrl = currentInviteUrl();
    try {
      await navigator.clipboard.writeText(inviteUrl);
      copied = true;
      setTimeout(() => (copied = false), 1_800);
    } catch {
      error = 'Copy failed. Select and share the link manually.';
    }
  }

  function currentInviteUrl(): string {
    if (!session) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('join', session.inviteToken());
    return url.toString();
  }

  async function closeSession(): Promise<void> {
    const activeReader = reader;
    reader = null;
    await activeReader?.cancel().catch(() => undefined);
    const activeSession = session;
    session = null;
    await activeSession?.close().catch(() => undefined);
  }

  function toMilliseconds(microseconds: number): number {
    return Math.floor(microseconds / 1_000);
  }

  function fail(cause: unknown): void {
    error = cause instanceof Error ? cause.message : String(cause || 'Something went wrong.');
  }

  function initials(peerName: string): string {
    return peerName.trim().slice(0, 1).toUpperCase() || '?';
  }
</script>

<svelte:head>
  <title>Collaboration — e7g.eu</title>
  <meta
    name="description"
    content="Open a private browser room for encrypted chat and peer-owned file sharing."
  />
</svelte:head>

<main
  class="mx-auto min-h-dvh max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-9"
>
  <div class="flex items-center justify-between gap-4">
    <AppHeader title="Collaboration" subtitle="A private room that lives in your tabs" icon="chat" />
    {#if screen === 'room'}
      <div
        class="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/8 px-3 py-1.5 text-xs font-700 text-emerald-200"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_#6ee7b7]"></span>
        Encrypted room
      </div>
    {/if}
  </div>

  {#if screen === 'setup' || screen === 'connecting'}
    <section
      class="mx-auto mt-10 max-w-xl overflow-hidden rounded-[2rem] border border-cyan-200/12 bg-[#08131c]/88 shadow-[0_30px_90px_rgb(0_0_0_/.35)] sm:mt-14"
    >
      <div class="relative px-6 pb-7 pt-9 text-center sm:px-10 sm:pb-10 sm:pt-11">
        <div
          class="pointer-events-none absolute left-1/2 top-0 h-52 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/14 blur-3xl"
        ></div>
        <div
          class="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-cyan-200/20 bg-cyan-200/8 text-4xl text-cyan-200 shadow-[0_0_45px_rgb(103_232_249_/.1)]"
        >
          ✦
        </div>
        <h2 class="relative mb-0 mt-5 text-3xl font-850 tracking-[-0.04em] text-white">
          {inviteToken ? 'Join the room' : 'Open a room'}
        </h2>
        <p class="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-slate-400">
          Chat and pass files between two to four people. Nothing is stored on an application server.
        </p>

        <label
          class="mt-7 block text-left text-xs font-750 tracking-wide text-slate-400 uppercase"
          for="collaboration-name">Your name</label
        >
        <input
          id="collaboration-name"
          class="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-600"
          maxlength="32"
          autocomplete="nickname"
          placeholder="Ada"
          bind:value={name}
          disabled={screen === 'connecting'}
        />

        {#if error}<p class="mb-0 mt-3 text-sm text-rose-300" role="alert">{error}</p>{/if}

        <button
          class="focus-ring mt-5 w-full cursor-pointer rounded-xl border-0 bg-cyan-300 px-5 py-4 font-800 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
          disabled={screen === 'connecting'}
          onclick={inviteToken ? joinInvitedRoom : hostRoom}
        >
          {screen === 'connecting'
            ? 'Opening an encrypted connection…'
            : inviteToken
              ? 'Join this room'
              : 'Create private room'}
        </button>
        <p class="mb-0 mt-4 text-xs leading-5 text-slate-600">
          Ephemeral · encrypted in transit · no account
        </p>
      </div>
    </section>
  {:else if session}
    <section class="mt-6 sm:mt-8">
      <div
        class="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 sm:flex-row sm:items-center"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 text-xs font-800 tracking-[.14em] text-cyan-300 uppercase">Invite people</p>
          <input
            class="mt-1 w-full truncate border-0 bg-transparent p-0 text-xs text-slate-500 outline-none"
            readonly
            value={inviteUrl}
            aria-label="Invite link"
          />
        </div>
        <button
          class="focus-ring cursor-pointer rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-750 text-white hover:bg-white/12"
          onclick={copyInvite}>{copied ? 'Copied' : 'Copy invite'}</button
        >
      </div>

      <div class="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="People in this room">
        {#each activePeers as peer (peer.id)}
          <div
            class="flex min-w-36 items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2.5"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-300/12 text-xs font-850 text-cyan-200"
              >{initials(peer.name)}</span
            >
            <span class="min-w-0 truncate text-sm font-700 text-slate-200"
              >{peer.name}{peer.self ? ' (you)' : ''}</span
            >
          </div>
        {/each}
        <div
          class="grid min-w-28 place-items-center rounded-xl border border-dashed border-white/8 px-3 text-xs text-slate-600"
        >
          {activePeers.length} online
        </div>
      </div>

      <div class="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          class="flex min-h-[34rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/9 bg-[#08131c]/75"
          aria-label="Room chat"
        >
          <div class="border-b border-white/7 px-5 py-4">
            <p class="m-0 text-xs font-800 tracking-[.15em] text-cyan-300 uppercase">Room chat</p>
            <p class="mb-0 mt-1 text-xs text-slate-600">Messages exist only in open tabs.</p>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5" bind:this={messageList}>
            {#if messages.length === 0}
              <div class="grid min-h-72 place-items-center text-center">
                <div>
                  <div class="text-4xl text-cyan-200/18">◇</div>
                  <p class="mb-0 mt-3 text-sm font-700 text-slate-400">The room is quiet</p>
                  <p class="mb-0 mt-1 text-xs text-slate-600">Send the first message or share a file.</p>
                </div>
              </div>
            {:else}
              <div class="space-y-3">
                {#each messages as message (message.id)}
                  <article class:flex-row-reverse={message.self} class="flex items-end gap-2.5">
                    <span
                      class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/7 text-[.65rem] font-800 text-slate-400"
                      >{initials(message.name)}</span
                    >
                    <div class="max-w-[82%]">
                      <div class:items-end={message.self} class="mb-1 flex gap-2 px-1 text-[.65rem] text-slate-600">
                        <span>{message.name}</span>
                        <time>{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      <p
                        class:self-message={message.self}
                        class="message-bubble m-0 whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-white/8 bg-white/[0.055] px-3.5 py-2.5 text-sm leading-6 text-slate-200"
                      >
                        {message.text}
                      </p>
                    </div>
                  </article>
                {/each}
              </div>
            {/if}
          </div>
          <form class="border-t border-white/7 p-3 sm:p-4" onsubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <div class="flex gap-2">
              <input
                class="focus-ring min-w-0 flex-1 rounded-xl border border-white/9 bg-black/15 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                maxlength="4000"
                placeholder="Write a message…"
                autocomplete="off"
                bind:value={messageText}
              />
              <button
                class="focus-ring cursor-pointer rounded-xl border-0 bg-cyan-300 px-4 font-800 text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy || !messageText.trim()}>Send</button
              >
            </div>
          </form>
        </section>

        <aside
          class="overflow-hidden rounded-[1.75rem] border border-white/9 bg-white/[0.035]"
          aria-label="Shared files"
        >
          <div class="border-b border-white/7 p-5">
            <p class="m-0 text-xs font-800 tracking-[.15em] text-cyan-300 uppercase">Share a file</p>
            <p class="mb-0 mt-2 text-xs leading-5 text-slate-500">
              Up to 25 MiB. Keep your tab open until everyone finishes downloading.
            </p>
            <input
              class="mt-4 block w-full text-xs text-slate-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/9 file:px-3 file:py-2 file:font-700 file:text-white"
              type="file"
              bind:this={fileInput}
              onchange={chooseFile}
            />
            {#if selectedFile}
              <p class="mb-0 mt-2 truncate text-xs text-slate-500">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </p>
            {/if}
            <button
              class="focus-ring mt-3 w-full cursor-pointer rounded-xl border-0 bg-white/10 px-4 py-3 text-sm font-800 text-white hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!selectedFile || selectedFile.size > MAX_FILE_BYTES || busy}
              onclick={shareSelectedFile}>Share with room</button
            >
          </div>

          <div class="p-4">
            <div class="flex items-center justify-between px-1">
              <h2 class="m-0 text-sm font-800 text-white">Available here</h2>
              <span class="text-xs text-slate-600">{files.length}</span>
            </div>
            {#if files.length === 0}
              <p class="mb-0 mt-4 rounded-xl border border-dashed border-white/7 px-4 py-6 text-center text-xs leading-5 text-slate-600">
                Shared files will appear here while their providers remain online.
              </p>
            {:else}
              <div class="mt-3 space-y-2">
                {#each files as shared (shared.key)}
                  <div class="rounded-xl border border-white/7 bg-black/10 p-3">
                    <p class="m-0 truncate text-sm font-750 text-slate-200">{shared.offer.name}</p>
                    <p class="mb-0 mt-1 truncate text-[.68rem] text-slate-600">
                      {formatBytes(shared.offer.size)} · {shared.self ? 'You' : shared.name}
                    </p>
                    {#if !shared.self}
                      <button
                        class="focus-ring mt-2.5 w-full cursor-pointer rounded-lg border border-white/9 bg-white/7 px-3 py-2 text-xs font-750 text-white disabled:cursor-wait disabled:opacity-45"
                        disabled={downloading.has(shared.key)}
                        onclick={() => downloadFile(shared)}
                        >{downloading.has(shared.key) ? 'Downloading…' : 'Download'}</button
                      >
                    {:else}
                      <p class="mb-0 mt-2 text-[.68rem] font-700 text-emerald-300/70">You are providing this file</p>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </aside>
      </div>

      {#if error}<p class="mb-0 mt-4 text-center text-sm text-rose-300" role="alert">{error}</p>{/if}
      {#if notice}<p class="mb-0 mt-2 text-center text-xs text-slate-500" role="status">{notice}</p>{/if}
    </section>
  {/if}

  <p class="mx-auto mb-0 mt-6 max-w-2xl text-center text-xs leading-5 text-slate-600">
    Browser traffic is end-to-end encrypted and carried by Iroh relay infrastructure. Relays do not store room messages or files.
  </p>
</main>

<style>
  .message-bubble.self-message {
    border-color: rgb(103 232 249 / 0.16);
    border-bottom-left-radius: 1rem;
    border-bottom-right-radius: 0.25rem;
    background: rgb(103 232 249 / 0.09);
  }
</style>
