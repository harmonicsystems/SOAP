<script>
  import { hasVault, createVault, unlock } from '../lib/repo.js'
  import { hrefFor, navigate } from '../lib/router.js'

  let { screen = 'auto' } = $props()

  let pass = $state('')
  let confirmPass = $state('')
  let understoodLoss = $state(false)
  let understoodCodes = $state(false)
  let error = $state('')
  let busy = $state(false)

  const wantsCreate = $derived(screen === 'create' || (screen === 'auto' && $hasVault === false))
  const canCreate = $derived(
    pass.length >= 8 && pass === confirmPass && understoodLoss && understoodCodes
  )

  async function submitCreate(e) {
    e.preventDefault()
    if (!canCreate || busy) return
    busy = true
    error = ''
    try {
      if (await createVault(pass)) navigate('clients', 'private')
    } catch (err) {
      error =
        err.message === 'vault-exists'
          ? 'A private workspace already exists in this browser, possibly from another tab. Unlock it instead.'
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
      if (ok) navigate('clients', 'private')
      else {
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

<main class="lock-wrap">
  <div class="lock-card workspace-card">
    <p class="eyebrow">SOAP Note Builder</p>
    {#if $hasVault === null}
      <h1>Checking this browser…</h1>
      <p class="muted">Loading encrypted workspace status.</p>
    {:else if wantsCreate && $hasVault}
      <h1>A private workspace already exists</h1>
      <p>
        This browser already contains an encrypted workspace. Unlock it instead of replacing it.
      </p>
      <a class="button-link btn-primary" href={hrefFor('unlock', 'public')}>Unlock private workspace</a>
    {:else if !wantsCreate && !$hasVault}
      <h1>No private workspace yet</h1>
      <p>Create a passphrase to make an empty encrypted workspace in this browser.</p>
      <a class="button-link btn-primary" href={hrefFor('create', 'public')}>Create private workspace</a>
    {:else if wantsCreate}
      <h1>Create private workspace</h1>
      <p class="muted">
        This creates encrypted local storage—not an account or cloud copy.
      </p>

      <div class="capability-grid">
        <div>
          <h2>This workspace does</h2>
          <ul>
            <li>Encrypt codes, goals, sessions, and settings in this browser.</li>
            <li>Work offline and assemble deterministic, editable notes.</li>
            <li>Export encrypted backup files that you control.</li>
          </ul>
        </div>
        <div>
          <h2>It does not</h2>
          <ul>
            <li>Create an online account, sync, or cloud backup.</li>
            <li>Recover a forgotten passphrase.</li>
            <li>Replace clinical judgment, an EMR, or employer policy.</li>
          </ul>
        </div>
      </div>

      <form onsubmit={submitCreate}>
        <div class="field">
          <label for="new-pass">Passphrase (at least 8 characters)</label>
          <input
            id="new-pass"
            type="password"
            bind:value={pass}
            autocomplete="new-password"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'create-error' : undefined}
          />
        </div>
        <div class="field">
          <label for="confirm-pass">Confirm passphrase</label>
          <input
            id="confirm-pass"
            type="password"
            bind:value={confirmPass}
            autocomplete="new-password"
            aria-invalid={confirmPass && pass !== confirmPass ? 'true' : undefined}
            aria-describedby={confirmPass && pass !== confirmPass ? 'confirm-error' : undefined}
          />
          {#if confirmPass && pass !== confirmPass}
            <p class="error-text" id="confirm-error" role="status">Passphrases do not match.</p>
          {/if}
        </div>
        <div class="warning-box">
          <strong>Your passphrase cannot be recovered.</strong> If it is lost, the encrypted data is
          permanently unreadable. Export backups regularly and store them somewhere safe.
        </div>
        <div class="ack-list">
          <label>
            <input type="checkbox" bind:checked={understoodLoss} />
            <span>I understand that losing my passphrase means losing my data.</span>
          </label>
          <label>
            <input type="checkbox" bind:checked={understoodCodes} />
            <span>I will use short codes only—not names, birth dates, schools, or other identifiers.</span>
          </label>
        </div>
        {#if error}<p class="error-text" id="create-error" role="alert">{error}</p>{/if}
        <button class="btn-primary" type="submit" disabled={!canCreate || busy} style="width:100%">
          {busy ? 'Creating…' : 'Create encrypted workspace'}
        </button>
      </form>
    {:else}
      <h1>Unlock private workspace</h1>
      <p class="muted">Enter the passphrase for the encrypted workspace in this browser.</p>
      <form onsubmit={submitUnlock}>
        <div class="field">
          <label for="unlock-pass">Passphrase</label>
          <input
            id="unlock-pass"
            type="password"
            bind:value={pass}
            autocomplete="current-password"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'unlock-error' : undefined}
          />
        </div>
        {#if error}<p class="error-text" id="unlock-error" role="alert">{error}</p>{/if}
        <button class="btn-primary" type="submit" disabled={!pass || busy} style="width:100%">
          {busy ? 'Unlocking…' : 'Unlock private workspace'}
        </button>
      </form>
      <p class="hint" style="margin-top:0.75rem">
        There is no passphrase reset. If it is lost, restore a backup only if you still know that
        backup's passphrase.
      </p>
    {/if}

    <div class="public-links">
      <a
        href={hrefFor('', 'demo')}
        aria-disabled={busy ? 'true' : undefined}
        onclick={(event) => busy && event.preventDefault()}
      >See demo without unlocking</a>
      <a href={hrefFor('help', 'public')}>Help &amp; privacy</a>
      <a href={hrefFor('', 'public')}>Welcome</a>
    </div>
  </div>
</main>
