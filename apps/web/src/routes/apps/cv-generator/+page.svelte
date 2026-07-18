<script lang="ts">
  import { onMount } from 'svelte';
  import AppHeader from '$lib/ui/AppHeader.svelte';
  import CvEditor from './CvEditor.svelte';
  import CvPreview from './CvPreview.svelte';
  import { openCv, saveCv, supportsWritableFiles, type OpenedCv } from './files';
  import { createBlankCv, createExampleCv, type CvDocument } from './model';
  import { printCv } from './print';

  let cv: CvDocument = $state(createExampleCv());
  let fileHandle: OpenedCv['handle'] = $state(null);
  let filename = $state('Not saved yet');
  let dirty = $state(true);
  let busy = $state(false);
  let error = $state('');
  let pageCount = $state(1);
  let hasOverflow = $state(false);
  let mobileView: 'build' | 'preview' = $state('build');
  let writableFiles = $state(false);
  let newMenu = $state<HTMLDetailsElement>();

  function changeDocument(next: CvDocument): void {
    cv = next;
    dirty = true;
    error = '';
  }

  function updateLayout(pages: number, overflow: boolean): void {
    pageCount = pages;
    hasOverflow = overflow;
  }

  function canReplace(): boolean {
    return !dirty || window.confirm('Discard the changes in the current CV?');
  }

  function newDocument(example: boolean): void {
    if (!canReplace()) return;
    cv = example ? createExampleCv() : createBlankCv();
    fileHandle = null;
    filename = 'Not saved yet';
    dirty = true;
    error = '';
    if (newMenu) newMenu.open = false;
  }

  async function openDocument(): Promise<void> {
    if (!canReplace()) return;
    busy = true;
    error = '';
    try {
      const opened = await openCv();
      if (!opened) return;
      cv = opened.document;
      fileHandle = opened.handle;
      filename = opened.filename;
      dirty = false;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'The CV could not be opened.';
    } finally {
      busy = false;
    }
  }

  async function saveDocument(saveAs = false): Promise<void> {
    busy = true;
    error = '';
    try {
      const saved = await saveCv(cv, fileHandle, saveAs);
      if (!saved) return;
      fileHandle = saved.handle;
      filename = saved.filename;
      dirty = false;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'The CV could not be saved.';
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    writableFiles = supportsWritableFiles();
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (!dirty) return;
      event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveDocument(event.shiftKey);
      } else if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openDocument();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', keyboard);
    };
  });
</script>

<svelte:head>
  <title>CV Generator — e7g.eu</title>
  <meta name="description" content="Create and print a polished CV entirely in your browser." />
</svelte:head>

