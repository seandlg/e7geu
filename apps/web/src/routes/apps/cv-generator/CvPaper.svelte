<script lang="ts">
  import CvBlockView from './CvBlock.svelte';
  import type { CvBlock, CvDocument } from './model';

  let {
    cv,
    blocks,
    pageNumber,
    overflow = false,
    measurable = false,
  }: {
    cv: CvDocument;
    blocks: CvBlock[];
    pageNumber?: number;
    overflow?: boolean;
    measurable?: boolean;
  } = $props();

  const dimensions = $derived(
    cv.settings.paper === 'a4'
      ? { width: '210mm', height: '297mm', padding: '16mm' }
      : { width: '8.5in', height: '11in', padding: '0.62in' },
  );
</script>

<article
  class="cv-paper"
  class:measureable={measurable}
  class:overflow
  data-template={cv.settings.template}
  data-density={cv.settings.density}
  lang={cv.settings.language}
  style={`--paper-width:${dimensions.width};--paper-height:${dimensions.height};--paper-padding:${dimensions.padding};--accent:${cv.settings.accent}`}
  aria-label={pageNumber ? (cv.settings.language === 'de' ? `Lebenslauf, Seite ${pageNumber}` : `CV page ${pageNumber}`) : undefined}
>
  <div class="page-content">
    {#each blocks as block (block.id)}
      <div class="cv-block" data-block-id={block.id}><CvBlockView {block} {cv} /></div>
    {/each}
  </div>
</article>

<style>
  .cv-paper {
    --body-size: 9.4pt;
    --line-height: 1.45;
    --name-size: 26pt;
    --block-gap: 5.2mm;
    --section-gap: 4.5mm;
    --heading-gap: 2.2mm;
    position: relative;
    width: var(--paper-width);
    height: var(--paper-height);
    overflow: hidden;
    background: white;
    box-shadow: 0 22px 70px rgb(0 0 0 / 0.3);
    print-color-adjust: exact;
  }
  .cv-paper[data-density='relaxed'] { --body-size: 10pt; --line-height: 1.52; --block-gap: 6.4mm; --section-gap: 5.3mm; }
  .cv-paper[data-density='compact'] { --body-size: 8.7pt; --line-height: 1.36; --block-gap: 4mm; --section-gap: 3.6mm; --heading-gap: 1.7mm; }
  .page-content { display: flex; height: 100%; flex-direction: column; gap: var(--block-gap); padding: var(--paper-padding); }
  .overflow::after { position: absolute; inset: 2mm; border: 1mm dashed #e11d48; content: ''; pointer-events: none; }
  @media print {
    .cv-paper { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
    .cv-paper:last-child { break-after: auto; page-break-after: auto; }
    .overflow::after { display: none; }
  }
</style>
