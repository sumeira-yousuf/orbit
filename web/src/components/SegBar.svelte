<script>
  import { STATUS_STACK, STATUS } from '../lib/utils.js';
  let { counts = {}, height = 8 } = $props();

  const summary = $derived(
    STATUS_STACK.filter((k) => counts[k]).map((k) => `${counts[k]} ${STATUS[k].label.toLowerCase()}`).join(', ') || 'No tasks'
  );
</script>

<div class="seg" style="height:{height}px" role="img" aria-label={summary}>
  {#each STATUS_STACK as k (k)}
    {#if counts[k]}
      <span style="flex:{counts[k]};background:var(--s-{k})" title="{counts[k]} {STATUS[k].label.toLowerCase()}"></span>
    {/if}
  {/each}
</div>

<style>
  .seg { display: flex; gap: 2px; width: 100%; border-radius: 999px; overflow: hidden; background: var(--surface-3); }
  span { min-width: 3px; transition: flex 0.3s var(--ease); }
</style>
