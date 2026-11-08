<script>
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import SegBar from '../components/SegBar.svelte';
  import HealthPill from '../components/HealthPill.svelte';
  import AvatarStack from '../components/AvatarStack.svelte';
  import ProjectModal from '../components/ProjectModal.svelte';
  import Board from '../views/Board.svelte';
  import ListView from '../views/ListView.svelte';
  import Timeline from '../views/Timeline.svelte';
  import Overview from '../views/Overview.svelte';
  import Team from '../views/Team.svelte';
  import { api } from '../lib/api.js';
  import { auth, bus, toast, refreshProjects } from '../lib/state.svelte.js';
  import { PRIORITIES, PROJECT_STATUS, todayStr, fmtDate, diffDays } from '../lib/utils.js';

  let { id, tab } = $props();

  let project = $state(null);
  let members = $state([]);
  let myRole = $state('viewer');
  let tasks = $state([]);
  let error = $state('');
  let editing = $state(false);

  let q = $state('');
  let who = $state('');
  let prio = $state('');

  const canEdit = $derived(myRole !== 'viewer');
  const tabs = [
    { id: 'board', label: 'Board', icon: 'board' },
    { id: 'list', label: 'List', icon: 'list' },
    { id: 'timeline', label: 'Timeline', icon: 'gantt' },
    { id: 'overview', label: 'Overview', icon: 'chart' },
    { id: 'team', label: 'People', icon: 'users' },
  ];
  const filterable = $derived(tab === 'board' || tab === 'list' || tab === 'timeline');
  const filtered = $derived(
    tasks.filter((t) => {
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !t.ref.toLowerCase().includes(s) && !t.labels.some((l) => l.toLowerCase().includes(s))) return false;
      }
      if (who === 'none' ? t.assignee_id != null : who === 'me' ? t.assignee_id !== auth.user.id : who && t.assignee_id !== Number(who)) return false;
      if (prio && t.priority !== prio) return false;
      return true;
    })
  );
  const filtersOn = $derived(!!(q.trim() || who || prio));

  async function loadAll() {
    try {
      const [p, t] = await Promise.all([api.get(`/projects/${id}?today=${todayStr()}`), api.get(`/projects/${id}/tasks`)]);
      project = p.project;
      members = p.members;
      myRole = p.my_role;
      tasks = t.tasks;
      error = '';
    } catch (e) {
      error = e.message;
    }
  }
  $effect(() => { bus.v; untrack(loadAll); });

  async function refreshProject() {
    try {
      const p = await api.get(`/projects/${id}?today=${todayStr()}`);
      project = p.project;
      members = p.members;
    } catch { /* header will refresh on next load */ }
  }

  async function patchTask(taskId, patch) {
    const i = tasks.findIndex((t) => t.id === taskId);
    if (i < 0) return;
    const before = tasks[i];
    const next = { ...before, ...patch };
    if ('assignee_id' in patch) {
      const m = members.find((x) => x.id === patch.assignee_id);
      next.assignee_name = m?.name ?? null;
      next.assignee_color = m?.color ?? null;
    }
    if (patch.status && patch.status !== before.status) next.completed_at = patch.status === 'done' ? new Date().toISOString() : null;
    tasks[i] = next; // optimistic
    try {
      const { task } = await api.patch(`/tasks/${taskId}`, patch);
      const j = tasks.findIndex((t) => t.id === taskId);
      if (j >= 0) tasks[j] = task;
      refreshProject();
    } catch (e) {
      toast(e.message, 'error');
      const j = tasks.findIndex((t) => t.id === taskId);
      if (j >= 0) tasks[j] = before;
    }
  }

  async function createTask(status, title) {
    try {
      const { task } = await api.post(`/projects/${id}/tasks`, { title, status });
      tasks.push(task);
      refreshProject();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function teamChanged() {
    await loadAll();
    refreshProjects();
  }

  const dueText = $derived.by(() => {
    if (!project?.due_date) return '';
    const d = diffDays(project.due_date, todayStr());
    if (project.status === 'completed') return `Finished ${fmtDate(project.due_date)}`;
    return d < 0 ? `Was due ${fmtDate(project.due_date)}` : d === 0 ? 'Due today' : `Due ${fmtDate(project.due_date)}`;
  });
</script>

{#if error}
  <div class="page">
    <div class="card"><div class="empty">
      <h3>This project isn't available</h3>
      <p>{error}. It may have been deleted, or you may not have been added to it.</p>
      <a class="btn btn-primary" href="/projects">Back to projects</a>
    </div></div>
  </div>
{:else if !project}
  <div class="page">
    <div class="skeleton" style="height:44px;width:340px;margin-bottom:20px"></div>
    <div class="skeleton" style="height:380px"></div>
  </div>
{:else}
  <div class="page">
    <div class="head">
      <span class="tile" style="background:{project.color}" aria-hidden="true">{project.key}</span>
      <div class="titles">
        <h1 class="truncate">{project.name}</h1>
        <div class="meta">
          <span class="pill plain" style="--c:var(--text-3)">{PROJECT_STATUS[project.status]?.label}</span>
          <HealthPill health={project.health} reason={project.reason} />
          {#if dueText}<span class="muted">{dueText}</span>{/if}
        </div>
      </div>
      <span class="spacer"></span>
      <div class="prog">
        <div class="prow"><span class="num"><b>{project.done_tasks}</b> of {project.total_tasks} done</span>
          {#if project.overdue_tasks}<span class="chip danger">{project.overdue_tasks} late</span>{/if}</div>
        <SegBar counts={project.by_status} height={8} />
      </div>
      <a class="people" href="/projects/{id}/team" aria-label="People on this project"><AvatarStack people={members} max={4} size={30} /></a>
      {#if myRole === 'owner'}
        <button class="btn" onclick={() => (editing = true)}><Icon name="edit" size={15} />Edit</button>
      {/if}
    </div>

    <nav class="tabs" aria-label="Project views">
      {#each tabs as t (t.id)}
        <a href="/projects/{id}/{t.id}" class:on={tab === t.id} aria-current={tab === t.id ? 'page' : undefined}>
          <Icon name={t.icon} size={16} />{t.label}
          {#if t.id === 'list' || t.id === 'board'}<span class="n num">{t.id === 'board' ? tasks.filter((x) => x.status !== 'done').length : tasks.length}</span>{/if}
        </a>
      {/each}
    </nav>

    {#if filterable}
      <div class="filters">
        <div class="fsearch"><Icon name="search" size={15} /><input type="search" bind:value={q} placeholder="Filter tasks" aria-label="Filter tasks" /></div>
        <select class="select f" bind:value={who} aria-label="Filter by assignee">
          <option value="">Everyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {#each members as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
        </select>
        <select class="select f" bind:value={prio} aria-label="Filter by priority">
          <option value="">Any priority</option>
          {#each PRIORITIES as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
        </select>
        {#if filtersOn}
          <button class="btn btn-ghost btn-sm" onclick={() => { q = ''; who = ''; prio = ''; }}>Clear filters</button>
          <span class="muted fcount">Showing {filtered.length} of {tasks.length}</span>
        {/if}
      </div>
    {/if}

    <div class="view">
      {#if tab === 'board'}
        <Board tasks={filtered} {canEdit} onpatch={patchTask} oncreate={createTask} />
      {:else if tab === 'list'}
        <ListView tasks={filtered} {members} {canEdit} onpatch={patchTask} />
      {:else if tab === 'timeline'}
        <Timeline tasks={filtered} {project} {canEdit} onpatch={patchTask} />
      {:else if tab === 'overview'}
        <Overview {project} />
      {:else}
        <Team {project} {members} {myRole} onchange={teamChanged} />
      {/if}
    </div>
  </div>

  {#if editing}<ProjectModal {project} onclose={() => (editing = false)} />{/if}
{/if}

<style>
  .head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
  .tile {
    display: grid; place-items: center; min-width: 46px; height: 46px; padding: 0 8px; border-radius: 12px; color: #fff;
    font-weight: 800; font-size: 14px; letter-spacing: 0.02em;
  }
  .titles { min-width: 0; }
  h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; max-width: 46vw; }
  .meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; font-size: 13px; }
  .prog { width: 230px; display: grid; gap: 6px; }
  .prow { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-2); }
  .prow b { color: var(--text); }
  .people { display: inline-flex; padding: 3px; border-radius: 99px; }
  .people:hover { background: var(--surface-3); }

  .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line-strong); margin-bottom: 18px; overflow-x: auto; }
  .tabs a {
    display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px; margin-bottom: -1px; border-bottom: 2px solid transparent;
    color: var(--text-2); font-weight: 600; white-space: nowrap;
  }
  .tabs a:hover { color: var(--text); }
  .tabs a.on { color: var(--brand-600); border-bottom-color: var(--brand); }
  .n { margin-left: 2px; padding: 0 6px; border-radius: 99px; background: var(--surface-3); font-size: 11.5px; color: var(--text-2); }

  .filters { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .fsearch { display: flex; align-items: center; gap: 8px; width: 240px; height: 34px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--surface); color: var(--text-3); }
  .fsearch:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-50); }
  .fsearch input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: var(--text); }
  .fsearch input::-webkit-search-cancel-button { display: none; }
  .f { width: 168px; height: 34px; }
  .fcount { font-size: 12.5px; }
  @media (max-width: 900px) { .prog { width: 100%; order: 5; } h1 { max-width: 70vw; } }
</style>
