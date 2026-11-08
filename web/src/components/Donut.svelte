<script>
  import { STATUS_STACK } from '../lib/utils.js';
  let { counts = {}, size = 148, thickness = 16, label = 'tasks' } = $props();

  const total = $derived(STATUS_STACK.reduce((n, k) => n + (counts[k] || 0), 0));
  const r = $derived((size - thickness) / 2);
  const C = $derived(2 * Math.PI * r);
  const segs = $derived.by(() => {
    let acc = 0;
    return STATUS_STACK.filter((k) => counts[k]).map((k) => {
      const len = (counts[k] / total) * C;
      const seg = { k, len, off: acc };
      acc += len;
      return seg;
    });
  });
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label="{total} {label}">
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--surface-3)" stroke-width={thickness} />
  {#each segs as s (s.k)}
    <circle
      cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--s-{s.k})" stroke-width={thickness}
      stroke-dasharray="{Math.max(0, s.len - (segs.length > 1 ? 2 : 0))} {C}" stroke-dashoffset={-s.off}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  {/each}
  <text x="50%" y="48%" text-anchor="middle" dominant-baseline="middle" class="big">{total}</text>
  <text x="50%" y="63%" text-anchor="middle" dominant-baseline="middle" class="small">{label}</text>
</svg>

<style>
  .big { font-size: 28px; font-weight: 700; fill: var(--text); letter-spacing: -0.02em; }
  .small { font-size: 12px; fill: var(--text-3); font-weight: 600; }
</style>
