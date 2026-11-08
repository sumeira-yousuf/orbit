<script>
  import Icon from './Icon.svelte';
  import Avatar from './Avatar.svelte';
  import { auth, signOut, projectsState, ui } from '../lib/state.svelte.js';
  import { route, navigate } from '../lib/router.svelte.js';

  const nav = [
    { href: '/', label: 'Dashboard', icon: 'grid' },
    { href: '/tasks', label: 'My tasks', icon: 'check-square' },
    { href: '/projects', label: 'All projects', icon: 'folder' },
  ];
  const isActive = (href) => route.path.replace(/\/+$/, '') === href || (href === '/' && route.path === '/');
  const shown = $derived(projectsState.list.filter((p) => p.status !== 'archived').slice(0, 12));
  const activeProjectId = $derived(Number(route.path.match(/^\/projects\/(\d+)/)?.[1] ?? 0));

  function out() {
    signOut();
    navigate('/login');
  }

  $effect(() => {
    route.path;
    ui.menuOpen = false;
  });
</script>

{#if ui.menuOpen}<button class="scrim" aria-label="Close menu" onclick={() => (ui.menuOpen = false)}></button>{/if}

<aside class="side" class:open={ui.menuOpen}>
  <a class="brand" href="/" aria-label="Orbit home">
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" stroke-width="3" />
      <circle cx="25.2" cy="8.6" r="4.2" fill="#3fd3bd" />
    </svg>
    <span>Orbit</span>
  </a>

  <nav aria-label="Main">
    {#each nav as n (n.href)}
      <a href={n.href} class="item" class:active={isActive(n.href)} aria-current={isActive(n.href) ? 'page' : undefined}>
        <Icon name={n.icon} size={18} />{n.label}
      </a>
    {/each}
  </nav>

  <div class="section">
    <span>Projects</span>
    <button class="add" aria-label="New project" title="New project" onclick={() => (ui.newProject = true)}><Icon name="plus" size={15} stroke={2.2} /></button>
  </div>
  <div class="projects">
    {#each shown as p (p.id)}
      <a href="/projects/{p.id}" class="item small" class:active={activeProjectId === p.id}>
        <i class="sq" style="background:{p.color}"></i>
        <span class="truncate grow">{p.name}</span>
        <i class="dot" style="background:var(--h-{p.health})" title="{p.health.replace('_', ' ')}"></i>
      </a>
    {:else}
      {#if projectsState.loaded}<p class="none">No projects yet</p>{/if}
    {/each}
  </div>

  {#if auth.user}
    <div class="me">
      <Avatar name={auth.user.name} color={auth.user.color} size={32} />
      <a href="/settings" class="who">
        <b class="truncate">{auth.user.name}</b>
        <span class="truncate">{auth.user.title || auth.user.email}</span>
      </a>
      <a href="/settings" class="icon" aria-label="Settings" title="Settings"><Icon name="sliders" size={17} /></a>
      <button class="icon" aria-label="Sign out" title="Sign out" onclick={out}><Icon name="logout" size={17} /></button>
    </div>
  {/if}
</aside>

<style>
  .side {
    position: sticky; top: 0; height: 100vh; width: 248px; flex: none; display: flex; flex-direction: column;
    background: var(--side); color: var(--side-text); padding: 18px 12px 12px; overflow-y: auto;
  }
  .brand { display: flex; align-items: center; gap: 10px; padding: 2px 8px 18px; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  nav { display: grid; gap: 2px; }
  .item {
    display: flex; align-items: center; gap: 11px; height: 36px; padding: 0 10px; border-radius: 8px;
    color: var(--side-text); font-weight: 600; transition: background 0.12s, color 0.12s;
  }
  .item:hover { background: var(--side-2); color: #fff; }
  .item.active { background: var(--side-3); color: #fff; }
  .item.active :global(svg) { color: #3fd3bd; }
  .section { display: flex; align-items: center; justify-content: space-between; margin: 22px 10px 6px; font-size: 12.5px; font-weight: 600; color: #6f8a9b; }
  .add { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: #8aa3b3; }
  .add:hover { background: var(--side-2); color: #fff; }
  .projects { display: grid; gap: 1px; }
  .item.small { height: 32px; font-size: 13.5px; font-weight: 500; }
  .sq { width: 10px; height: 10px; border-radius: 3px; flex: none; margin: 0 3px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; opacity: 0.9; }
  .none { padding: 6px 10px; font-size: 13px; color: #6f8a9b; }
  .me { margin-top: auto; display: flex; align-items: center; gap: 4px; padding: 14px 4px 0; border-top: 1px solid var(--side-2); }
  .who { flex: 1; min-width: 0; display: grid; margin-left: 6px; line-height: 1.3; }
  .who b { color: #fff; font-size: 13.5px; }
  .who span { font-size: 12px; color: #7f98a8; }
  .icon { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #8aa3b3; }
  .icon:hover { background: var(--side-2); color: #fff; }
  .scrim { display: none; }

  @media (max-width: 900px) {
    .side { position: fixed; z-index: 50; left: 0; top: 0; transform: translateX(-100%); transition: transform 0.2s var(--ease); box-shadow: var(--float); }
    .side.open { transform: none; }
    .scrim { display: block; position: fixed; inset: 0; z-index: 49; border: 0; background: rgba(13, 30, 43, 0.5); }
  }
</style>
