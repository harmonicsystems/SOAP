<script>
  import { appMode, hasVault } from '../lib/repo.js'
  import { hrefFor } from '../lib/router.js'
</script>

<main class="welcome-wrap">
  <section class="welcome-card" aria-labelledby="welcome-title">
    <p class="eyebrow">SOAP Note Builder</p>
    <h1 id="welcome-title">Faster SOAP notes. Your student data stays on this device.</h1>
    <p class="welcome-lead">
      Collect trial data during speech sessions, build deterministic SOAP notes, and review
      progress over time—even offline. No account, cloud database, analytics, or AI in the app.
    </p>

    <div class="welcome-actions">
      <div class="choice-card featured">
        <h2>Look around first</h2>
        <p>Explore a fictional longitudinal caseload in the real note-builder. No passphrase.</p>
        <a class="button-link btn-primary" href={hrefFor('', 'demo')}>See the demo</a>
      </div>

      <div class="choice-card">
        {#if $hasVault === null && $appMode !== 'private'}
          <h2>Checking this browser…</h2>
          <p>Looking for an existing encrypted workspace before showing the private next step.</p>
          <button disabled>Checking private workspace…</button>
        {:else}
          <h2>{$hasVault ? 'Return to your workspace' : 'Start your own workspace'}</h2>
          <p>
            {$hasVault
              ? 'Unlock the encrypted caseload stored in this browser.'
              : 'Create a passphrase and an empty encrypted workspace in this browser.'}
          </p>
        {/if}
        {#if $appMode === 'private'}
          <a class="button-link" href={hrefFor('clients', 'private')}>Continue private workspace</a>
        {:else if $hasVault === true}
          <a class="button-link" href={hrefFor('unlock', 'public')}>Unlock private workspace</a>
        {:else if $hasVault === false}
          <a class="button-link" href={hrefFor('create', 'public')}>Create private workspace</a>
        {/if}
      </div>
    </div>

    <div class="know-first">
      <h2>Know before you begin</h2>
      <ul>
        <li>Use short codes only—never names, birth dates, schools, or other identifiers.</li>
        <li>Private data stays in this browser and does not sync automatically.</li>
        <li>A lost passphrase cannot be recovered; encrypted backups are your responsibility.</li>
        <li>This is a documentation tool, not clinical advice or an EMR.</li>
      </ul>
    </div>

    <p class="hint welcome-help">
      <a href={hrefFor('help', 'public')}>Help, privacy, limitations, and contact</a>
    </p>
  </section>
</main>
