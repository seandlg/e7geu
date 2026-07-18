<script lang="ts">
  import type { GameCopy } from './content';
  import { boardPath, finishPosition, type Game } from './game';
  import { teamTheme } from './theme';

  let { game, text }: { game: Game; text: GameCopy } = $props();
  const currentTeam = $derived(game.teams[game.currentTeamIndex]);

  function tileBackground(position: number): string {
    const hue = 198 + (position / finishPosition) * 118;
    return `linear-gradient(145deg, hsl(${hue} 62% 22% / .94), hsl(${hue + 8} 66% 13% / .96))`;
  }
</script>

<section class="rounded-[1.75rem] border border-white/10 bg-slate-950/52 p-2.5 shadow-[0_24px_70px_rgb(0_0_0_/_0.28)] backdrop-blur-xl sm:p-4" aria-label={text.board}>
  <div class="grid aspect-square grid-cols-5 grid-rows-5 gap-1.5 sm:gap-2.5">
    {#each boardPath as tile (tile.position)}
      {@const teamsHere = game.teams.filter((team) => team.position === tile.position)}
      <div
        class={`relative isolate flex min-w-0 items-center justify-center overflow-hidden rounded-[0.8rem] border border-white/8 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.07)] sm:rounded-2xl ${teamsHere.some((team) => team.id === currentTeam?.id) ? 'ring-2 ring-white/55' : ''}`}
        style:grid-row={tile.row}
        style:grid-column={tile.column}
        style:background={tileBackground(tile.position)}
        aria-label={`${tile.label ? text[tile.label] : `${text.position} ${tile.position}`} ${tile.seconds ? `· ${tile.seconds} ${text.seconds}` : ''}`}
      >
        <span class="absolute left-1.5 top-1 text-[0.5rem] font-750 tabular-nums text-white/28 sm:left-2 sm:top-1.5 sm:text-[0.62rem]">{tile.position}</span>
        {#if tile.seconds}
          <span class="absolute right-1.5 top-1 text-[0.5rem] font-750 tabular-nums text-white/42 sm:right-2 sm:top-1.5 sm:text-[0.62rem]">{tile.seconds}s</span>
        {/if}

        {#if teamsHere.length > 0}
          <div class="relative z-2 flex max-w-full flex-wrap items-center justify-center gap-x-0.5 px-1 pt-2 sm:gap-x-1">
            {#each teamsHere as team (team.id)}
              {@const theme = teamTheme(team.palette)}
              <span
                class={`grid place-items-center rounded-full border shadow-lg transition duration-300 ${teamsHere.length > 1 ? 'h-5.5 w-5.5 text-xs sm:h-8 sm:w-8 sm:text-base' : 'h-7 w-7 text-base sm:h-10 sm:w-10 sm:text-xl'}`}
                class:scale-110={team.id === currentTeam?.id}
                style:background={`linear-gradient(145deg,${theme.accent},${theme.deep})`}
                style:border-color={`${theme.accent}cc`}
                style:box-shadow={`0 5px 18px ${theme.glow}`}
                title={team.name}
                aria-label={`${team.name}, ${text.position} ${team.position}`}
              >{team.emoji}</span>
            {/each}
          </div>
        {:else if tile.label}
          <span class="px-1 pt-2 text-center text-[0.52rem] font-800 tracking-[0.08em] text-white/65 uppercase sm:text-xs">{text[tile.label]}</span>
        {:else}
          <span class="h-1.5 w-1.5 rounded-full bg-white/12"></span>
        {/if}

        <div class="pointer-events-none absolute inset-x-2 bottom-1 h-px bg-white/8"></div>
      </div>
    {/each}
  </div>
</section>
