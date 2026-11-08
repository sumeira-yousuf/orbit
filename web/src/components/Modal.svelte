<script>
  import Icon from './Icon.svelte';
  let { title, onclose, width = 520, children, footer } = $props();
  let downOnBackdrop = false;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose?.()} />

<div
  class="overlay" role="presentation"
  onmousedown={(e) => (downOnBackdrop = e.target === e.currentTarget)}
  onmouseup={(e) => { if (downOnBackdrop && e.target === e.currentTarget) onclose?.(); downOnBackdrop = false; }}
>
  <div class="modal" role="dialog" aria-modal="true" aria-label={title} style="max-width:{width}px">
    <header>
      <h2>{title}</h2>
      <button class="btn btn-ghost btn-icon btn-sm" aria-label="Close" onclick={onclose}><Icon name="x" /></button>
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 60; display: grid; place-items: start center; overflow-y: auto;
    padding: 6vh 16px 32px; background: rgba(13, 30, 43, 0.45); animation: fade 0.14s ease-out;
  }
  .modal {
    width: 100%; background: var(--surface); border-radius: 14px; box-shadow: var(--float);
    animation: pop 0.18s var(--ease);
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0 22px; }
  h2 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
  .body { padding: 16px 22px 20px; }
  footer {
    display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 14px 22px;
    border-top: 1px solid var(--line); background: var(--surface-2); border-radius: 0 0 14px 14px;
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } }
</style>
