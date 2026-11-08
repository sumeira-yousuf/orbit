<script>
  import { STATUS } from '../lib/utils.js';
  let { status } = $props();
</script>

<span class="pill" style="--c:var(--s-{status})">{STATUS[status]?.label ?? status}</span>
