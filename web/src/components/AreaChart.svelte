<script>
  import { fmtDate } from '../lib/utils.js';
  let { data = [] } = $props();

  let w = $state(560);
  let hover = $state(null);
  const h = 196;
  const pad = { t: 14, r: 14, b: 28, l: 30 };

  const peak = $derived(Math.max(0, ...data.map((d) => Math.max(d.created, d.completed))));
  const yMax = $derived(Math.max(4, Math.ceil(peak / 4) * 4));
  const ticks = $derived([0, 1, 2, 3, 4].map((i) => (yMax * i) / 4));
  const n = $derived(Math.max(1, data.length - 1));
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / n;
  const y = (v) => pad.t + (1 - v / yMax) * (h - pad.t - pad.b);

  const line = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = $derived(
    data.length ? `${line('completed')} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : ''
  );
  const totalDone = $derived(data.reduce((s, d) => s + d.completed, 0));
  const totalNew = $derived(data.reduce((s, d) => s + d.created, 0));

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    hover = Math.min(data.length - 1, Math.max(0, Math.round(((px - pad.l) / (w - pad.l - pad.r)) * n)));
  }
</script>

<div class="wrap" bind:clientWidth={w}>
  <div class="legend">
    <span><i style="background:var(--brand)"></i>Completed <b class="num">{totalDone}</b></span>
    <span><i style="background:var(--s-todo)"></i>Created <b class="num">{totalNew}</b></span>
  </div>
  <svg
    width={w} height={h} viewBox="0 0 {w} {h}" role="img"
    aria-label="Tasks created and completed per day over the last {data.length} days"
    onpointermove={move} onpointerleave={() => (hover = null)}
  >
    <defs>
      <linearGradient id="fillDone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.28" />
        <stop offset="100%" stop-color="var(--brand)" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    {#each ticks as t (t)}
      <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" stroke-dasharray={t === 0 ? '' : '3 4'} />
      <text x={pad.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle" class="ax">{t}</text>
    {/each}
    {#each data as d, i (d.day)}
      {#if i % 3 === 0 || i === data.length - 1}
        <text x={x(i)} y={h - 8} text-anchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} class="ax">{fmtDate(d.day)}</text>
      {/if}
    {/each}
    <path d={area} fill="url(#fillDone)" />
    <path d={line('created')} fill="none" stroke="var(--s-todo)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <path d={line('completed')} fill="none" stroke="var(--brand)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
    {#if hover !== null}
      <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="var(--line-strong)" />
      <circle cx={x(hover)} cy={y(data[hover].completed)} r="4.5" fill="var(--brand)" stroke="#fff" stroke-width="2" />
      <circle cx={x(hover)} cy={y(data[hover].created)} r="4.5" fill="var(--s-todo)" stroke="#fff" stroke-width="2" />
    {/if}
  </svg>
  {#if hover !== null}
    <div class="tip" style="left:{Math.min(Math.max(x(hover) - 62, 0), w - 132)}px">
      <b>{fmtDate(data[hover].day, { weekday: true })}</b>
      <span><i style="background:var(--brand)"></i>{data[hover].completed} completed</span>
      <span><i style="background:var(--s-todo)"></i>{data[hover].created} created</span>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; width: 100%; }
  svg { display: block; touch-action: pan-y; }
  .ax { font-size: 11px; fill: var(--text-3); font-variant-numeric: tabular-nums; }
  .legend { display: flex; gap: 16px; font-size: 12.5px; color: var(--text-2); margin-bottom: 4px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend b { color: var(--text); }
  i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none; }
  .tip {
    position: absolute; top: 28px; width: 132px; padding: 8px 10px; border-radius: 8px; pointer-events: none;
    background: var(--side); color: #fff; font-size: 12px; display: grid; gap: 2px; box-shadow: var(--float);
  }
  .tip span { display: flex; align-items: center; gap: 6px; color: #cfdde6; }
</style>
