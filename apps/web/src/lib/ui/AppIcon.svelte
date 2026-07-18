<script lang="ts">
  import type { AppIcon } from '$lib/apps/catalog';

  let { icon, size = 40 }: { icon: AppIcon; size?: number } = $props();
</script>

{#if icon === 'qr'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M7 18V9a2 2 0 0 1 2-2h9M30 7h9a2 2 0 0 1 2 2v9M41 30v9a2 2 0 0 1-2 2h-9M18 41H9a2 2 0 0 1-2-2v-9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14 14h8v8h-8zM27 14h7v7h-7zM14 27h8v7h-8zM27 27h4v4h-4zM34 34h-7v-3M34 24v5" fill="currentColor"/>
  </svg>
{:else if icon === 'speed'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M9 36a19 19 0 1 1 30 0" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M24 11v4M12.5 18l3.5 2M35.5 18 32 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="m24 32 10-10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="24" cy="32" r="4" fill="currentColor"/>
  </svg>
{:else if icon === 'sound'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M8 27v-6M15 33V15M22 38V10M29 34V14M36 30V18M43 27v-6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
  </svg>
{:else if icon === 'color'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="m29 8 11 11-19 19H10V27L29 8Z" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="m25 12 11 11M9 39h31" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
    <path d="m14 28 10 10" stroke="currentColor" stroke-width="3.2"/>
  </svg>
{:else if icon === 'word'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="7" y="8" width="34" height="32" rx="9" stroke="currentColor" stroke-width="3"/>
    <path d="m13 17 4.5 14L24 20l6.5 11L35 17" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11 12h4M33 36h4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
  </svg>
{:else if icon === 'break'}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="26" r="15" stroke="currentColor" stroke-width="3.2"/>
    <path d="M24 26V16m0 10 7 4M18 7h12M24 7v4" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m36 14 3-3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M13 6h15l8 8v28H13a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 6v9h8M17 23h12M17 29h14M17 35h9" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
{/if}
