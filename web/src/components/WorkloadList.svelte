<script>
  import Avatar from './Avatar.svelte';
  let { rows = [], unassigned = 0 } = $props();
  const maxOpen = $derived(Math.max(1, ...rows.map((r) => r.open), unassigned));
</script>

<ul>
  {#each rows as r (r.id)}
    <li>
      <Avatar name={r.name} color={r.color} size={28} />
      <div class="main">
        <div class="top">
          <span class="name truncate">{r.name}</span>
          <span class="meta num">
            {r.open} open{#if r.hours} <span class="muted">({Math.round(r.hours)}h)</span>{/if}
            {#if r.overdue}<span class="chip danger">{r.overdue} late</span>{/if}
          </span>
        </div>
        <div class="track"><div class="fill" style="width:{(r.open / maxOpen) * 100}%;background:{r.overdue ? 'var(--p-high)' : r.color}"></div></div>
      </div>
    </li>
  {/each}
  {#if unassigned}
    <li>
      <Avatar name="" size={28} />
      <div class="main">
        <div class="top">
          <span class="name muted">Unassigned</span>
          <span class="meta num">{unassigned} open</span>
        </div>
        <div class="track"><div class="fill" style="width:{(unassigned / maxOpen) * 100}%;background:var(--line-strong)"></div></div>
      </div>
    </li>
  {/if}
</ul>

<style>
  ul { display: grid; gap: 14px; }
  li { display: flex; align-items: center; gap: 11px; }
  .main { flex: 1; min-width: 0; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 5px; }
  .name { font-weight: 600; font-size: 13.5px; }
  .meta { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-2); white-space: nowrap; }
  .track { height: 6px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
  .fill { height: 100%; border-radius: 99px; min-width: 4px; transition: width 0.4s var(--ease); }
</style>