<main class="cv-app min-h-dvh">
  <header class="app-toolbar">
    <AppHeader title="CV Generator" subtitle="Private, precise, printable" icon="cv" />
    <div class="document-state" title={filename}>
      <span class:dirty></span><div><strong>{cv.title || 'Untitled CV'}</strong><small>{dirty ? 'Unsaved changes' : filename}</small></div>
    </div>
    <div class="file-actions">
      <details class="mobile-file-menu">
        <summary>File</summary>
        <div>
          <button type="button" onclick={() => newDocument(false)}>New blank CV</button>
          <button type="button" onclick={() => newDocument(true)}>New example CV</button>
          <button type="button" onclick={() => void openDocument()} disabled={busy}>Open file</button>
          <button type="button" onclick={() => void saveDocument()} disabled={busy}>{writableFiles ? 'Save' : 'Download copy'}</button>
          {#if writableFiles}<button type="button" onclick={() => void saveDocument(true)} disabled={busy}>Save as</button>{/if}
        </div>
      </details>
      <details class="new-menu" bind:this={newMenu}>
        <summary>New <span aria-hidden="true">▾</span></summary>
        <div><button type="button" onclick={() => newDocument(false)}>Blank CV</button><button type="button" onclick={() => newDocument(true)}>Example CV</button></div>
      </details>
      <button type="button" onclick={() => void openDocument()} disabled={busy}>Open</button>
      <button type="button" onclick={() => void saveDocument()} disabled={busy}>{writableFiles ? 'Save' : 'Download'}</button>
      {#if writableFiles}<button type="button" onclick={() => void saveDocument(true)} disabled={busy}>Save as</button>{/if}
      <button class="print-button" type="button" onclick={() => printCv(cv.settings.paper)}>Print / PDF</button>
    </div>
  </header>

  {#if error}<div class="error-banner" role="alert">{error}<button type="button" aria-label="Dismiss error" onclick={() => (error = '')}>×</button></div>{/if}

  <nav class="mobile-tabs" aria-label="CV workspace">
    <button class:active={mobileView === 'build'} type="button" onclick={() => (mobileView = 'build')}>Build</button>
    <button class:active={mobileView === 'preview'} type="button" onclick={() => (mobileView = 'preview')}>Preview <span>{pageCount}</span></button>
  </nav>

  <div class="workspace-grid">
    <aside class:hidden-mobile={mobileView !== 'build'} class="editor-shell" aria-label="CV editor">
      <CvEditor {cv} onChange={changeDocument} />
      <p class="file-note">{writableFiles ? 'Open and save .cv.json files directly on this device.' : 'This browser downloads .cv.json copies. Use Open to continue editing one.'}</p>
    </aside>
    <section class:hidden-mobile={mobileView !== 'preview'} class="preview-shell" aria-label="CV preview">
      <div class="preview-toolbar"><span>{pageCount} {pageCount === 1 ? 'page' : 'pages'} · {cv.settings.paper === 'a4' ? 'A4' : 'US Letter'}</span>{#if hasOverflow}<strong>Content overflow — shorten an entry or use compact density</strong>{:else}<small>Ready to print</small>{/if}</div>
      <CvPreview {cv} onLayout={updateLayout} />
    </section>
  </div>
</main>

<style>
  .cv-app { display: flex; height: 100dvh; min-height: 100dvh; overflow: hidden; flex-direction: column; }
  .app-toolbar { display: grid; grid-template-columns: auto minmax(10rem, 1fr) auto; align-items: center; gap: 20px; min-height: 76px; border-bottom: 1px solid rgb(255 255 255 / 0.09); background: rgb(7 17 31 / 0.9); padding: 12px 20px; backdrop-filter: blur(18px); }
  .document-state { display: flex; min-width: 0; align-items: center; justify-self: center; gap: 9px; color: white; }
  .document-state > span { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #34d399; }
  .document-state > span.dirty { background: #fbbf24; }
  .document-state div { display: grid; min-width: 0; }
  .document-state strong, .document-state small { overflow: hidden; max-width: 28vw; text-overflow: ellipsis; white-space: nowrap; }
  .document-state strong { font-size: 0.82rem; }
  .document-state small { color: #64748b; font-size: 0.68rem; }
  .file-actions { display: flex; align-items: center; gap: 6px; }
  .file-actions button, .new-menu summary, .mobile-tabs button { cursor: pointer; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 10px; background: rgb(255 255 255 / 0.055); padding: 8px 11px; color: #cbd5e1; font: inherit; font-size: 0.78rem; font-weight: 700; }
  .file-actions button:hover, .new-menu summary:hover, .new-menu[open] summary { background: rgb(255 255 255 / 0.1); color: white; }
  .file-actions button:disabled { cursor: default; opacity: 0.4; }
  .file-actions .print-button { border-color: transparent; background: #7dd3fc; color: #082f49; }
  .new-menu { position: relative; }
  .new-menu summary { display: flex; align-items: center; gap: 4px; list-style: none; }
  .new-menu summary::-webkit-details-marker { display: none; }
  .new-menu[open] summary span { transform: rotate(180deg); }
  .mobile-file-menu { position: relative; display: none; }
  .mobile-file-menu summary { cursor: pointer; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 10px; background: rgb(255 255 255 / 0.055); padding: 8px 11px; color: #cbd5e1; font-size: 0.75rem; font-weight: 700; list-style: none; }
  .mobile-file-menu summary::-webkit-details-marker { display: none; }
  .mobile-file-menu > div { position: absolute; top: calc(100% + 5px); right: 0; z-index: 30; display: grid; min-width: 160px; border: 1px solid rgb(255 255 255 / 0.12); border-radius: 11px; background: #0f1b2e; padding: 5px; box-shadow: 0 16px 40px rgb(0 0 0 / 0.4); }
  .mobile-file-menu:not([open]) > div { display: none; }
  .mobile-file-menu > div button { border: 0; text-align: left; }
  .new-menu > div { position: absolute; top: calc(100% + 5px); right: 0; z-index: 20; display: grid; min-width: 130px; border: 1px solid rgb(255 255 255 / 0.12); border-radius: 11px; background: #0f1b2e; padding: 5px; box-shadow: 0 16px 40px rgb(0 0 0 / 0.4); }
  .new-menu:not([open]) > div { display: none; }
  .new-menu > div button { border: 0; text-align: left; }
  .workspace-grid { display: grid; min-height: 0; overflow: hidden; flex: 1; grid-template-columns: minmax(320px, 430px) minmax(0, 1fr); }
  .editor-shell { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; border-right: 1px solid rgb(255 255 255 / 0.09); background: rgb(7 17 31 / 0.72); }
  .file-note { margin: 4px 22px 24px; color: #475569; font-size: 0.68rem; line-height: 1.5; }
  .preview-shell { min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; background: #182235; padding: 20px 20px 48px; }
  .preview-toolbar { display: flex; max-width: 900px; align-items: center; justify-content: space-between; gap: 14px; margin: 0 auto 18px; color: #94a3b8; font-size: 0.72rem; }
  .preview-toolbar strong { color: #fda4af; text-align: right; }
  .preview-toolbar small { color: #6ee7b7; }
  .error-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #9f1239; padding: 9px 18px; color: white; font-size: 0.78rem; }
  .error-banner button { cursor: pointer; border: 0; background: none; color: white; font-size: 1.2rem; }
  .mobile-tabs { display: none; }

  @media (max-width: 900px) {
    .app-toolbar { grid-template-columns: 1fr auto; }
    .document-state { display: none; }
    .file-actions > :not(.print-button, .mobile-file-menu) { display: none; }
    .mobile-file-menu { display: block; }
    .workspace-grid { display: block; }
    .editor-shell, .preview-shell { height: calc(100dvh - 132px); }
    .editor-shell { border: 0; }
    .mobile-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid rgb(255 255 255 / 0.08); background: #081321; padding: 6px; }
    .mobile-tabs button { border: 0; background: transparent; }
    .mobile-tabs button.active { background: rgb(125 211 252 / 0.13); color: #bae6fd; }
    .mobile-tabs span { margin-left: 4px; border-radius: 99px; background: rgb(255 255 255 / 0.08); padding: 1px 5px; }
    .hidden-mobile { display: none; }
  }

  @media print {
    :global(html), :global(body) { min-width: 0 !important; background: white !important; }
    :global(body) { overflow: visible !important; }
    :global(body::before) { display: none !important; }
    .cv-app { display: block; height: auto; min-height: 0; overflow: visible; }
    .app-toolbar, .error-banner, .mobile-tabs, .editor-shell, .preview-toolbar { display: none !important; }
    .workspace-grid, .preview-shell { display: block; height: auto; overflow: visible; background: white; padding: 0; }
  }
</style>
