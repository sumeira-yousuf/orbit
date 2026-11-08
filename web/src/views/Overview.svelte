<script>
  import { untrack } from 'svelte';
  import Donut from '../components/Donut.svelte';
  import AreaChart from '../components/AreaChart.svelte';
  import WorkloadList from '../components/WorkloadList.svelte';
  import ActivityFeed from '../components/ActivityFeed.svelte';
  import TaskLine from '../components/TaskLine.svelte';
  import HealthPill from '../components/HealthPill.svelte';
  import { api } from '../lib/api.js';
  import { bus } from '../lib/state.svelte.js';
  import { STATUSES, PRIORITIES, todayStr, diffDays, fmtDate, clamp, plural } from '../lib/utils.js';

  let { project } = $props();
  let data = $state(null);
  let error = $state('');
  const today = todayStr();

  async function load() {
    try { data = await api.get(`/projects/${project.id}/overview?today=${today}`); error = ''; }
    catch (e) { error = e.message; }
  }
  $effect(() => { bus.v; untrack(load); });

  const total = $derived(project.total_tasks);
  const elapsed = $derived.by(() => {
    if (!project.start_date || !project.due_date || project.due_date <= project.start_date) return null;
    return Math.round(clamp(diffDays(today, project.start_date) / diffDays(project.due_date, project.start_date), 0, 1) * 100);
  });
  const left = $derived(project.due_date ? diffDays(project.due_date, today) : null);
  const maxPrio = $derived(Math.max(1, ...PRIORITIES.map((p) => data?.by_priority[p.id] ?? 0)));
</script>

{#if error}
  <div class="form-error">{error}</div>
{:else if !data}
  <div class="skeleton" style="height:420px"></div>
{:else}
  <div class="layout">
    <section class="card span-12">
      <div class="card-body sched">
        <div class="col">
          <div class="row"><h3>Schedule and progress</h3><span class="spacer"></span><HealthPill health={project.health} reason={project.reason} /></div>
          <p class="why">{project.reason}.</p>
          <div class="meter">
            <div class="mrow"><span>Work done</span><b class="num">{project.progress}%</b></div>
            <div class="mbar"><div style="width:{project.progress}%;background:var(--s-done)"></div></div>
            {#if elapsed !== null}
              <div class="mrow"><span>Time used</span><b class="num">{elapsed}%</b></div>
              <div class="mbar"><div style="width:{elapsed}%;background:{elapsed - project.progress > 25 ? 'var(--p-high)' : '#9db0bb'}"></div></div>
            {/if}
          </div>
        </div>
        <dl>
          <div><dt>Start</dt><dd>{project.start_date ? fmtDate(project.start_date, { year: true }) : 'Not set'}</dd></div>
          <div><dt>Due</dt><dd>{project.due_date ? fmtDate(project.due_date, { year: true }) : 'Not set'}</dd></div>
          <div><dt>Time left</dt><dd class:late={left !== null && left < 0 && project.status !== 'completed'}>
            {#if left === null}-{:else if left < 0}{plural(-left, 'day')} past due{:else if left === 0}Due today{:else}{plural(left, 'day')}{/if}</dd></div>
          <div><dt>Tasks</dt><dd>{project.done_tasks} of {total} done</dd></div>
        </dl>
        {#if project.description}<p class="desc">{project.description}</p>{/if}
      </div>
    </section>

    <section class="card span-4">
      <div class="card-head"><h3>Tasks by status</h3></div>
      <div class="card-body donutwrap">
        <Donut counts={data.by_status} />
        <ul class="legend">
          {#each STATUSES as s (s.id)}
            <li><i style="background:var(--s-{s.id})"></i>{s.label}<b class="num">{data.by_status[s.id] ?? 0}</b></li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="card span-4">
      <div class="card-head"><h3>Open work by priority</h3></div>
      <div class="card-body">
        <ul class="prio">
          {#each PRIORITIES as p (p.id)}
            {@const n = data.by_priority[p.id] ?? 0}
            <li>
              <span class="pl">{p.label}</span>
              <div class="pt"><div style="width:{(n / maxPrio) * 100}%;background:var(--p-{p.id})"></div></div>
              <b class="num">{n}</b>
            </li>
          {/each}
        </ul>
        {#if data.totals.unassigned}<p class="note"><b>{data.totals.unassigned}</b> open {data.totals.unassigned === 1 ? 'task has' : 'tasks have'} no assignee.</p>{/if}
      </div>
    </section>

    <section class="card span-4">
      <div class="card-head"><h3>Workload</h3><span class="sub">Open tasks per person</span></div>
      <div class="card-body"><WorkloadList rows={data.workload} /></div>
    </section>

    <section class="card span-6">
      <div class="card-head"><h3>Needs attention</h3><span class="sub">Overdue or due within a week</span></div>
      <div class="card-body">
        {#each data.attention as t (t.id)}<TaskLine task={t} showProject={false} showAssignee />
        {:else}<p class="muted">Nothing is overdue or due soon. </p>{/each}
      </div>
    </section>

    <section class="card span-6">
      <div class="card-head"><h3>Created and completed</h3><span class="sub">Last 14 days</span></div>
      <div class="card-body"><AreaChart data={data.throughput} /></div>
    </section>

    <section class="card span-12">
      <div class="card-head"><h3>Recent activity</h3></div>
      <div class="card-body act"><ActivityFeed items={data.activity} /></div>
    </section>
  </div>
{/if}

<style>
  .layout { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
  .span-12 { grid-column: span 12; } .span-6 { grid-column: span 6; } .span-4 { grid-column: span 4; }
  h3 { font-size: 14px; font-weight: 700; }
  .sched { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 8px 40px; padding-top: 18px; }
  .why { color: var(--text-2); margin: 2px 0 14px; }
  .meter { display: grid; gap: 6px; max-width: 520px; }
  .mrow { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); }
  .mrow b { color: var(--text); }
  .mbar { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; margin-bottom: 8px; }
  .mbar div { height: 100%; border-radius: 99px; transition: width 0.4s var(--ease); }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; margin: 0; align-content: start; }
  dt { font-size: 12.5px; color: var(--text-3); font-weight: 600; }
  dd { margin: 0; font-weight: 700; font-size: 15px; }
  dd.late { color: var(--danger); }
  .desc { grid-column: 1 / -1; color: var(--text-2); max-width: 78ch; padding-top: 12px; border-top: 1px solid var(--surface-3); margin-top: 8px; line-height: 1.6; }
  .donutwrap { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .legend { display: grid; gap: 8px; flex: 1; min-width: 140px; }
  .legend li { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--text-2); }
  .legend i { width: 9px; height: 9px; border-radius: 50%; }
  .legend b { margin-left: auto; color: var(--text); }
  .prio { display: grid; gap: 14px; }
  .prio li { display: grid; grid-template-columns: 64px 1fr 28px; align-items: center; gap: 10px; font-size: 13.5px; }
  .pt { height: 8px; border-radius: 99px; background: var(--surface-3); overflow: hidden; }
  .pt div { height: 100%; border-radius: 99px; min-width: 3px; transition: width 0.4s var(--ease); }
  .prio b { text-align: right; }
  .note { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--surface-3); font-size: 13px; color: var(--text-2); }
  .act { max-width: 760px; }
  @media (max-width: 1100px) { .span-4, .span-6 { grid-column: span 12; } .sched { grid-template-columns: 1fr; } }
</style>
