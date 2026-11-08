<script>
  import { toasts } from '../lib/state.svelte.js';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast" class:error={t.type === 'error'} role="status">{t.message}</div>
  {/each}
</div>

<style>
  .toasts { position: fixed; z-index: 90; right: 20px; bottom: 20px; display: grid; gap: 8px; max-width: min(380px, calc(100vw - 32px)); }
  .toast {
    padding: 11px 16px; border-radius: 10px; background: var(--side); color: #fff; font-weight: 600; font-size: 13.5px;
    box-shadow: var(--float); animation: in 0.2s var(--ease);
  }
  .toast.error { background: #8f2525; }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
  @media (max-width: 600px) { .toasts { right: 16px; left: 16px; max-width: none; } }
</style>
