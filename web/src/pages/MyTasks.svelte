<script>
  import { untrack } from 'svelte';
  import TaskLine from '../components/TaskLine.svelte';
  import { api } from '../lib/api.js';
  import { bus } from '../lib/state.svelte.js';
  import { todayStr, diffDays, plural } from '../lib/utils.js';

  const today = todayStr();
  let tasks = $state(null);
  let error = $state('');
  let showDone = $state(false);

  async function load() {
    try { tasks = (await api.get(`/me/tasks?today=${today}`)).tasks; error = ''; }
    catch (e) { error = e.message; }
  }
  $effect(() => { bus.v; untrack(load); });

  const open = $derived((tasks ?? []).filter((t) => t.status !== 'done'));
  const done = $derived((tasks ?? []).filter((t) => t.status === 'done'));
  const groups = $derived.by(() => {
    const g = [
      { id: 'late', label: 'Overdue', tone: 'danger', tasks: [] },
      { id: 'today', label: 'Today', tasks: [] },
      { id: 'week', label: 'Next 7 days', tasks: [] },
      { id: 'later', label: 'Later', tasks: [] },
      { id: 'none', label: 'No due date', tasks: [] },
    ];
    for (const t of open) {
      if (!t.due_date) g[4].tasks.push(t);
      else {
        const d = diffDays(t.due_date, today);
        (d < 0 ? g[0] : d === 0 ? g[1] : d <= 7 ? g[2] : g[3]).tasks.push(t);
      }
    }
    return g.filter((x) => x.tasks.length);
  });
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>My tasks</h1>
      <p class="sub">{#if tasks}{plural(open.length, 'open task')} assigned to you across all projects.{/if}</p>
    </div>
  </div>

  {#if error}
    <div class="form-error">{error}</div>
  {:else if !tasks}
    <div class="skeleton" style="height:300px"></div>
  {:else if !open.length && !done.length}
    <div class="card"><div class="empty"><h3>Nothing is assigned to you</h3><p>Tasks assigned to you show up here, grouped by when they're due.</p></div></div>
  {:else}
    <div class="stackc">
      {#each groups as g (g.id)}
        <section class="card">
          <div class="card-head"><h3 class:late={g.tone === 'danger'}>{g.label}</h3><span class="sub num">{g.tasks.length}</span></div>
          <div class="card-body">{#each g.tasks as t (t.id)}<TaskLine task={t} />{/each}</div>
        </section>
      {:else}
        <div class="card"><div class="empty"><h3>You're all caught up</h3><p>No open tasks are assigned to you.</p></div></div>
      {/each}

      {#if done.length}
        <section class="card">
          <div class="card-head">
            <h3>Finished in the last 2 weeks</h3>
            <button class="btn btn-ghost btn-sm" onclick={() => (showDone = !showDone)}>{showDone ? 'Hide' : `Show ${done.length}`}</button>
          </div>
          {#if showDone}<div class="card-body">{#each done as t (t.id)}<TaskLine task={t} />{/each}</div>{:else}<div style="height:14px"></div>{/if}
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stackc { display: grid; gap: 16px; max-width: 880px; }
  h3 { font-size: 14px; font-weight: 700; }
  h3.late { color: var(--danger); }
</style>
