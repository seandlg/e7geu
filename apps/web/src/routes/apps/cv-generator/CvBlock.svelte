<script lang="ts">
  import type { CvBlock, CvDocument } from './model';

  let { block, cv }: { block: CvBlock; cv: CvDocument } = $props();

  function webHref(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
      return undefined;
    }
  }

  function dateRange(start: string, end: string): string {
    return [start.trim(), end.trim()].filter(Boolean).join(' – ');
  }

  const fallback = $derived(
    cv.settings.language === 'de'
      ? { name: 'Ihr Name', role: 'Position', qualification: 'Abschluss', project: 'Projekt' }
      : { name: 'Your name', role: 'Role', qualification: 'Qualification', project: 'Project' },
  );

  const projectHref = $derived(block.type === 'project' ? webHref(block.item.link) : undefined);
</script>

{#if block.type === 'identity'}
  <header class="identity">
    <div>
      <h1>{cv.basics.name || fallback.name}</h1>
      {#if cv.basics.headline}<p class="headline">{cv.basics.headline}</p>{/if}
    </div>
    <address>
      {#if cv.basics.email}<a href={`mailto:${cv.basics.email}`}>{cv.basics.email}</a>{/if}
      {#if cv.basics.phone}<a href={`tel:${cv.basics.phone.replace(/[^+\d]/g, '')}`}>{cv.basics.phone}</a>{/if}
      {#if cv.basics.location}<span>{cv.basics.location}</span>{/if}
      {#each cv.basics.links as link}
        {@const href = webHref(link.url)}
        {#if link.label.trim() && href}<a {href}>{link.label}</a>{/if}
      {/each}
    </address>
  </header>
{:else if block.type === 'summary'}
  <section>
    <h2>{block.heading}</h2>
    <p class="prose">{cv.basics.summary}</p>
  </section>
{:else if block.type === 'experience'}
  <section>
    {#if block.heading}<h2>{block.heading}</h2>{/if}
    <div class="entry-heading">
      <div><h3>{block.item.role || fallback.role}</h3><p>{block.item.company}</p></div>
      <div class="meta"><span>{dateRange(block.item.start, block.item.end)}</span><span>{block.item.location}</span></div>
    </div>
    {#if block.item.bullets.some((bullet) => bullet.trim())}
      <ul>{#each block.item.bullets as bullet}{#if bullet.trim()}<li>{bullet}</li>{/if}{/each}</ul>
    {/if}
  </section>
{:else if block.type === 'education'}
  <section>
    {#if block.heading}<h2>{block.heading}</h2>{/if}
    <div class="entry-heading">
      <div><h3>{block.item.qualification || fallback.qualification}</h3><p>{block.item.institution}</p></div>
      <div class="meta"><span>{dateRange(block.item.start, block.item.end)}</span><span>{block.item.location}</span></div>
    </div>
    {#if block.item.detail}<p class="prose detail">{block.item.detail}</p>{/if}
  </section>
{:else if block.type === 'skills'}
  <section>
    <h2>{block.heading}</h2>
    <ul class="skills">{#each cv.skills as skill}{#if skill.trim()}<li>{skill}</li>{/if}{/each}</ul>
  </section>
{:else if block.type === 'project'}
  <section>
    {#if block.heading}<h2>{block.heading}</h2>{/if}
    <div class="project-title">
      <h3>{block.item.name || fallback.project}</h3>
      {#if projectHref}<a href={projectHref}>{block.item.link}</a>{/if}
    </div>
    {#if block.item.description}<p class="prose detail">{block.item.description}</p>{/if}
  </section>
{/if}

<style>
  :global(.cv-paper) { color: #172033; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  section, .identity { break-inside: avoid; }
  h1, h2, h3, p { margin: 0; }
  h1 { color: var(--accent); font-size: var(--name-size); line-height: 1; letter-spacing: -0.035em; }
  .headline { margin-top: 2.2mm; color: #475569; font-size: 11pt; }
  .identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-bottom: var(--section-gap); border-bottom: 0.55mm solid var(--accent); }
  address { display: flex; max-width: 72mm; flex-wrap: wrap; justify-content: flex-end; gap: 1.4mm 3.2mm; color: #475569; font-size: 8.7pt; font-style: normal; line-height: 1.35; text-align: right; }
  a { color: inherit; text-decoration: none; }
  h2 { margin-bottom: var(--heading-gap); color: var(--accent); font-size: 8.4pt; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
  h3 { font-size: 10.6pt; line-height: 1.25; }
  .prose, li, .entry-heading p, .meta, .project-title a { font-size: var(--body-size); line-height: var(--line-height); }
  .prose { color: #334155; white-space: pre-line; }
  .entry-heading, .project-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .entry-heading p { margin-top: 0.5mm; color: #475569; }
  .meta { display: grid; flex: none; color: #64748b; text-align: right; }
  ul { margin: 2.2mm 0 0; padding-left: 4.5mm; color: #334155; }
  li + li { margin-top: 1mm; }
  .detail { margin-top: 1.6mm; }
  .project-title a { color: var(--accent); }
  .skills { display: flex; flex-wrap: wrap; gap: 1.5mm 4mm; margin: 0; padding: 0; list-style: none; }
  .skills li { color: #334155; }
  .skills li:not(:last-child)::after { margin-left: 4mm; color: var(--accent); content: '•'; }

  :global(.cv-paper[data-template='modern']) .identity { padding: 6mm; border: 0; background: color-mix(in srgb, var(--accent) 10%, white); }
  :global(.cv-paper[data-template='modern']) h2 { padding-left: 2.5mm; border-left: 1mm solid var(--accent); letter-spacing: 0.08em; }
  :global(.cv-paper[data-template='modern']) .skills li { padding: 1mm 2.3mm; border-radius: 99px; background: #eef2f7; }
  :global(.cv-paper[data-template='modern']) .skills li::after { display: none; }
</style>
