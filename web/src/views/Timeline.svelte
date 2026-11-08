<script>
  import { onMount, tick } from 'svelte';
  import Avatar from '../components/Avatar.svelte';
  import { addDays, diffDays, todayStr, parseDate, fmtDate } from '../lib/utils.js';
  import { openTask } from '../lib/router.svelte.js';

  let { tasks, project, canEdit, onpatch } = $props();

  const ZOOMS = { day: 38, week: 20, month: 8 };
  const LABEL_W = 290;
  const today = todayStr();

  let zoom = $state('week');
  let showDone = $state(false);
  let scroller = $state();
  let drag = $state(null);
  const dayW = $derived(ZOOMS[zoom]);

  const startOf = (t) => t.start_date ?? t.due_date;
  const endOf = (t) => t.due_date ?? t.start_date;

  const doneCount = $derived(tasks.filter((t) => t.status === 'done' && (t.start_date || t.due_date)).length);
  const scheduled = $derived(
    tasks.filter((t) => (t.start_date || t.due_date) && (showDone || t.status !== 'done')).sort((a, b) => startOf(a).localeCompare(startOf(b)) || endOf(a).localeCompare(endOf(b)) || a.id - b.id)
  );
  const unscheduled = $derived(tasks.filter((t) => !t.start_date && !t.due_date && t.status !== 'done'));

  const range = $derived.by(() => {
    const dates = [today];
    for (const t of scheduled) dates.push(startOf(t), endOf(t));
    if (project?.start_date) dates.push(project.start_date);
    if (project?.due_date) dates.push(project.due_date);
    dates.sort();
    let start = addDays(dates[0], -4);
    const dow = (parseDate(start).getDay() + 6) % 7; // Monday = 0
    start = addDays(start, -dow);
    const days = Math.max(49, diffDays(addDays(dates[dates.length - 1], 12), start) + 1);
    return { start, days };
  });

  const days = $derived(
    Array.from({ length: range.days }, (_, i) => {
      const date = addDays(range.start, i);
      const d = parseDate(date);
      return { date, i, dow: (d.getDay() + 6) % 7, dom: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
    })
  );
  const months = $derived.by(() => {
    const out = [];
    for (const d of days) {
      const last = out[out.length - 1];
      if (last && last.month === d.month && last.year === d.year) last.n += 1;
      else out.push({ month: d.month, year: d.year, n: 1, first: d.date });
    }
    return out.map((m) => ({ ...m, label: parseDate(m.first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }));
  });
  const ticks = $derived(zoom === 'day' ? days : days.filter((d) => d.dow === 0));
  const totalW = $derived(range.days * dayW);
  const xOf = (date) => diffDays(date, range.start) * dayW;
  const todayX = $derived(xOf(today) + dayW / 2);

  function span(t) {
    let s = startOf(t);
    let e = endOf(t);
    if (drag?.id === t.id) {
      const len = diffDays(drag.e0, drag.s0);
      if (drag.mode === 'move') { s = addDays(drag.s0, drag.dd); e = addDays(drag.e0, drag.dd); }
      else if (drag.mode === 'start') s = addDays(drag.s0, Math.min(drag.dd, len));
      else e = addDays(drag.e0, Math.max(drag.dd, -len));
    }
    return { s, e };
  }
  const progress = (t) => (t.status === 'done' ? 1 : t.checklist_total ? t.checklist_done / t.checklist_total : 0);

  function down(e, t, mode) {
    if (e.button !== 0) return;
    if (!canEdit) { return; }
    e.preventDefault();
    e.stopPropagation();
    drag = { id: t.id, mode, x0: e.clientX, s0: startOf(t), e0: endOf(t), dd: 0, moved: false };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }
  function move(e) {
    if (!drag) return;
    drag.dd = Math.round((e.clientX - drag.x0) / dayW);
    if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
  }
  function cleanup() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointercancel', cancel);
  }
  function cancel() { cleanup(); drag = null; }
  function up() {
    cleanup();
    const d = drag;
    if (!d) return;
    const t = tasks.find((x) => x.id === d.id);
    const { s, e } = span(t);
    drag = null;
    if (!d.moved) { openTask(d.id); return; }
    if (d.dd === 0 || !t) return;
    onpatch(d.id, { start_date: s, due_date: e });
  }

  function schedule(t, e) {
    if (!canEdit) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const s = addDays(range.start, Math.floor(x / dayW));
    onpatch(t.id, { start_date: s, due_date: addDays(s, 2) });
  }

  async function focusToday() {
    await tick();
    if (scroller) scroller.scrollLeft = Math.max(0, todayX - 220);
  }
  onMount(focusToday);
  function setZoom(z) { zoom = z; focusToday(); }
</script>

<div class="bar">
  <div class="seg-ctl" role="group" aria-label="Zoom">
    {#each Object.keys(ZOOMS) as z (z)}
      <button class:on={zoom === z} onclick={() => setZoom(z)}>{z === 'day' ? 'Days' : z === 'week' ? 'Weeks' : 'Months'}</button>
    {/each}
  </div>
  <button class="btn btn-sm" onclick={focusToday}>Jump to today</button>
  {#if doneCount}
    <label class="chk"><input type="checkbox" bind:checked={showDone} onchange={focusToday} /> Show completed ({doneCount})</label>
  {/if}
  <span class="muted hint">{canEdit ? 'Drag a bar to reschedule it, or drag its edges to change the length.' : 'View only.'}</span>
</div>

<div class="card frame">
  {#if !scheduled.length && !unscheduled.length}
    <div class="empty"><h3>{doneCount ? 'Everything with a date is done' : 'No tasks to plan'}</h3>
      <p>{doneCount ? 'Turn on "Show completed" to see finished work on the timeline.' : 'Add tasks with start and due dates and they appear here as bars.'}</p></div>
  {:else}
    <div class="scroller" bind:this={scroller}>
      <div class="gantt" style="width:{LABEL_W + totalW}px">
        <div class="head">
          <div class="corner" style="width:{LABEL_W}px">Task</div>
          <div class="axis" style="width:{totalW}px">
            <div class="months">
              {#each months as m (m.first)}<div class="mcell" style="width:{m.n * dayW}px"><span>{m.label}</span></div>{/each}
            </div>
            <span class="todaytag" style="left:{todayX}px">Today</span>
            <div class="ticks">
              {#each ticks as d (d.date)}
                <div class="tick" class:wk={d.dow > 4} class:isToday={d.date === today}
                  style="left:{d.i * dayW}px;width:{zoom === 'day' ? dayW : 7 * dayW}px">{d.dom}</div>
              {/each}
            </div>
          </div>
        </div>

        <div class="body">
          <div class="grid" style="left:{LABEL_W}px;width:{totalW}px" aria-hidden="true">
            {#each days as d (d.date)}
              {#if d.dow > 4}<div class="wkend" style="left:{d.i * dayW}px;width:{dayW}px"></div>{/if}
              {#if d.dow === 0 && zoom !== 'month'}<div class="vline" style="left:{d.i * dayW}px"></div>{/if}
            {/each}
            {#if project?.start_date}<div class="mark" style="left:{xOf(project.start_date)}px" title="Project start {fmtDate(project.start_date)}"></div>{/if}
            {#if project?.due_date}<div class="mark end" style="left:{xOf(project.due_date) + dayW}px" title="Project due {fmtDate(project.due_date)}"></div>{/if}
            <div class="today" style="left:{todayX}px"></div>
          </div>

          {#each scheduled as t (t.id)}
            {@const sp = span(t)}
            {@const w = Math.max(12, (diffDays(sp.e, sp.s) + 1) * dayW - 3)}
            {@const late = t.status !== 'done' && endOf(t) < today}
            <div class="trow">
              <button class="label" style="width:{LABEL_W}px" onclick={() => openTask(t.id)}>
                <span class="ref" style="color:{t.project_color}">{t.ref}</span>
                <span class="ttl truncate">{t.title}</span>
                <Avatar name={t.assignee_name ?? ''} color={t.assignee_color} size={22} />
              </button>
              <div class="track" style="width:{totalW}px">
                <div
                  class="barx" class:late class:dragging={drag?.id === t.id} class:ro={!canEdit}
                  style="left:{xOf(sp.s) + 1}px;width:{w}px;--c:var(--s-{t.status})"
                  role="button" tabindex="0" aria-label="{t.ref} {t.title}, {fmtDate(sp.s)} to {fmtDate(sp.e)}"
                  onpointerdown={(e) => down(e, t, 'move')}
                  onclick={() => { if (!canEdit) openTask(t.id); }}
                  onkeydown={(e) => e.key === 'Enter' && openTask(t.id)}
                >
                  <span class="fill" style="width:{progress(t) * 100}%"></span>
                  {#if canEdit}
                    <span class="grip l" onpointerdown={(e) => down(e, t, 'start')} role="presentation"></span>
                    <span class="grip r" onpointerdown={(e) => down(e, t, 'end')} role="presentation"></span>
                  {/if}
                  {#if w > 110}<span class="in truncate">{t.title}</span>{/if}
                </div>
                {#if w <= 110}<span class="out truncate" style="left:{xOf(sp.e) + dayW + 6}px">{t.title}</span>{/if}
                {#if drag?.id === t.id}
                  <span class="tip" style="left:{xOf(sp.s)}px">{fmtDate(sp.s)} to {fmtDate(sp.e)}</span>
                {/if}
              </div>
            </div>
          {/each}

          {#if unscheduled.length}
            <div class="trow subhead"><div class="label plain" style="width:{LABEL_W}px">No dates yet ({unscheduled.length})</div><div class="track" style="width:{totalW}px"></div></div>
            {#each unscheduled as t (t.id)}
              <div class="trow">
                <button class="label" style="width:{LABEL_W}px" onclick={() => openTask(t.id)}>
                  <span class="ref" style="color:{t.project_color}">{t.ref}</span>
                  <span class="ttl truncate">{t.title}</span>
                  <Avatar name={t.assignee_name ?? ''} color={t.assignee_color} size={22} />
                </button>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="track" class:can={canEdit} style="width:{totalW}px" role="presentation" onclick={(e) => schedule(t, e)}>
                  {#if canEdit}<span class="sched" style="left:{Math.max(todayX, 0) + 12}px">Click a day to schedule</span>{/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .hint { font-size: 12.5px; }
  .seg-ctl { display: inline-flex; padding: 3px; border-radius: 9px; background: var(--surface-3); }
  .seg-ctl button { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .seg-ctl button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(13, 30, 43, 0.12); }

  .frame { overflow: hidden; }
  .scroller { overflow: auto; max-height: calc(100vh - 270px); min-height: 320px; position: relative; }
  .gantt { position: relative; }
  .head { position: sticky; top: 0; z-index: 6; display: flex; background: var(--surface); border-bottom: 1px solid var(--line-strong); }
  .corner {
    position: sticky; left: 0; z-index: 7; flex: none; display: flex; align-items: flex-end; padding: 0 14px 8px;
    background: var(--surface); border-right: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--text-3);
  }
  .axis { position: relative; flex: none; height: 54px; }
  .months { display: flex; height: 28px; border-bottom: 1px solid var(--line); }
  .mcell { flex: none; padding: 5px 10px; border-left: 1px solid var(--line); font-size: 12.5px; font-weight: 700; overflow: hidden; white-space: nowrap; }
  .mcell:first-child { border-left: 0; }
  .mcell span { position: sticky; left: 0; }
  .ticks { position: relative; height: 26px; }
  .chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; }
  .chk input { accent-color: var(--brand); width: 15px; height: 15px; }
  .tick { position: absolute; top: 0; height: 26px; padding: 4px 0 0 6px; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; border-left: 1px solid var(--surface-3); overflow: hidden; }
  .tick.wk { color: #a6b3bb; }
  .tick.isToday { color: transparent; }

  .body { position: relative; }
  .grid { position: absolute; top: 0; bottom: 0; z-index: 0; pointer-events: none; }
  .wkend { position: absolute; top: 0; bottom: 0; background: rgba(13, 30, 43, 0.035); }
  .vline { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--surface-3); }
  .mark { position: absolute; top: 0; bottom: 0; width: 0; border-left: 2px dashed #b7c4cb; }
  .today { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--brand); z-index: 3; }
  .todaytag {
    position: absolute; z-index: 3; top: 33px; transform: translateX(-50%); padding: 1px 8px; border-radius: 99px;
    background: var(--brand); color: #fff; font-size: 11px; font-weight: 700; line-height: 17px;
  }

  .trow { position: relative; display: flex; align-items: stretch; gap: 0; height: 40px; border-bottom: 1px solid var(--surface-3); z-index: 1; }
  .trow:hover .label { background: var(--surface-2); }
  .label {
    position: sticky; left: 0; z-index: 5; flex: none; display: flex; align-items: center; gap: 9px; padding: 0 12px 0 14px;
    border: 0; border-right: 1px solid var(--line); background: var(--surface); text-align: left; font-size: 13px;
  }
  .label.plain { font-weight: 700; color: var(--text-2); background: var(--surface-2); cursor: default; }
  .subhead { background: var(--surface-2); }
  .ref { font-size: 12px; font-weight: 700; flex: none; width: 54px; }
  .ttl { flex: 1; min-width: 0; font-weight: 600; }

  .track { position: relative; flex: none; height: 100%; }
  .track.can { cursor: copy; }
  .sched { position: absolute; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-3); opacity: 0; transition: opacity 0.12s; white-space: nowrap; }
  .track.can:hover .sched { opacity: 1; }

  .barx {
    position: absolute; top: 8px; height: 24px; border-radius: 7px; overflow: hidden; display: flex; align-items: center;
    background: color-mix(in srgb, var(--c) 16%, white); border: 1px solid color-mix(in srgb, var(--c) 50%, white);
    cursor: grab; touch-action: none; user-select: none;
  }
  .barx.ro { cursor: pointer; }
  .barx.dragging { cursor: grabbing; box-shadow: var(--float); z-index: 4; }
  .barx.late { border-color: var(--danger); box-shadow: inset 0 0 0 1px var(--danger); }
  .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--c) 62%, white); border-right: 2px solid var(--c); }
  .in { position: relative; padding: 0 10px; font-size: 12px; font-weight: 700; color: #0d1e2b; }
  .grip { position: absolute; top: 0; bottom: 0; width: 8px; cursor: ew-resize; z-index: 2; }
  .grip.l { left: 0; } .grip.r { right: 0; }
  .grip:hover { background: rgba(13, 30, 43, 0.25); }
  .out { position: absolute; top: 11px; max-width: 220px; font-size: 12px; font-weight: 600; color: var(--text-2); pointer-events: none; }
  .tip {
    position: absolute; top: -22px; padding: 2px 8px; border-radius: 6px; background: var(--side); color: #fff; font-size: 11.5px; font-weight: 600;
    white-space: nowrap; z-index: 8; pointer-events: none;
  }
</style>
