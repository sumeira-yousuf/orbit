<script>
  import Icon from '../components/Icon.svelte';
  import Avatar from '../components/Avatar.svelte';
  import PriorityTag from '../components/PriorityTag.svelte';
  import { STATUSES, dueInfo, todayStr, focusOnMount } from '../lib/utils.js';
  import { openTask } from '../lib/router.svelte.js';

  let { tasks, canEdit, onpatch, oncreate } = $props();
  const today = todayStr();

  const columns = $derived.by(() => {
    const out = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    for (const t of tasks) out[t.status]?.push(t);
    for (const k in out) out[k].sort((a, b) => a.position - b.position || a.id - b.id);
    return out;
  });

  let dragId = $state(null);
  let over = $state(null); // { status, index } - index among the column's cards, ignoring the one being dragged
  let adding = $state(null);
  let draft = $state('');

  const visible = (status) => columns[status].filter((t) => t.id !== dragId);

  function dragStart(e, t) {
    dragId = t.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(t.id));
  }
  const dragEnd = () => { dragId = null; over = null; };

  function dragOver(e, status) {
    if (dragId == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cards = [...e.currentTarget.querySelectorAll('[data-card]')].filter((el) => Number(el.dataset.id) !== dragId);
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = i; break; }
    }
    if (over?.status !== status || over?.index !== index) over = { status, index };
  }
  function dragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) over = null;
  }
  function drop(e, status) {
    e.preventDefault();
    if (dragId == null || !over) return dragEnd();
    const list = visible(status);
    const idx = Math.min(over.index, list.length);
    const prev = list[idx - 1]?.position;
    const next = list[idx]?.position;
    const position =
      prev == null && next == null ? 1000 : prev == null ? next - 1000 : next == null ? prev + 1000 : (prev + next) / 2;
    const id = dragId;
    dragEnd();
    onpatch(id, { status, position });
  }

  const lineBefore = (status, t) =>
    over?.status === status && t.id !== dragId && visible(status).findIndex((x) => x.id === t.id) === over.index;
  const lineAtEnd = (status) => over?.status === status && over.index >= visible(status).length;

  function openComposer(status) { adding = status; draft = ''; }
  async function submitDraft(e, status) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    draft = '';
    await oncreate(status, title);
  }
</script>

<div class="board">
  {#each STATUSES as s (s.id)}
    {@const list = columns[s.id]}
    <section class="col" class:hot={over?.status === s.id} aria-label={s.label}>
      <header>
        <i style="background:var(--s-{s.id})"></i>
        <h3>{s.label}</h3>
        <span class="count num">{list.length}</span>
        <span class="spacer"></span>
        {#if canEdit}
          <button class="plus" aria-label="Add task to {s.label}" onclick={() => openComposer(s.id)}><Icon name="plus" size={16} stroke={2.2} /></button>
        {/if}
      </header>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="cards" ondragover={(e) => dragOver(e, s.id)} ondragleave={dragLeave} ondrop={(e) => drop(e, s.id)}>
        {#each list as t (t.id)}
          {@const due = dueInfo(t, today)}
          {#if lineBefore(s.id, t)}<div class="drop"></div>{/if}
          <div
            class="tcard" class:dragging={dragId === t.id} class:done={t.status === 'done'}
            data-card data-id={t.id} role="button" draggable={canEdit} tabindex="0"
            ondragstart={(e) => dragStart(e, t)} ondragend={dragEnd}
            onclick={() => openTask(t.id)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(t.id); } }}
          >
            <div class="top">
              <span class="ref">{t.ref}</span>
              {#if t.priority === 'urgent' || t.priority === 'high'}<PriorityTag priority={t.priority} label={false} />{/if}
            </div>
            <p class="title">{t.title}</p>
            {#if t.labels.length}
              <div class="labels">{#each t.labels.slice(0, 3) as l (l)}<span class="chip">{l}</span>{/each}</div>
            {/if}
            <div class="foot">
              {#if due}<span class="chip {due.tone === 'muted' ? '' : due.tone}"><Icon name="calendar" size={12} />{due.text}</span>{/if}
              {#if t.checklist_total}<span class="meta num" title="Checklist"><Icon name="checklist" size={13} />{t.checklist_done}/{t.checklist_total}</span>{/if}
              {#if t.comment_count}<span class="meta num" title="Comments"><Icon name="message" size={13} />{t.comment_count}</span>{/if}
              <span class="spacer"></span>
              <Avatar name={t.assignee_name ?? ''} color={t.assignee_color} size={24} />
            </div>
          </div>
        {/each}
        {#if lineAtEnd(s.id)}<div class="drop"></div>{/if}

        {#if !list.length && over?.status !== s.id && adding !== s.id}
          <p class="hint">{canEdit ? 'Drop a task here or add one' : 'Nothing here'}</p>
        {/if}
      </div>

      {#if adding === s.id}
        <form class="composer" onsubmit={(e) => submitDraft(e, s.id)}>
          <textarea
            class="textarea" rows="2" bind:value={draft} placeholder="Task title, then Enter" maxlength="200" aria-label="New task title"
            use:focusOnMount
            onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submitDraft(e, s.id); else if (e.key === 'Escape') adding = null; }}
          ></textarea>
          <div class="row"><button class="btn btn-primary btn-sm" type="submit" disabled={!draft.trim()}>Add task</button>
            <button class="btn btn-ghost btn-sm" type="button" onclick={() => (adding = null)}>Done</button></div>
        </form>
      {/if}
    </section>
  {/each}
</div>

<style>
  .board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(244px, 1fr); gap: 14px; align-items: start; overflow-x: auto; padding-bottom: 12px; }
  .col { display: flex; flex-direction: column; background: var(--surface-3); border-radius: 14px; padding: 6px; min-height: 160px; transition: background 0.12s; }
  .col.hot { background: #e2ebee; }
  header { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; }
  header i { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  h3 { font-size: 13.5px; font-weight: 700; }
  .count { font-size: 12px; font-weight: 700; color: var(--text-3); }
  .plus { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 7px; background: transparent; color: var(--text-2); }
  .plus:hover { background: rgba(255, 255, 255, 0.8); color: var(--text); }
  .cards { display: flex; flex-direction: column; gap: 8px; min-height: 60px; padding: 2px; flex: 1; }
  .hint { padding: 22px 8px; text-align: center; color: var(--text-3); font-size: 13px; }
  .tcard {
    display: grid; gap: 8px; padding: 11px 12px 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
    cursor: pointer; transition: border-color 0.12s, transform 0.12s;
  }
  .tcard[draggable='true'] { cursor: grab; }
  .tcard:hover { border-color: #b4c3cb; }
  .tcard.dragging { opacity: 0.35; }
  .tcard.done .title { color: var(--text-3); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .ref { font-size: 12px; font-weight: 700; color: var(--text-3); }
  .title { font-weight: 600; line-height: 1.38; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .labels { display: flex; flex-wrap: wrap; gap: 5px; }
  .foot { display: flex; align-items: center; gap: 9px; min-height: 24px; }
  .meta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-3); }
  .drop { height: 3px; border-radius: 3px; background: var(--brand); margin: -4px 0; }
  .composer { display: grid; gap: 8px; padding: 6px 2px 4px; }
  .composer .textarea { min-height: 62px; }
</style>
