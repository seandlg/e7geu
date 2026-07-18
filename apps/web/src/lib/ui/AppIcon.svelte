<script lang="ts">
  import type { AppIcon } from '$lib/apps/catalog';

  let { icon, size = 40 }: { icon: AppIcon; size?: number } = $props();
</script>

{#if icon === 'qr'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M7 18V9a2 2 0 0 1 2-2h9M30 7h9a2 2 0 0 1 2 2v9M41 30v9a2 2 0 0 1-2 2h-9M18 41H9a2 2 0 0 1-2-2v-9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14 14h8v8h-8zM27 14h7v7h-7zM14 27h8v7h-8zM27 27h4v4h-4zM34 34h-7v-3M34 24v5" fill="currentColor"/>
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M9 36a19 19 0 1 1 30 0" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M24 11v4M12.5 18l3.5 2M35.5 18 32 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="m24 32 10-10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="24" cy="32" r="4" fill="currentColor"/>
  </svg>
{/if}
