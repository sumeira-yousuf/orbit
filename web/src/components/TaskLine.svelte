<script>
  import Avatar from './Avatar.svelte';
  import PriorityTag from './PriorityTag.svelte';
  import { dueInfo } from '../lib/utils.js';
  import { openTask } from '../lib/router.svelte.js';
  let { task, showProject = true, showAssignee = false } = $props();
  const due = $derived(dueInfo(task));
</script>

<button class="line" onclick={() => openTask(task.id)}>
  <PriorityTag priority={task.priority} label={false} />
  <span class="body">
    <span class="title truncate">{task.title}</span>
    <span class="sub muted truncate">
      <span class="ref" style="--c:{task.project_color}">{task.ref}</span>{#if showProject}<span class="pn">{task.project_name}</span>{/if}
    </span>
  </span>
  {#if due}<span class="chip {due.tone === 'muted' ? '' : due.tone}">{due.text}</span>{/if}
  {#if showAssignee}<Avatar name={task.assignee_name ?? ''} color={task.assignee_color} size={24} />{/if}
</button>

<style>
  .line {
    display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; margin: 0 -10px; width: calc(100% + 20px);
    border: 0; border-radius: 8px; background: transparent; text-align: left;
  }
  .line:hover { background: var(--surface-2); }
  .body { flex: 1; min-width: 0; display: grid; }
  .title { font-weight: 600; font-size: 13.5px; }
  .sub { font-size: 12px; }
  .ref { font-weight: 700; color: color-mix(in srgb, var(--c) 75%, black); }
  .pn { margin-left: 7px; }
</style>
