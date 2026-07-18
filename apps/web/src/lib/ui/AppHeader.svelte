<script lang="ts">
  import AppIcon from './AppIcon.svelte';
  import type { AppIcon as IconName } from '$lib/apps/catalog';

  let { title, subtitle, icon }: { title: string; subtitle: string; icon: IconName } = $props();
</script>

<header class="flex items-center gap-4">
  <a class="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/8 text-white no-underline transition hover:bg-white/14" href="/" aria-label="Back to all tools">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>
  <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-white"><AppIcon {icon} size={29} /></div>
  <div class="min-w-0">
    <h1 class="m-0 text-xl font-700 tracking-tight sm:text-2xl">{title}</h1>
    <p class="m-0 mt-0.5 truncate text-sm text-slate-400">{subtitle}</p>
  </div>
</header>
