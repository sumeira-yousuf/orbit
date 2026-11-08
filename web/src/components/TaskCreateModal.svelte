<script>
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';
  import { api } from '../lib/api.js';
  import { STATUSES, PRIORITIES, focusOnMount } from '../lib/utils.js';
  import { bump, toast, projectsState } from '../lib/state.svelte.js';

  let { projectId = null, status: initialStatus = 'todo', onclose } = $props();
  const init = untrack(() => ({ projectId, status: initialStatus }));

  const writable = $derived(projectsState.list.filter((p) => p.status !== 'archived' && p.my_role !== 'viewer'));
  let pid = $state(init.projectId && projectsState.list.some((p) => p.id === init.projectId && p.my_role !== 'viewer') ? init.projectId : (projectsState.list.find((p) => p.status !== 'archived' && p.my_role !== 'viewer')?.id ?? ''));
  const project = $derived(projectsState.list.find((p) => p.id === Number(pid)));

  let title = $state('');
  let description = $state('');
  let status = $state(init.status);
  let priority = $state('medium');
  let assignee = $state('');
  let start = $state('');
  let due = $state('');
  let busy = $state(false);
  let error = $state('');

  $effect(() => { project; assignee = ''; }); // members differ per project

  async function create(e) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const { task } = await api.post(`/projects/${pid}/tasks`, {
        title, description, status, priority,
        assignee_id: assignee === '' ? null : Number(assignee),
        start_date: start || null, due_date: due || null,
      });
      toast(`Created ${task.ref}`);
      bump();
      onclose();
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="New task" {onclose} width={580}>
  {#if !writable.length}
    <p class="muted">You need a project you can edit before adding tasks. Create a project first.</p>
  {:else}
    <form id="tform" class="stack" onsubmit={create}>
      {#if error}<div class="form-error" role="alert">{error}</div>{/if}
      <div class="field">
        <label for="tproject">Project</label>
        <select id="tproject" class="select" bind:value={pid}>
          {#each writable as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="ttitle">Title</label>
        <input id="ttitle" class="input" bind:value={title} placeholder="What needs to be done?" maxlength="200" required use:focusOnMount />
      </div>
      <div class="field">
        <label for="tdesc">Description <span class="muted">(optional)</span></label>
        <textarea id="tdesc" class="textarea" bind:value={description} rows="3" placeholder="Add context, links or acceptance criteria"></textarea>
      </div>
      <div class="grid-2">
        <div class="field">
          <label for="tstatus">Status</label>
          <select id="tstatus" class="select" bind:value={status}>
            {#each STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="tprio">Priority</label>
          <select id="tprio" class="select" bind:value={priority}>
            {#each PRIORITIES as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="tassignee">Assignee</label>
          <select id="tassignee" class="select" bind:value={assignee}>
            <option value="">Unassigned</option>
            {#each project?.members ?? [] as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="tstart">Start date</label>
          <input id="tstart" class="input" type="date" bind:value={start} />
        </div>
        <div class="field">
          <label for="tdue">Due date</label>
          <input id="tdue" class="input" type="date" bind:value={due} min={start || undefined} />
        </div>
      </div>
    </form>
  {/if}
  {#snippet footer()}
    <button type="button" class="btn" onclick={onclose}>Cancel</button>
    {#if writable.length}
      <button type="submit" form="tform" class="btn btn-primary" disabled={busy || !title.trim()}>Create task</button>
    {/if}
  {/snippet}
</Modal>
