<script>
  import Avatar from './Avatar.svelte';
  let { people = [], max = 4, size = 26 } = $props();
  const shown = $derived(people.slice(0, max));
  const extra = $derived(Math.max(0, people.length - max));
</script>

<span class="avstack" style="--s:{size}px">
  {#each shown as p (p.id)}
    <Avatar name={p.name} color={p.color} {size} ring />
  {/each}
  {#if extra}<span class="more" style="--s:{size}px" title="{extra} more">+{extra}</span>{/if}
</span>

<style>
  .avstack { display: inline-flex; align-items: center; }
  .avstack :global(.av + .av), .avstack :global(.av + .more) { margin-left: calc(var(--s, 26px) * -0.13); }
  .more {
    display: inline-flex; align-items: center; justify-content: center; width: var(--s); height: var(--s);
    border-radius: 50%; background: var(--surface-3); color: var(--text-2); font-size: 11px; font-weight: 700;
    box-shadow: 0 0 0 2px var(--surface);
  }
</style>
