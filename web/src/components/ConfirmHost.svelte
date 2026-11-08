<script>
  import Modal from './Modal.svelte';
  import { confirmState } from '../lib/state.svelte.js';

  function done(result) {
    confirmState.resolve?.(result);
    confirmState.open = false;
  }
</script>

{#if confirmState.open}
  <Modal title={confirmState.title} width={440} onclose={() => done(false)}>
    {#if confirmState.message}<p class="msg">{confirmState.message}</p>{/if}
    {#snippet footer()}
      <button class="btn" onclick={() => done(false)}>Cancel</button>
      <button class="btn {confirmState.danger ? 'btn-danger-solid' : 'btn-primary'}" onclick={() => done(true)}>{confirmState.confirmLabel}</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .msg { color: var(--text-2); line-height: 1.55; }
</style>
