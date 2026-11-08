<script>
  import Icon from './Icon.svelte';
  import { api } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';

  let q = $state('');
  let results = $state([]);
  let open = $state(false);
  let idx = $state(0);
  let input = $state();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  $effect(() => {
    const term = q.trim();
    if (!term) { results = []; return; }
    const timer = setTimeout(async () => {
      try {
        results = (await api.get(`/search?q=${encodeURIComponent(term)}`)).tasks;
        idx = 0;
      } catch { results = []; }
    }, 180);
    return () => clearTimeout(timer);
  });

  function choose(t) {
    open = false;
    q = '';
    input?.blur();
    navigate(`/projects/${t.project_id}/board?task=${t.id}`);
  }

  function onkey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(results.length - 1, idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); }
    else if (e.key === 'Enter' && results[idx]) { e.preventDefault(); choose(results[idx]); }
    else if (e.key === 'Escape') { open = false; input?.blur(); }
  }
</script>

<svelte:window onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input?.focus(); } }} />

<div class="search">
  <Icon name="search" size={16} />
  <input
    bind:this={input} bind:value={q} type="search" placeholder="Search tasks" aria-label="Search tasks" autocomplete="off"
    onfocus={() => (open = true)} onblur={() => setTimeout(() => (open = false), 120)} onkeydown={onkey}
  />
  <span class="kbd">{isMac ? '⌘ K' : 'Ctrl K'}</span>

  {#if open && q.trim()}
    <div class="pop" role="listbox">
      {#each results as t, i (t.id)}
        <button class="res" class:on={i === idx} role="option" aria-selected={i === idx} onmousedown={(e) => e.preventDefault()} onclick={() => choose(t)}>
          <span class="ref" style="color:{t.project_color}">{t.ref}</span>
          <span class="truncate">{t.title}</span>
          <span class="muted proj truncate">{t.project_name}</span>
        </button>
      {:else}
        <p class="none">No tasks match “{q.trim()}”.</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search { position: relative; display: flex; align-items: center; gap: 8px; width: min(420px, 100%); height: 36px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 9px; background: var(--surface); color: var(--text-3); }
  .search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-50); }
  input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--text); }
  input::-webkit-search-cancel-button { display: none; }
  .pop { position: absolute; z-index: 30; top: 42px; left: 0; right: 0; max-height: 340px; overflow-y: auto; padding: 6px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--float); }
  .res { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; text-align: left; font-size: 13.5px; }
  .res.on, .res:hover { background: var(--surface-3); }
  .ref { font-weight: 700; font-size: 12.5px; }
  .proj { font-size: 12px; max-width: 120px; }
  .none { padding: 12px; color: var(--text-3); font-size: 13.5px; }
  @media (max-width: 700px) { .kbd { display: none; } }
</style>
