<script>
  import { untrack } from 'svelte';
  import SegBar from '../components/SegBar.svelte';
  import HealthPill from '../components/HealthPill.svelte';
  import Donut from '../components/Donut.svelte';
  import AreaChart from '../components/AreaChart.svelte';
  import WorkloadList from '../components/WorkloadList.svelte';
  import ActivityFeed from '../components/ActivityFeed.svelte';
  import TaskLine from '../components/TaskLine.svelte';
  import { api } from '../lib/api.js';
  import { auth, bus, ui } from '../lib/state.svelte.js';
  import { STATUSES, greeting, todayStr, fmtDate, diffDays, plural } from '../lib/utils.js';

  let data = $state(null);
  let error = $state('');
  const today = todayStr();

  async function load() {
    try { data = await api.get(`/dashboard?today=${today}`); error = ''; }
    catch (e) { error = e.message; }
  }
  $effect(() => { bus.v; untrack(load); });

  const firstName = $derived(auth.user?.name.split(' ')[0] ?? '');
  const needAttention = $derived(data ? data.projects.filter((p) => p.health === 'off_track' || p.health === 'at_risk').length : 0);
  const dateLine = $derived(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));

  function dueLabel(p) {
    if (!p.due_date) return 'No due date';
    const d = diffDays(p.due_date, today);
    if (p.status === 'completed') return `Finished ${fmtDate(p.due_date)}`;
    if (d < 0) return `${plural(-d, 'day')} past due`;
    if (d === 0) return 'Due today';
    if (d <= 30) return `${plural(d, 'day')} left`;
    return fmtDate(p.due_date);
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>{greeting()}, {firstName}</h1>
      <p class="sub">
        {dateLine}.
        {#if data}
          {#if !data.projects.length}Create a project to get started.
          {:else if needAttention}{plural(needAttention, 'project')} {needAttention === 1 ? 'needs' : 'need'} attention.
          {:else}Every project is on schedule.{/if}
        {/if}
      </p>
    </div>
  </div>

  {#if error}
    <div class="form-error">{error}</div>
  {:else if !data}
    <div class="skeleton" style="height:84px;margin-bottom:16px"></div>
    <div class="grid">
      <div class="skeleton s8" style="height:300px"></div><div class="skeleton s4" style="height:300px"></div>
    </div>
  {:else if !data.projects.length}
    <div class="card"><div class="empty">
      <h3>No projects yet</h3>
      <p>Projects hold your tasks, deadlines and team. Create one and this dashboard fills in as work moves.</p>
      <button class="btn btn-primary" onclick={() => (ui.newProject = true)}>Create a project</button>
    </div></div>
  {:else}
    {@const t = data.totals}
    <div class="card strip">
      <div class="cell" class:alert={t.overdue > 0}>
        <span class="lbl">Overdue</span><b class="num">{t.overdue}</b>
        <span class="hintx">{t.overdue ? 'Past their due date' : 'Nothing is late'}</span>
      </div>
      <div class="cell">
        <span class="lbl">Due in 7 days</span><b class="num">{t.due_week}</b>
        <span class="hintx">Across all projects</span>
      </div>
      <div class="cell">
        <span class="lbl">Assigned to you</span><b class="num">{t.mine_open}</b>
        <span class="hintx">{t.mine_overdue ? `${t.mine_overdue} late` : 'None late'}</span>
      </div>
      <div class="cell">
        <span class="lbl">Finished this week</span><b class="num">{t.done_week}</b>
        <span class="hintx">Last 7 days</span>
      </div>
      <div class="cell">
        <span class="lbl">Open tasks</span><b class="num">{t.open}</b>
        <span class="hintx">{t.unassigned} unassigned</span>
      </div>
    </div>

    <div class="grid">
      <section class="card s8">
        <div class="card-head"><h3>Project health</h3><span class="sub">The bar shows where each project's work is sitting</span></div>
        <div class="card-body">
          <div class="legendrow" aria-hidden="true">
            {#each [...STATUSES].reverse() as s (s.id)}<span><i style="background:var(--s-{s.id})"></i>{s.label}</span>{/each}
          </div>
          <ul class="projects">
            {#each data.projects as p (p.id)}
              <li>
                <a class="prow" href="/projects/{p.id}/board">
                  <span class="pname"><i style="background:{p.color}"></i><span class="truncate">{p.name}</span></span>
                  <span class="pbar"><SegBar counts={p.by_status} height={9} /></span>
                  <span class="ppct num">{p.progress}%</span>
                  <span class="pdue muted num">{dueLabel(p)}</span>
                  <span class="phealth"><HealthPill health={p.health} reason={p.reason} /></span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      </section>

      <section class="card s4">
        <div class="card-head"><h3>Your next tasks</h3><a class="link" href="/tasks">See all</a></div>
        <div class="card-body">
          {#each data.upcoming.slice(0, 6) as task (task.id)}<TaskLine {task} />
          {:else}<p class="muted">Nothing is assigned to you right now.</p>{/each}
        </div>
      </section>

      <section class="card s8">
        <div class="card-head"><h3>Created and completed</h3><span class="sub">Last 14 days, across your projects</span></div>
        <div class="card-body"><AreaChart data={data.throughput} /></div>
      </section>

      <section class="card s4">
        <div class="card-head"><h3>All work by status</h3></div>
        <div class="card-body donutwrap">
          <Donut counts={data.by_status} size={140} thickness={15} />
          <ul class="legend">
            {#each STATUSES as s (s.id)}<li><i style="background:var(--s-{s.id})"></i>{s.label}<b class="num">{data.by_status[s.id] ?? 0}</b></li>{/each}
          </ul>
        </div>
      </section>

      <section class="card s6">
        <div class="card-head"><h3>Workload</h3><span class="sub">Open tasks and estimated hours left</span></div>
        <div class="card-body"><WorkloadList rows={data.workload} unassigned={t.unassigned} /></div>
      </section>

      <section class="card s6">
        <div class="card-head"><h3>Recent activity</h3></div>
        <div class="card-body"><ActivityFeed items={data.activity.slice(0, 8)} /></div>
      </section>
    </div>
  {/if}
</div>

<style>
  .strip { display: grid; grid-template-columns: repeat(5, 1fr); margin-bottom: 16px; }
  .cell { display: grid; gap: 1px; padding: 16px 20px 15px; border-left: 1px solid var(--line); }
  .cell:first-child { border-left: 0; }
  .lbl { font-size: 13px; font-weight: 600; color: var(--text-2); }
  .cell b { font-size: 32px; line-height: 1.15; font-weight: 700; letter-spacing: -0.03em; }
  .hintx { font-size: 12.5px; color: var(--text-3); }
  .cell.alert b { color: var(--danger); }

  .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
  .s8 { grid-column: span 8; } .s4 { grid-column: span 4; } .s6 { grid-column: span 6; }
  .link { font-size: 13px; font-weight: 600; color: var(--brand-600); }
  .link:hover { text-decoration: underline; }

  .legendrow { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; font-size: 12px; color: var(--text-3); }
  .legendrow span { display: inline-flex; align-items: center; gap: 5px; }
  .legendrow i { width: 8px; height: 8px; border-radius: 2px; }
  .projects { display: grid; }
  .prow {
    display: grid; grid-template-columns: minmax(170px, 1.25fr) minmax(120px, 1.5fr) 44px 104px 92px; align-items: center; gap: 14px;
    padding: 12px 10px; margin: 0 -10px; border-radius: 10px;
  }
  .prow:hover { background: var(--surface-2); }
  .pname { display: flex; align-items: center; gap: 9px; min-width: 0; font-weight: 700; }
  .pname i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .ppct { text-align: right; font-weight: 700; }
  .pdue { font-size: 12.5px; white-space: nowrap; }
  .phealth { justify-self: end; }

  .donutwrap { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .legend { display: grid; gap: 8px; flex: 1; min-width: 120px; }
  .legend li { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--text-2); }
  .legend i { width: 9px; height: 9px; border-radius: 50%; }
  .legend b { margin-left: auto; color: var(--text); }

  @media (max-width: 1180px) {
    .s8, .s4, .s6 { grid-column: span 12; }
    .strip { grid-template-columns: repeat(3, 1fr); }
    .cell:nth-child(4) { border-left: 0; }
    .cell:nth-child(n + 4) { border-top: 1px solid var(--line); }
  }
  @media (max-width: 760px) {
    .strip { grid-template-columns: repeat(2, 1fr); }
    .cell { border-left: 0; border-top: 1px solid var(--line); }
    .cell:nth-child(odd) { border-right: 1px solid var(--line); }
    .cell:nth-child(-n + 2) { border-top: 0; }
    .cell:last-child { grid-column: 1 / -1; border-right: 0; }
    .prow { grid-template-columns: 1fr auto; row-gap: 8px; }
    .pbar { grid-column: 1 / -1; order: 3; }
    .ppct, .pdue { display: none; }
  }
</style>
