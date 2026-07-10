<script>
  import { toastState, toast, updateReady } from '../lib/toast.js'
</script>

{#if $updateReady}
  <div class="toast" role="status" style="bottom: 4.25rem">
    <span>Update available</span>
    <button onclick={() => $updateReady.reload()}>Reload</button>
    <button onclick={() => updateReady.set(null)}>Later</button>
  </div>
{/if}

{#if $toastState}
  <div class="toast" role="status">
    <span>{$toastState.message}</span>
    {#if $toastState.action}
      <button
        onclick={() => {
          $toastState.action.fn()
          toast.hide()
        }}
      >
        {$toastState.action.label}
      </button>
    {/if}
  </div>
{/if}
