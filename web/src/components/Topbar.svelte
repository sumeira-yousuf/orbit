<script>
  import Icon from './Icon.svelte';
  import Search from './Search.svelte';
  import { ui, openNewTask } from '../lib/state.svelte.js';
  import { route, matchRoute } from '../lib/router.svelte.js';

  const projectId = $derived(matchRoute(route.path).id);
</script>

<header class="top">
  <button class="btn btn-ghost btn-icon menu" aria-label="Open menu" onclick={() => (ui.menuOpen = true)}><Icon name="menu" size={20} /></button>
  <Search />
  <span class="spacer"></span>
  <button class="btn btn-primary" onclick={() => openNewTask({ projectId })}><Icon name="plus" size={16} stroke={2.4} />New task</button>
</header>

<style>
  .top {
    position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 12px; height: 58px; padding: 0 32px;
    background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .menu { display: none; margin-left: -8px; }
  @media (max-width: 900px) { .top { padding: 0 16px; } .menu { display: inline-flex; } }
</style>
