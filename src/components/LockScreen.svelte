<script>
  import { hasVault, createVault, unlock } from '../lib/repo.js'

  let pass = $state('')
  let confirmPass = $state('')
  let understood = $state(false)
  let error = $state('')
  let busy = $state(false)

  const canCreate = $derived(pass.length >= 8 && pass === confirmPass && understood)

  async function submitCreate(e) {
    e.preventDefault()
    if (!canCreate || busy) return
    busy = true
    error = ''
    try {
      await createVault(pass)
    } catch (err) {
      error =
        err.message === 'vault-exists'
          ? 'A passphrase was already created for this device (possibly in another tab). Reload this page to unlock.'
          : 'Could not set up encrypted storage. Reload the page and try again.'
    } finally {
      busy = false
    }
  }

  async function submitUnlock(e) {
    e.preventDefault()
    if (!pass || busy) return
    busy = true
    error = ''
    try {
      const ok = await unlock(pass)
      if (!ok) {
        error = 'Incorrect passphrase.'
        pass = ''
      }
    } catch {
      error = 'Something went wrong while unlocking. Reload the page and try again.'
    } finally {
      busy = false
    }
  }
</script>

<div class="lock-wrap">
  <div class="lock-card">
    <h1>SOAP Note Builder</h1>
    {#if $hasVault === null}
      <p class="muted">Loading…</p>
    {:else if $hasVault === false}
      <p class="muted">Create a passphrase to get started.</p>
      <form onsubmit={submitCreate}>
        <div class="field">
          <label for="new-pass">Passphrase (at least 8 characters)</label>
          <input id="new-pass" type="password" bind:value={pass} autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="confirm-pass">Confirm passphrase</label>
          <input
            id="confirm-pass"
            type="password"
            bind:value={confirmPass}
            autocomplete="new-password"
          />
          {#if confirmPass && pass !== confirmPass}
            <p class="error-text">Passphrases do not match.</p>
          {/if}
        </div>
        <div class="warning-box">
          <strong>Your passphrase cannot be recovered.</strong> All data is encrypted with it on
          this device only. If you forget the passphrase, your data is permanently lost. Export a
          backup regularly (Settings → Backup).
        </div>
        <div class="field">
          <label style="display:flex; gap:0.5rem; align-items:flex-start; font-size:0.9rem; color:var(--ink)">
            <input type="checkbox" bind:checked={understood} style="margin-top:0.2rem" />
            <span>I understand that losing my passphrase means losing my data.</span>
          </label>
        </div>
        <button class="btn-primary" type="submit" disabled={!canCreate || busy} style="width:100%">
          {busy ? 'Setting up…' : 'Create and unlock'}
        </button>
      </form>
    {:else}
      <p class="muted">Enter your passphrase to unlock.</p>
      <form onsubmit={submitUnlock}>
        <div class="field">
          <label for="unlock-pass">Passphrase</label>
          <input
            id="unlock-pass"
            type="password"
            bind:value={pass}
            autocomplete="current-password"
          />
        </div>
        {#if error}<p class="error-text">{error}</p>{/if}
        <button class="btn-primary" type="submit" disabled={!pass || busy} style="width:100%">
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    {/if}
    <p class="hint" style="margin-top:1rem">
      All data stays on this device, encrypted. Nothing is ever sent anywhere. Clients are
      identified by initials or codes only — never full names.
    </p>
    <p class="hint" style="margin-top:0.5rem">
      <a href="#/help">About &amp; privacy</a>
    </p>
  </div>
</div>
