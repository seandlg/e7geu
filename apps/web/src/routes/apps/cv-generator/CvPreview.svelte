<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CvPaper from './CvPaper.svelte';
  import { buildBlocks, type CvBlock, type CvDocument } from './model';
  import { paginateBlocks, type PageLayout } from './pagination';

  let { cv, onLayout }: { cv: CvDocument; onLayout?: (pages: number, overflow: boolean) => void } = $props();
  let viewport = $state<HTMLDivElement>();
  let measurePaper = $state<HTMLElement>();
  let scale = $state(1);
  let scaledPageHeight = $state(0);
  let layouts: PageLayout[] = $state([]);
  const blocks = $derived(buildBlocks(cv));
  const blockMap = $derived(new Map(blocks.map((block) => [block.id, block])));
  const pages = $derived(
    layouts.length
      ? layouts.map((layout) => ({
          ...layout,
          blocks: layout.blockIds.map((id) => blockMap.get(id)).filter(Boolean) as CvBlock[],
        }))
      : [{ blockIds: blocks.map((block) => block.id), overflow: false, blocks }],
  );

  $effect(() => {
    JSON.stringify(cv);
    void measure();
  });

  async function measure(): Promise<void> {
    await tick();
    await document.fonts?.ready;
    await tick();
    if (!measurePaper) return;
    const content = measurePaper.querySelector<HTMLElement>('.page-content');
    if (!content) return;
    const gap = Number.parseFloat(getComputedStyle(content).rowGap) || 0;
    const padding = Number.parseFloat(getComputedStyle(content).paddingTop) * 2;
    const capacity = measurePaper.clientHeight - padding;
    const measured = [...measurePaper.querySelectorAll<HTMLElement>('[data-block-id]')].map((element) => ({
      id: element.dataset.blockId ?? '',
      height: element.getBoundingClientRect().height,
    }));
    layouts = paginateBlocks(measured, capacity, gap);
    updateScale();
    onLayout?.(layouts.length, layouts.some((page) => page.overflow));
  }

  function updateScale(): void {
    if (!viewport || !measurePaper) return;
    scale = Math.min(1, (viewport.clientWidth - 32) / measurePaper.clientWidth);
    scaledPageHeight = measurePaper.clientHeight * scale;
  }

  onMount(() => {
    const observer = new ResizeObserver(updateScale);
    if (viewport) observer.observe(viewport);
    updateScale();
    return () => observer.disconnect();
  });
</script>

<div class="preview" bind:this={viewport}>
  <div class="measure-host" aria-hidden="true">
    <div bind:this={measurePaper}><CvPaper {cv} {blocks} measurable /></div>
  </div>
  <div class="pages">
    {#each pages as page, index}
      <div class="page-slot" style={`--scale:${scale};height:${scaledPageHeight}px`}>
        <div class="scaled-paper"><CvPaper {cv} blocks={page.blocks} pageNumber={index + 1} overflow={page.overflow} /></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .preview { position: relative; min-width: 0; }
  .measure-host { position: fixed; left: -200vw; top: 0; z-index: -1; visibility: hidden; }
  .pages { display: grid; justify-items: center; gap: 28px; }
  .page-slot { width: 100%; }
  .scaled-paper { width: max-content; margin: 0 auto; transform: scale(var(--scale)); transform-origin: top center; }
  @media print {
    .preview, .pages, .page-slot, .scaled-paper { display: block; width: auto; height: auto !important; margin: 0; transform: none; }
    .pages { gap: 0; }
    .measure-host { display: none; }
  }
</style>
