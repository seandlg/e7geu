<script lang="ts">
  import type { Card } from './game';

  let {
    card,
    compact = false,
    playable = false,
    selected = false,
    onclick,
  }: {
    card: Card;
    compact?: boolean;
    playable?: boolean;
    selected?: boolean;
    onclick?: () => void;
  } = $props();

  const suitDetails = {
    ember: { symbol: '◆', name: 'Ember', color: '#fb7185' },
    tide: { symbol: '●', name: 'Tide', color: '#38bdf8' },
    grove: { symbol: '✦', name: 'Grove', color: '#4ade80' },
    gale: { symbol: '▲', name: 'Gale', color: '#c084fc' },
  } as const;

  const details = $derived(card.kind === 'suit' ? suitDetails[card.suit] : null);
  const label = $derived(cardLabel(card));

  function cardLabel(value: Card): string {
    if (value.kind !== 'suit') return value.kind === 'apex' ? 'Apex' : 'Mote';
    return `${suitDetails[value.suit].name} ${value.rank}`;
  }
</script>

<button
  class:compact
  class:playable
  class:selected
  class:apex={card.kind === 'apex'}
  class:mote={card.kind === 'mote'}
  class="card"
  style:--suit-color={details?.color ?? (card.kind === 'apex' ? '#fbbf24' : '#94a3b8')}
  disabled={!playable || !onclick}
  {onclick}
  aria-label={label}
>
  {#if card.kind === 'suit'}
    <span class="corner"><strong>{card.rank}</strong><small>{details!.symbol}</small></span>
    <span class="sigil">{details!.symbol}</span>
    <span class="corner bottom"><strong>{card.rank}</strong><small>{details!.symbol}</small></span>
  {:else if card.kind === 'apex'}
    <span class="special-mark">✺</span><span class="special-name">Apex</span>
  {:else}
    <span class="special-mark">◌</span><span class="special-name">Mote</span>
  {/if}
</button>

<style>
  .card { position: relative; width: 5.2rem; height: 7.4rem; flex: 0 0 auto; overflow: hidden; border: 1px solid color-mix(in srgb, var(--suit-color) 35%, white 8%); border-radius: 0.9rem; background: linear-gradient(145deg, color-mix(in srgb, var(--suit-color) 14%, #172033), #0c1220 58%); color: var(--suit-color); box-shadow: 0 12px 28px rgb(0 0 0 / .28), inset 0 0 0 2px rgb(255 255 255 / .025); transition: transform .18s ease, border-color .18s ease, filter .18s ease; }
  .card:disabled { opacity: 1; }
  .card.playable { cursor: pointer; }
  .card.playable:hover, .card.playable:focus-visible, .card.selected { transform: translateY(-.45rem); border-color: color-mix(in srgb, var(--suit-color) 75%, white); filter: brightness(1.16); outline: none; }
  .card.playable:focus-visible { box-shadow: 0 0 0 3px rgb(255 255 255 / .24), 0 14px 32px rgb(0 0 0 / .4); }
  .corner { position: absolute; left: .48rem; top: .42rem; display: grid; line-height: 1; text-align: center; }
  .corner strong { font-size: 1rem; }
  .corner small { margin-top: .15rem; font-size: .65rem; }
  .corner.bottom { right: .48rem; bottom: .42rem; left: auto; top: auto; transform: rotate(180deg); }
  .sigil { font-size: 2.2rem; text-shadow: 0 0 24px var(--suit-color); }
  .special-mark { font-size: 3rem; text-shadow: 0 0 28px var(--suit-color); }
  .special-name { position: absolute; bottom: .7rem; font-size: .61rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .apex { background: radial-gradient(circle at 50% 36%, rgb(251 191 36 / .2), transparent 35%), linear-gradient(145deg, #292316, #0c1220); }
  .mote { background: radial-gradient(circle at 50% 36%, rgb(148 163 184 / .13), transparent 35%), linear-gradient(145deg, #1a2230, #0c1220); }
  .compact { width: 3.8rem; height: 5.35rem; border-radius: .68rem; }
  .compact .sigil, .compact .special-mark { font-size: 1.65rem; }
  .compact .corner strong { font-size: .78rem; }
  .compact .special-name { bottom: .45rem; font-size: .48rem; }
</style>
