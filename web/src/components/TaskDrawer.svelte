<script>
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import Avatar from './Avatar.svelte';
  import { api } from '../lib/api.js';
  import { STATUSES, PRIORITIES, timeAgo, describeActivity, plural } from '../lib/utils.js';
  import { bump, toast, confirmDialog, confirmState } from '../lib/state.svelte.js';

  let { id, onclose } = $props();

  let data = $state(null);
  let loadError = $state('');
  let panel = $state();

  // Drafts: bound to the inputs, committed to the server on change/blur.
  let title = $state('');
  let description = $state('');
  let labelsText = $state('');
  let f = $state({ status: 'todo', priority: 'medium', assignee_id: '', start_date: '', due_date: '', estimate_hours: '' });
  let newItem = $state('');
  let newComment = $state('');
  let showHistory = $state(false);
  let postingComment = $state(false);

  const canEdit = $derived(!!data && data.my_role !== 'viewer');
  const doneCount = $derived(data ? data.checklist.filter((i) => i.done).length : 0);
  const pct = $derived(data?.checklist.length ? Math.round((doneCount / data.checklist.length) * 100) : 0);

  function syncDrafts() {
    const t = data.task;
    title = t.title;
    description = t.description;
    labelsText = t.labels.join(', ');
    f = {
      status: t.status, priority: t.priority, assignee_id: t.assignee_id ?? '',
      start_date: t.start_date ?? '', due_date: t.due_date ?? '', estimate_hours: t.estimate_hours ?? '',
    };
  }

  async function load() {
    try {
      data = await api.get(`/tasks/${id}`);
      loadError = '';
      syncDrafts();
    } catch (e) {
      data = null;
      loadError = e.message;
    }
  }

  $effect(() => {
    id;
    untrack(() => {
      data = null;
      load();
    });
  });

  $effect(() => { if (data && panel) untrack(() => panel.focus({ preventScroll: true })); });

  async function save(patch) {
    try {
      const { task } = await api.patch(`/tasks/${id}`, patch);
      data.task = task;
      bump();
    } catch (e) {
      toast(e.message, 'error');
      await load(); // put the inputs back to what the server has
    }
  }

  function commitField(key) {
    const v = f[key];
    const value =
      key === 'assignee_id' ? (v === '' ? null : Number(v))
      : key === 'estimate_hours' ? (v === '' || v == null ? null : Number(v))
      : key === 'start_date' || key === 'due_date' ? (v || null)
      : v;
    save({ [key]: value });
  }

  function commitTitle() {
    const t = title.trim();
    if (!t) { title = data.task.title; return; }
    if (t !== data.task.title) save({ title: t });
  }
  function commitDescription() {
    if (description !== data.task.description) save({ description });
  }
  function commitLabels() {
    const next = [...new Set(labelsText.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 10);
    labelsText = next.join(', ');
    if (next.join('|') !== data.task.labels.join('|')) save({ labels: next });
  }

  /* checklist */
  async function addItem(e) {
    e.preventDefault();
    const t = newItem.trim();
    if (!t) return;
    try {
      const { item } = await api.post(`/tasks/${id}/checklist`, { title: t });
      data.checklist.push(item);
      newItem = '';
      bump();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function toggleItem(item) {
    const next = !item.done;
    item.done = next;
    try { await api.patch(`/checklist/${item.id}`, { done: next }); bump(); }
    catch (err) { item.done = !next; toast(err.message, 'error'); }
  }
  async function removeItem(item) {
    try {
      await api.del(`/checklist/${item.id}`);
      data.checklist = data.checklist.filter((i) => i.id !== item.id);
      bump();
    } catch (err) { toast(err.message, 'error'); }
  }

  /* comments */
  async function postComment(e) {
    e?.preventDefault();
    const body = newComment.trim();
    if (!body || postingComment) return;
    postingComment = true;
    try {
      const { comment } = await api.post(`/tasks/${id}/comments`, { body });
      data.comments.push(comment);
      newComment = '';
      bump();
    } catch (err) { toast(err.message, 'error'); }
    postingComment = false;
  }
  async function removeComment(c) {
    try {
      await api.del(`/comments/${c.id}`);
      data.comments = data.comments.filter((x) => x.id !== c.id);
      bump();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function removeTask() {
    const ok = await confirmDialog({
      title: `Delete ${data.task.ref}?`,
      message: 'This removes the task, its checklist and comments for everyone on the project.',
      confirmLabel: 'Delete task', danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/tasks/${id}`);
      toast('Task deleted');
      bump();
      onclose();
    } catch (err) { toast(err.message, 'error'); }
  }

  const memberOf = (uid) => data?.members.find((m) => m.id === uid);
  const canDeleteComment = (c) => canEdit && (c.user_id === data.my_id || data.my_role === 'owner');
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && !confirmState.open && !document.querySelector('.overlay')) onclose(); }} />

<button class="scrim" aria-label="Close task" onclick={onclose}></button>
<div class="drawer" role="dialog" aria-label="Task details" tabindex="-1" bind:this={panel}>
  {#if data}
    {@const t = data.task}
    <header>
      <a class="proj" href="/projects/{t.project_id}/board" title="Open project">
        <i style="background:{t.project_color}"></i>
        <span class="truncate">{t.project_name}</span>
      </a>
      <span class="ref" style="color:{t.project_color}">{t.ref}</span>
      <span class="spacer"></span>
      {#if canEdit}
        <button class="btn btn-ghost btn-icon btn-sm" aria-label="Delete task" title="Delete task" onclick={removeTask}><Icon name="trash" size={16} /></button>
      {/if}
      <button class="btn btn-ghost btn-icon btn-sm" aria-label="Close" onclick={onclose}><Icon name="x" size={18} /></button>
    </header>

    <div class="scroll">
      <input class="title" bind:value={title} aria-label="Task title" disabled={!canEdit} maxlength="200"
        onblur={commitTitle} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />

      {#if !canEdit}<p class="viewer">You have view-only access to this project.</p>{/if}

      <div class="props">
        <div class="field">
          <label for="d-status">Status</label>
          <select id="d-status" class="select" bind:value={f.status} disabled={!canEdit} onchange={() => commitField('status')}>
            {#each STATUSES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="d-prio">Priority</label>
          <select id="d-prio" class="select" bind:value={f.priority} disabled={!canEdit} onchange={() => commitField('priority')}>
            {#each PRIORITIES as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="d-assignee">Assignee</label>
          <select id="d-assignee" class="select" bind:value={f.assignee_id} disabled={!canEdit} onchange={() => commitField('assignee_id')}>
            <option value="">Unassigned</option>
            {#each data.members as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="d-est">Estimate (hours)</label>
          <input id="d-est" class="input" type="number" min="0" max="9999" step="0.5" bind:value={f.estimate_hours} disabled={!canEdit}
            placeholder="None" onchange={() => commitField('estimate_hours')} />
        </div>
        <div class="field">
          <label for="d-start">Start date</label>
          <input id="d-start" class="input" type="date" bind:value={f.start_date} disabled={!canEdit} max={f.due_date || undefined} onchange={() => commitField('start_date')} />
        </div>
        <div class="field">
          <label for="d-due">Due date</label>
          <input id="d-due" class="input" type="date" bind:value={f.due_date} disabled={!canEdit} min={f.start_date || undefined} onchange={() => commitField('due_date')} />
        </div>
      </div>

      <div class="field block">
        <label for="d-labels">Labels</label>
        <input id="d-labels" class="input" bind:value={labelsText} disabled={!canEdit} placeholder="design, frontend (separate with commas)" onblur={commitLabels}
          onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      </div>

      <div class="field block">
        <label for="d-desc">Description</label>
        <textarea id="d-desc" class="textarea" rows="5" bind:value={description} disabled={!canEdit} placeholder={canEdit ? 'Add context, links or acceptance criteria' : 'No description'} onblur={commitDescription}></textarea>
      </div>

      <section>
        <div class="sec-head">
          <h3><Icon name="checklist" size={16} /> Checklist</h3>
          {#if data.checklist.length}<span class="muted num">{doneCount} of {data.checklist.length}</span>{/if}
        </div>
        {#if data.checklist.length}
          <div class="bar"><div style="width:{pct}%"></div></div>
          <ul class="checks">
            {#each data.checklist as item (item.id)}
              <li>
                <label class:done={item.done}>
                  <input type="checkbox" checked={item.done} disabled={!canEdit} onchange={() => toggleItem(item)} />
                  <span>{item.title}</span>
                </label>
                {#if canEdit}<button class="x" aria-label="Remove item" onclick={() => removeItem(item)}><Icon name="x" size={14} /></button>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if canEdit}
          <form class="add" onsubmit={addItem}>
            <input class="input" bind:value={newItem} placeholder="Add a checklist item" maxlength="200" aria-label="New checklist item" />
            <button class="btn" type="submit" disabled={!newItem.trim()}>Add</button>
          </form>
        {:else if !data.checklist.length}
          <p class="muted small">No checklist items.</p>
        {/if}
      </section>

      <section>
        <div class="sec-head">
          <h3><Icon name="message" size={16} /> Comments</h3>
          {#if data.comments.length}<span class="muted num">{data.comments.length}</span>{/if}
        </div>
        <ul class="comments">
          {#each data.comments as c (c.id)}
            <li>
              <Avatar name={c.user_name ?? '?'} color={c.user_color ?? '#7a8c98'} size={28} />
              <div class="cbody">
                <div class="cmeta"><b>{c.user_name ?? 'Former member'}</b><span class="muted">{timeAgo(c.created_at)}</span>
                  {#if canDeleteComment(c)}<button class="x del" aria-label="Delete comment" onclick={() => removeComment(c)}><Icon name="trash" size={13} /></button>{/if}
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          {/each}
        </ul>
        {#if canEdit}
          <form class="cform" onsubmit={postComment}>
            <textarea class="textarea" rows="2" bind:value={newComment} placeholder="Write a comment" aria-label="New comment"
              onkeydown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && postComment(e)}></textarea>
            <div class="row"><span class="muted small">Ctrl+Enter to post</span><span class="spacer"></span>
              <button class="btn btn-primary btn-sm" type="submit" disabled={!newComment.trim() || postingComment}>Comment</button></div>
          </form>
        {/if}
      </section>

      <section>
        <button class="hist-toggle" onclick={() => (showHistory = !showHistory)} aria-expanded={showHistory}>
          <Icon name={showHistory ? 'chevron-down' : 'chevron-right'} size={16} /> History
          <span class="muted">{plural(data.activity.length, 'change')}</span>
        </button>
        {#if showHistory}
          <ul class="history">
            {#each data.activity as a (a.id)}
              {@const d = describeActivity({ ...a, project_key: t.project_key })}
              <li><b>{a.user_name ?? 'Someone'}</b> {d.verb}{#if d.tail} {d.tail}{/if}{#if a.action === 'task_created'} this task{/if}
                <span class="muted">{timeAgo(a.created_at)}</span></li>
            {/each}
          </ul>
        {/if}
      </section>
      <p class="foot muted">Created {new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        {#if memberOf(t.reporter_id)} by {memberOf(t.reporter_id).name}{/if}</p>
    </div>
  {:else if loadError}
    <header><span class="spacer"></span><button class="btn btn-ghost btn-icon btn-sm" aria-label="Close" onclick={onclose}><Icon name="x" size={18} /></button></header>
    <div class="empty"><h3>Couldn't open this task</h3><p>{loadError}</p><button class="btn" onclick={onclose}>Close</button></div>
  {:else}
    <header><span class="spacer"></span><button class="btn btn-ghost btn-icon btn-sm" aria-label="Close" onclick={onclose}><Icon name="x" size={18} /></button></header>
    <div class="scroll">
      <div class="skeleton" style="height:34px;width:80%;margin-bottom:22px"></div>
      <div class="skeleton" style="height:150px;margin-bottom:16px"></div>
      <div class="skeleton" style="height:90px"></div>
    </div>
  {/if}
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(13, 30, 43, 0.28); animation: fade 0.15s ease-out; }
  .drawer {
    position: fixed; z-index: 41; top: 0; right: 0; bottom: 0; width: min(580px, 100vw); display: flex; flex-direction: column;
    background: var(--surface); box-shadow: var(--float); outline: 0; animation: slide 0.22s var(--ease);
  }
  header { display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 22px; border-bottom: 1px solid var(--line); }
  .proj { display: inline-flex; align-items: center; gap: 7px; max-width: 220px; font-weight: 600; color: var(--text-2); font-size: 13px; }
  .proj:hover { color: var(--text); }
  .proj i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .ref { font-weight: 700; font-size: 13px; }
  .scroll { flex: 1; overflow-y: auto; padding: 18px 22px 32px; }
  .title {
    width: 100%; margin: 0 -8px 16px; padding: 6px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent;
    font-size: 21px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3;
  }
  .title:hover:not(:disabled) { border-color: var(--line); }
  .title:focus { outline: 0; border-color: var(--brand); background: var(--surface); box-shadow: 0 0 0 3px var(--brand-50); }
  .viewer { margin: -6px 0 14px; padding: 8px 12px; border-radius: 8px; background: var(--surface-3); color: var(--text-2); font-size: 13px; }
  .props { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .block { margin-bottom: 14px; }
  section { margin-top: 26px; }
  .sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  h3 { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; }
  .bar { height: 5px; border-radius: 99px; background: var(--surface-3); overflow: hidden; margin-bottom: 10px; }
  .bar div { height: 100%; background: var(--s-done); border-radius: 99px; transition: width 0.3s var(--ease); }
  .checks { display: grid; gap: 2px; margin-bottom: 10px; }
  .checks li { display: flex; align-items: center; gap: 4px; border-radius: 8px; }
  .checks li:hover { background: var(--surface-2); }
  .checks label { flex: 1; display: flex; align-items: flex-start; gap: 10px; padding: 6px 8px; cursor: pointer; }
  .checks label.done span { color: var(--text-3); text-decoration: line-through; }
  .checks input { margin-top: 3px; accent-color: var(--brand); width: 15px; height: 15px; }
  .x { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--text-3); opacity: 0; }
  li:hover .x, .x:focus-visible { opacity: 1; }
  .x:hover { background: var(--surface-3); color: var(--danger); }
  .add { display: flex; gap: 8px; }
  .comments { display: grid; gap: 16px; margin-bottom: 14px; }
  .comments li { display: flex; gap: 11px; }
  .cbody { flex: 1; min-width: 0; }
  .cmeta { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .cmeta .del { margin-left: auto; width: 22px; height: 22px; }
  .cbody p { margin-top: 2px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
  .cform { display: grid; gap: 8px; }
  .small { font-size: 12.5px; }
  .hist-toggle { display: flex; align-items: center; gap: 6px; padding: 4px 0; border: 0; background: transparent; font-weight: 700; font-size: 13.5px; }
  .history { display: grid; gap: 8px; margin: 10px 0 0 22px; font-size: 13px; color: var(--text-2); }
  .history .muted { margin-left: 6px; font-size: 12px; }
  .foot { margin-top: 26px; font-size: 12.5px; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes slide { from { transform: translateX(28px); opacity: 0; } }
  @media (max-width: 560px) { .props { grid-template-columns: 1fr; } }
</style>
