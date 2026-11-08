<script>
  import { untrack } from 'svelte';
  import Modal from './Modal.svelte';
  import { api } from '../lib/api.js';
  import { PROJECT_COLORS, PROJECT_STATUSES, focusOnMount } from '../lib/utils.js';
  import { bump, toast, confirmDialog, refreshProjects } from '../lib/state.svelte.js';
  import { navigate } from '../lib/router.svelte.js';

  let { project = null, onclose } = $props();
  // The form is seeded once from the project being edited; later prop changes must not overwrite typing.
  const init = untrack(() => project);
  const editing = init !== null;

  let name = $state(init?.name ?? '');
  let key = $state(init?.key ?? '');
  let keyTouched = $state(editing);
  let description = $state(init?.description ?? '');
  let color = $state(init?.color ?? PROJECT_COLORS[0]);
  let status = $state(init?.status ?? 'active');
  let start = $state(init?.start_date ?? '');
  let due = $state(init?.due_date ?? '');
  let busy = $state(false);
  let error = $state('');

  function autoKey(n) {
    const words = n.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    let k = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : words[0].slice(0, 3);
    if (!/^[A-Z]/.test(k)) k = `P${k}`;
    return k.padEnd(2, 'X').slice(0, 6);
  }
  $effect(() => { if (!keyTouched) key = autoKey(name); });

  async function save(e) {
    e.preventDefault();
    error = '';
    busy = true;
    const body = { name, description, color, status, start_date: start || null, due_date: due || null };
    if (key.trim()) body.key = key;
    try {
      if (editing) {
        await api.patch(`/projects/${project.id}`, body);
        toast('Project saved');
        bump();
        await refreshProjects();
        onclose();
      } else {
        const { project: p } = await api.post('/projects', body);
        toast('Project created');
        await refreshProjects();
        bump();
        onclose();
        navigate(`/projects/${p.id}/board`);
      }
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete ${project.name}?`,
      message: 'This permanently deletes the project and all of its tasks, comments and history. This cannot be undone.',
      confirmLabel: 'Delete project', danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/projects/${project.id}`);
      toast('Project deleted');
      await refreshProjects();
      bump();
      onclose();
      navigate('/projects');
    } catch (err) {
      error = err.message;
    }
  }
</script>

<Modal title={editing ? 'Edit project' : 'New project'} {onclose} width={560}>
  <form id="pform" class="stack" onsubmit={save}>
    {#if error}<div class="form-error" role="alert">{error}</div>{/if}
    <div class="name-row">
      <div class="field">
        <label for="pname">Name</label>
        <input id="pname" class="input" bind:value={name} placeholder="Website relaunch" maxlength="100" required use:focusOnMount />
      </div>
      <div class="field key">
        <label for="pkey">Key</label>
        <input id="pkey" class="input" bind:value={key} oninput={() => (keyTouched = true)} placeholder="WEB" maxlength="6" style="text-transform:uppercase" />
      </div>
    </div>
    <div class="field">
      <label for="pdesc">Description</label>
      <textarea id="pdesc" class="textarea" bind:value={description} rows="3" placeholder="What is this project meant to achieve?" maxlength="2000"></textarea>
    </div>
    <div class="field">
      <span class="label">Color</span>
      <div class="swatches" role="radiogroup" aria-label="Project color">
        {#each PROJECT_COLORS as c (c)}
          <button type="button" class="sw" class:on={color === c} style="background:{c}" role="radio" aria-checked={color === c} aria-label={c} onclick={() => (color = c)}></button>
        {/each}
      </div>
    </div>
    <div class="grid-2">
      <div class="field">
        <label for="pstart">Start date</label>
        <input id="pstart" class="input" type="date" bind:value={start} />
      </div>
      <div class="field">
        <label for="pdue">Due date</label>
        <input id="pdue" class="input" type="date" bind:value={due} min={start || undefined} />
      </div>
    </div>
    {#if editing}
      <div class="field">
        <label for="pstatus">Status</label>
        <select id="pstatus" class="select" bind:value={status}>
          {#each PROJECT_STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        </select>
        <span class="hint">Archived projects are hidden from the dashboard and sidebar.</span>
      </div>
    {/if}
  </form>
  {#snippet footer()}
    {#if editing}<button type="button" class="btn btn-danger" onclick={remove}>Delete project</button>{/if}
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={onclose}>Cancel</button>
    <button type="submit" form="pform" class="btn btn-primary" disabled={busy || !name.trim()}>{editing ? 'Save changes' : 'Create project'}</button>
  {/snippet}
</Modal>

<style>
  .name-row { display: grid; grid-template-columns: 1fr 96px; gap: 14px; }
  .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .sw { width: 26px; height: 26px; border-radius: 8px; border: 0; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
  .sw.on { outline: 2px solid var(--text); outline-offset: 2px; }
</style>
