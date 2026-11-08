<script>
  import Icon from '../components/Icon.svelte';
  import { STATUSES, PRIORITIES, PRIORITY, dueInfo, todayStr } from '../lib/utils.js';
  import { openTask } from '../lib/router.svelte.js';

  let { tasks, members, canEdit, onpatch } = $props();
  const today = todayStr();

  let groupBy = $state('status');
  let sortKey = $state('manual');
  let sortDir = $state(1);
  let collapsed = $state({});

  const statusIdx = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));
  const cmp = {
    manual: (a, b) => a.position - b.position || a.id - b.id,
    title: (a, b) => a.title.localeCompare(b.title),
    status: (a, b) => statusIdx[a.status] - statusIdx[b.status] || a.position - b.position,
    priority: (a, b) => PRIORITY[a.priority].rank - PRIORITY[b.priority].rank,
    assignee: (a, b) => (a.assignee_name ?? '￿').localeCompare(b.assignee_name ?? '￿'),
    due: (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
  };
  const sorted = $derived([...tasks].sort((a, b) => sortDir * cmp[sortKey](a, b) || a.id - b.id));
  const groups = $derived(
    groupBy === 'status'
      ? STATUSES.map((s) => ({ id: s.id, label: s.label, tasks: sorted.filter((t) => t.status === s.id) })).filter((g) => g.tasks.length)
      : [{ id: 'all', label: '', tasks: sorted }]
  );

  function sortBy(key) {
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = 1; }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 1 ? '↑' : '↓') : '');
  const ariaSort = (key) => (sortKey === key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
</script>

<div class="bar">
  <div class="seg-ctl" role="group" aria-label="Group tasks">
    <button class:on={groupBy === 'status'} onclick={() => (groupBy = 'status')}>Group by status</button>
    <button class:on={groupBy === 'none'} onclick={() => (groupBy = 'none')}>No grouping</button>
  </div>
  <span class="muted">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
</div>

<div class="card wrap">
  {#if !tasks.length}
    <div class="empty"><h3>No tasks match</h3><p>Try clearing the filters, or add a task to get started.</p></div>
  {:else}
    <table class="table list">
      <thead>
        <tr>
          <th aria-sort={ariaSort('title')}><button class="th" onclick={() => sortBy('title')}>Task {arrow('title')}</button></th>
          <th class="c-status" aria-sort={ariaSort('status')}><button class="th" onclick={() => sortBy('status')}>Status {arrow('status')}</button></th>
          <th class="c-prio" aria-sort={ariaSort('priority')}><button class="th" onclick={() => sortBy('priority')}>Priority {arrow('priority')}</button></th>
          <th class="c-who" aria-sort={ariaSort('assignee')}><button class="th" onclick={() => sortBy('assignee')}>Assignee {arrow('assignee')}</button></th>
          <th class="c-due" aria-sort={ariaSort('due')}><button class="th" onclick={() => sortBy('due')}>Due {arrow('due')}</button></th>
          <th class="c-prog">Checklist</th>
        </tr>
      </thead>
      {#each groups as g (g.id)}
        <tbody>
          {#if g.label}
            <tr class="group">
              <td colspan="6">
                <button class="gbtn" onclick={() => (collapsed[g.id] = !collapsed[g.id])} aria-expanded={!collapsed[g.id]}>
                  <Icon name={collapsed[g.id] ? 'chevron-right' : 'chevron-down'} size={16} />
                  <i style="background:var(--s-{g.id})"></i>{g.label}
                  <span class="muted num">{g.tasks.length}</span>
                </button>
              </td>
            </tr>
          {/if}
          {#if !collapsed[g.id]}
            {#each g.tasks as t (t.id)}
              {@const due = dueInfo(t, today)}
              <tr class:done={t.status === 'done'}>
                <td>
                <div class="c-title">
                  <button class="tbtn" onclick={() => openTask(t.id)}>
                    <span class="ref" style="color:{t.project_color}">{t.ref}</span>
                    <span class="ttl truncate">{t.title}</span>
                  </button>
                  {#each t.labels.slice(0, 2) as l (l)}<span class="chip">{l}</span>{/each}
                </div></td>
                <td>
                  <select class="cell st" style="--c:var(--s-{t.status})" aria-label="Status of {t.ref}" value={t.status} disabled={!canEdit} onchange={(e) => onpatch(t.id, { status: e.currentTarget.value })}>
                    {#each STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
                  </select>
                </td>
                <td>
                  <select class="cell" style="color:var(--p-{t.priority})" aria-label="Priority of {t.ref}" value={t.priority} disabled={!canEdit} onchange={(e) => onpatch(t.id, { priority: e.currentTarget.value })}>
                    {#each PRIORITIES as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
                  </select>
                </td>
                <td>
                  <select class="cell" aria-label="Assignee of {t.ref}" value={t.assignee_id ?? ''} disabled={!canEdit} onchange={(e) => onpatch(t.id, { assignee_id: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}>
                    <option value="">Unassigned</option>
                    {#each members as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
                  </select>
                </td>
                <td>
                  <input class="cell date" class:late={due?.overdue} type="date" aria-label="Due date of {t.ref}" value={t.due_date ?? ''} disabled={!canEdit}
                    onchange={(e) => onpatch(t.id, { due_date: e.currentTarget.value || null })} />
                </td>
                <td class="num c-prog">
                  {#if t.checklist_total}
                    <span class="mini"><span style="width:{(t.checklist_done / t.checklist_total) * 100}%"></span></span>
                    <span class="muted">{t.checklist_done}/{t.checklist_total}</span>
                  {:else}<span class="muted">-</span>{/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      {/each}
    </table>
  {/if}
</div>

<style>
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .seg-ctl { display: inline-flex; padding: 3px; border-radius: 9px; background: var(--surface-3); }
  .seg-ctl button { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .seg-ctl button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(13, 30, 43, 0.12); }
  .wrap { overflow-x: auto; }
  .list { min-width: 860px; }
  .th { border: 0; background: transparent; padding: 0; font-weight: 600; font-size: 12px; color: var(--text-3); }
  .th:hover { color: var(--text); }
  .c-status { width: 150px; } .c-prio { width: 120px; } .c-who { width: 170px; } .c-due { width: 150px; } .c-prog { width: 130px; white-space: nowrap; }
  .group td { background: var(--surface-2); padding: 6px 8px; border-bottom: 1px solid var(--line); }
  .group:hover td { background: var(--surface-2) !important; }
  .gbtn { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; font-weight: 700; font-size: 13px; }
  .gbtn i { width: 9px; height: 9px; border-radius: 50%; }
  .c-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .tbtn { display: flex; align-items: center; gap: 10px; min-width: 0; border: 0; background: transparent; padding: 0; text-align: left; }
  .ref { font-size: 12px; font-weight: 700; flex: none; width: 58px; }
  .ttl { font-weight: 600; }
  .tbtn:hover .ttl { text-decoration: underline; text-underline-offset: 3px; }
  tr.done .ttl { color: var(--text-3); }
  .cell {
    height: 30px; max-width: 100%; padding: 0 6px; border: 1px solid transparent; border-radius: 7px; background: transparent;
    font-weight: 600; font-size: 13px; cursor: pointer;
  }
  .cell:hover:not(:disabled) { border-color: var(--line-strong); background: var(--surface); }
  .cell:disabled { cursor: default; opacity: 1; color: inherit; -webkit-text-fill-color: currentColor; }
  .cell:focus-visible { outline: 2px solid var(--brand); }
  .st { color: color-mix(in srgb, var(--c) 70%, black); }
  .date { font-variant-numeric: tabular-nums; color: var(--text-2); }
  .date.late { color: var(--danger); }
  .mini { display: inline-block; vertical-align: middle; width: 54px; height: 5px; border-radius: 99px; background: var(--surface-3); margin-right: 8px; overflow: hidden; }
  .mini span { display: block; height: 100%; background: var(--s-done); }
</style>
