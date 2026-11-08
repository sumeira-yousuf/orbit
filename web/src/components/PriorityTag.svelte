<script>
  import Icon from './Icon.svelte';
  import { PRIORITY } from '../lib/utils.js';
  let { priority, label = true } = $props();
</script>

<span class="pr" style="color:var(--p-{priority})" title="{PRIORITY[priority]?.label} priority">
  <Icon name="flag" size={13} stroke={2.2} />
  {#if label}<span class="t">{PRIORITY[priority]?.label}</span>{/if}
</span>

<style>
  .pr { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }
  .t { color: var(--text-2); }
</style>
