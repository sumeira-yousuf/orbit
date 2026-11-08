<script>
  import Icon from '../components/Icon.svelte';
  import SegBar from '../components/SegBar.svelte';
  import HealthPill from '../components/HealthPill.svelte';
  import AvatarStack from '../components/AvatarStack.svelte';
  import { projectsState, bus, ui, refreshProjects } from '../lib/state.svelte.js';
  import { PROJECT_STATUS, fmtDate, todayStr, diffDays, plural } from '../lib/utils.js';
  import { untrack } from 'svelte';

  const today = todayStr();
  let filter = $state('open');
  let q = $state('');

  $effect(() => { bus.v; untrack(refreshProjects); });

  const FILTERS = [
    { id: 'open', label: 'Open', test: (p) => p.status === 'active' || p.status === 'planning' || p.status === 'on_hold' },
    { id: 'completed', label: 'Completed', test: (p) => p.status === 'completed' },
    { id: 'archived', label: 'Archived', test: (p) => p.status === 'archived' },
    { id: 'all', label: 'All', test: () => true },
  ];
  const list = $derived(
    projectsState.list.filter((p) => FILTERS.find((f) => f.id === filter).test(p) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || p.key.toLowerCase().includes(q.trim().toLowerCase())))
  );
  const countOf = (id) => projectsState.list.filter(FILTERS.find((f) => f.id === id).test).length;

  function dueLabel(p) {
    if (!p.due_date) return 'No due date';
    const d = diffDays(p.due_date, today);
    if (p.status === 'completed') return `Finished ${fmtDate(p.due_date)}`;
    if (d < 0) return `${plural(-d, 'day')} past due`;
    return `Due ${fmtDate(p.due_date)}`;
  }
</script>

<div class="page">
  <div class="page-head">
    <div><h1>Projects</h1><p class="sub">Everything you're part of, with health based on schedule and overdue work.</p></div>
    <button class="btn btn-primary" onclick={() => (ui.newProject = true)}><Icon name="plus" size={16} stroke={2.4} />New project</button>
  </div>

  <div class="bar">
    <div class="seg-ctl" role="group" aria-label="Filter projects">
      {#each FILTERS as f (f.id)}
        <button class:on={filter === f.id} onclick={() => (filter = f.id)}>{f.label} <span class="num">{countOf(f.id)}</span></button>
      {/each}
    </div>
    <div class="fsearch"><Icon name="search" size={15} /><input type="search" bind:value={q} placeholder="Find a project" aria-label="Find a project" /></div>
  </div>

  {#if !projectsState.loaded}
    <div class="cards">{#each [1, 2, 3] as i (i)}<div class="skeleton" style="height:190px"></div>{/each}</div>
  {:else if !list.length}
    <div class="card"><div class="empty">
      {#if projectsState.list.length === 0}
        <h3>Create your first project</h3>
        <p>A project holds the tasks, deadlines and people for one piece of work.</p>
        <button class="btn btn-primary" onclick={() => (ui.newProject = true)}>New project</button>
      {:else}
        <h3>No projects match</h3>
        <p>Try another filter or search term.</p>
      {/if}
    </div></div>
  {:else}
    <div class="cards">
      {#each list as p (p.id)}
        <a class="pcard card" href="/projects/{p.id}/board">
          <div class="top">
            <span class="tile" style="background:{p.color}">{p.key}</span>
            <div class="grow">
              <h3 class="truncate">{p.name}</h3>
              <span class="muted st">{PROJECT_STATUS[p.status]?.label}</span>
            </div>
            <HealthPill health={p.health} reason={p.reason} />
          </div>
          <p class="desc">{p.description || 'No description yet.'}</p>
          <div class="prog">
            <div class="prow num"><span><b>{p.done_tasks}</b> of {p.total_tasks} done</span>
              {#if p.overdue_tasks}<span class="chip danger">{p.overdue_tasks} late</span>{:else}<span class="muted">{p.progress}%</span>{/if}</div>
            <SegBar counts={p.by_status} height={8} />
          </div>
          <div class="foot">
            <AvatarStack people={p.members} max={4} size={26} />
            <span class="muted num">{dueLabel(p)}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .seg-ctl { display: inline-flex; padding: 3px; border-radius: 9px; background: var(--surface-3); }
  .seg-ctl button { display: inline-flex; gap: 6px; align-items: center; height: 30px; padding: 0 13px; border: 0; border-radius: 7px; background: transparent; font-size: 13px; font-weight: 600; color: var(--text-2); }
  .seg-ctl button span { font-size: 11.5px; color: var(--text-3); }
  .seg-ctl button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(13, 30, 43, 0.12); }
  .fsearch { display: flex; align-items: center; gap: 8px; width: 260px; height: 34px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--surface); color: var(--text-3); }
  .fsearch:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-50); }
  .fsearch input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--text); }
  .fsearch input::-webkit-search-cancel-button { display: none; }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
  .pcard { display: grid; gap: 14px; padding: 18px 20px 16px; transition: border-color 0.12s; }
  .pcard:hover { border-color: #9fb1ba; }
  .top { display: flex; align-items: center; gap: 12px; }
  .tile { display: grid; place-items: center; min-width: 40px; height: 40px; padding: 0 7px; border-radius: 10px; color: #fff; font-weight: 800; font-size: 12.5px; letter-spacing: 0.02em; flex: none; }
  h3 { font-size: 15.5px; font-weight: 700; letter-spacing: -0.01em; }
  .st { font-size: 12.5px; }
  .desc { color: var(--text-2); line-height: 1.5; min-height: 42px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .prog { display: grid; gap: 7px; }
  .prow { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-2); }
  .prow b { color: var(--text); }
  .foot { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; }
</style>
