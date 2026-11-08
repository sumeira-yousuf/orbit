<script>
  import Avatar from './Avatar.svelte';
  import { describeActivity, timeAgo } from '../lib/utils.js';
  let { items = [] } = $props();
</script>

{#if !items.length}
  <p class="muted none">Nothing has happened yet. Activity shows up here as the team works.</p>
{:else}
  <ul>
    {#each items as a (a.id)}
      {@const d = describeActivity(a)}
      <li>
        <Avatar name={a.user_name ?? '?'} color={a.user_color ?? '#7a8c98'} size={26} />
        <div class="txt">
          <p>
            <b>{a.user_name ?? 'Someone'}</b> {d.verb}
            {#if d.target}<a class="ref" href="/projects/{a.project_id}/board{a.task_id ? `?task=${a.task_id}` : ''}">{d.target}</a>{/if}
            {#if d.title}<span class="title">{d.title}</span>{/if}
            {#if d.tail}<span> {d.tail}</span>{/if}
          </p>
          <time class="muted">{timeAgo(a.created_at)}{a.project_name && !d.target?.startsWith(a.project_key) ? ` in ${a.project_name}` : ''}</time>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul { display: grid; gap: 14px; }
  li { display: flex; gap: 11px; align-items: flex-start; }
  .txt { min-width: 0; font-size: 13.5px; line-height: 1.45; }
  .title { color: var(--text-2); }
  .ref { font-weight: 700; color: var(--brand-600); margin-right: 2px; }
  .ref:hover { text-decoration: underline; }
  time { font-size: 12px; }
  .none { font-size: 13.5px; }
</style>
