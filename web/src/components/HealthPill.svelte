<script>
  import { HEALTH } from '../lib/utils.js';
  let { health, reason = '' } = $props();
</script>

<span class="pill" style="--c:var(--h-{health})" title={reason}>{HEALTH[health]?.label ?? health}</span>
