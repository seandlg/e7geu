<script lang="ts">
  import { copy, teamEmojis, type GameLocale } from './content';
  import type { TeamInput } from './game';
  import { teamTheme } from './theme';

  let {
    locale,
    onLocale,
    onStart,
  }: {
    locale: GameLocale;
    onLocale: (locale: GameLocale) => void;
    onStart: (teams: TeamInput[], locale: GameLocale) => void;
  } = $props();

  type DraftTeam = TeamInput & { id: number };
  let nextId = 3;
  let teams: DraftTeam[] = $state([
    { id: 1, name: 'Dolphins', emoji: teamEmojis[0] },
    { id: 2, name: 'Rockets', emoji: teamEmojis[1] },
  ]);
  const text = $derived(copy[locale]);
  const validTeams = $derived(teams.filter((team) => team.name.trim().length > 0));

  function updateTeam(id: number, values: Partial<TeamInput>): void {
    teams = teams.map((team) => (team.id === id ? { ...team, ...values } : team));
  }

  function addTeam(): void {
    if (teams.length >= 4) return;
    const emoji = teamEmojis.find((option) => !teams.some((team) => team.emoji === option));
    teams = [
      ...teams,
      { id: nextId++, name: `Team ${teams.length + 1}`, emoji: emoji ?? '⭐' },
    ];
  }

  function removeTeam(id: number): void {
    if (teams.length <= 1) return;
    teams = teams.filter((team) => team.id !== id);
  }

  function start(): void {
    if (validTeams.length === 0) return;
    onStart(
      validTeams.map(({ name, emoji }) => ({ name: name.trim(), emoji })),
      locale,
    );
  }
</script>

<section class="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 shadow-[0_28px_80px_rgb(0_0_0_/_0.32)] backdrop-blur-xl">
  <div class="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl"></div>
  <div class="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-amber-400/12 blur-3xl"></div>

  <div class="relative border-b border-white/8 px-5 py-7 sm:px-8 sm:py-9">
    <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/8 px-3 py-1.5 text-[0.68rem] font-700 tracking-[0.16em] text-amber-200 uppercase">
      <span class="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fcd34d]"></span>
      {text.passAndPlay}
    </div>
    <h2 class="m-0 max-w-xl text-3xl font-750 leading-tight tracking-[-0.035em] text-white sm:text-4xl">{text.setupTitle}</h2>
    <p class="mb-0 mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">{text.setupHint}</p>
  </div>

  <div class="relative grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="m-0 text-xs font-700 tracking-[0.14em] text-slate-400 uppercase">{text.teams}</h3>
        <span class="text-xs tabular-nums text-slate-600">{teams.length}/4</span>
      </div>

      <div class="space-y-3">
        {#each teams as team, index (team.id)}
          {@const theme = teamTheme(index)}
          <div class="group grid grid-cols-[3.5rem_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-2xl border border-white/9 bg-white/[0.045] p-2 transition focus-within:border-white/18 focus-within:bg-white/[0.07]">
            <label class="sr-only" for={`team-emoji-${team.id}`}>{text.teamEmoji}</label>
            <select
              id={`team-emoji-${team.id}`}
              class="focus-ring h-11 w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-slate-900 text-center text-xl"
              value={team.emoji}
              onchange={(event) => updateTeam(team.id, { emoji: event.currentTarget.value })}
              style:border-color={`${theme.accent}55`}
            >
              {#each teamEmojis as emoji}
                <option value={emoji} disabled={teams.some((other) => other.id !== team.id && other.emoji === emoji)}>{emoji}</option>
              {/each}
            </select>

            <label class="sr-only" for={`team-name-${team.id}`}>{text.teamName} {index + 1}</label>
            <input
              id={`team-name-${team.id}`}
              class="focus-ring min-w-0 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-3 text-base font-650 text-white outline-none placeholder:text-slate-600"
              value={team.name}
              maxlength="24"
              placeholder={`${text.teamName} ${index + 1}`}
              oninput={(event) => updateTeam(team.id, { name: event.currentTarget.value })}
            />

            <button
              class="focus-ring grid h-11 w-11 cursor-pointer place-items-center rounded-xl border-0 bg-transparent text-slate-600 transition hover:bg-rose-300/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-25"
              disabled={teams.length <= 1}
              onclick={() => removeTeam(team.id)}
              aria-label={`${text.removeTeam} ${team.name || `${text.teamName} ${index + 1}`}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        {/each}
      </div>

      <button
        class="focus-ring mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/14 bg-white/[0.025] px-4 py-3 text-sm font-650 text-slate-400 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        disabled={teams.length >= 4}
        onclick={addTeam}
      >
        <span class="text-lg leading-none">＋</span>{text.addTeam}
      </button>
    </div>

    <aside class="flex flex-col justify-between gap-6 rounded-2xl border border-white/8 bg-black/18 p-4 sm:p-5">
      <div>
        <div class="text-xs font-700 tracking-[0.14em] text-slate-500 uppercase">{text.language}</div>
        <div class="mt-3 grid grid-cols-2 rounded-xl bg-black/25 p-1" aria-label={text.language}>
          <button class={`focus-ring cursor-pointer rounded-lg border-0 px-3 py-2.5 text-sm font-700 transition ${locale === 'en' ? 'bg-white text-slate-950 shadow-md' : 'bg-transparent text-slate-500'}`} onclick={() => onLocale('en')}>EN</button>
          <button class={`focus-ring cursor-pointer rounded-lg border-0 px-3 py-2.5 text-sm font-700 transition ${locale === 'de' ? 'bg-white text-slate-950 shadow-md' : 'bg-transparent text-slate-500'}`} onclick={() => onLocale('de')}>DE</button>
        </div>
        <p class="mb-0 mt-4 text-xs leading-5 text-slate-600">{text.practice}</p>
      </div>

      <div class="border-t border-white/8 pt-5">
        <div class="text-[0.65rem] font-700 tracking-[0.14em] text-slate-500 uppercase">{text.howToPlay}</div>
        <ol class="m-0 mt-3 space-y-2.5 p-0 text-xs font-650 text-slate-400">
          <li class="flex items-center gap-2.5"><span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-300/12 text-[0.62rem] text-amber-200">1</span>{text.ruleLetter}</li>
          <li class="flex items-center gap-2.5"><span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300/12 text-[0.62rem] text-emerald-200">2</span>{text.ruleAnswer}</li>
          <li class="flex items-center gap-2.5"><span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fuchsia-300/12 text-[0.62rem] text-fuchsia-200">3</span>{text.ruleRace}</li>
        </ol>
      </div>

      <button
        class="focus-ring group relative w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-amber-300 px-5 py-4 text-base font-750 text-slate-950 shadow-[0_12px_32px_rgb(251_191_36_/_0.2)] transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
        disabled={validTeams.length === 0}
        onclick={start}
      >
        <span class="relative z-1 flex items-center justify-center gap-2">{text.startGame}<span aria-hidden="true" class="transition group-hover:translate-x-1">→</span></span>
      </button>
    </aside>
  </div>
</section>
