<script>
  import { initials } from '../lib/utils.js';
  let { name = '', color = '#7a8c98', size = 26, ring = false } = $props();
</script>

{#if name}
  <span class="av" class:ring title={name} style="--s:{size}px;background:{color}">{initials(name)}</span>
{:else}
  <span class="av unassigned" class:ring title="Unassigned" style="--s:{size}px" aria-label="Unassigned"></span>
{/if}

<style>
  .av {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    width: var(--s); height: var(--s); border-radius: 50%;
    color: #fff; font-weight: 700; font-size: calc(var(--s) * 0.4); letter-spacing: 0.01em; user-select: none;
  }
  .av.unassigned { background: transparent; border: 1.5px dashed var(--line-strong); }
  .ring { box-shadow: 0 0 0 2px var(--surface); }
</style>
