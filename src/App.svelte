<script>
  import { route, redirect } from './lib/router.js'
  import {
    locked,
    appMode,
    hasVault,
    appSettings,
    checkVault,
    enterDemo,
    exitDemo,
    lockNow,
    loadWarnings
  } from './lib/repo.js'
  import { toast } from './lib/toast.js'
  import Welcome from './components/Welcome.svelte'
  import LockScreen from './components/LockScreen.svelte'
  import Workspace from './components/Workspace.svelte'
  import Help from './components/Help.svelte'
  import Toast from './components/Toast.svelte'

  let demoLoading = $state(false)
  let demoError = $state('')
  let demoFailed = $state(false)
  let demoAttempt = $state(0)
  let vaultCheckStarted = $state(false)
  let privateHelpOpen = $state(false)

  // A direct demo route must not touch even private-vault metadata. If the
  // visitor later returns to a public/private entry screen, check then.
  $effect(() => {
    if ($route.mode !== 'demo' && $hasVault === null && !vaultCheckStarted) {
      vaultCheckStarted = true
      checkVault()
    }
  })

  // Route mode and data mode are separate on purpose. A demo route first
  // flushes/locks any private workspace, then populates only in-memory stores.
  $effect(() => {
    demoAttempt
    const wantsDemo = $route.mode === 'demo'
    if (wantsDemo && $appMode !== 'demo' && !demoLoading && !demoFailed) {
      demoLoading = true
      demoError = ''
      enterDemo()
        .catch(() => {
          demoError = 'Could not prepare the fictional demo. Reload and try again.'
          demoFailed = true
        })
        .finally(() => {
          demoLoading = false
        })
    } else if (!wantsDemo && $appMode === 'demo') {
      exitDemo()
    } else if (!wantsDemo) {
      demoFailed = false
      demoError = ''
    }
  })

  function retryDemo() {
    demoError = ''
    demoFailed = false
    demoAttempt++
  }

  $effect(() => {
    if ($route.mode === 'demo' && $route.name === 'demo-entry') redirect('guide/1', 'demo')
    if ($route.mode === 'public' && $route.name === 'notfound') redirect('', 'public')
    if (
      $appMode === 'private' &&
      $route.mode === 'public' &&
      ['create', 'unlock'].includes($route.name)
    ) {
      redirect('clients', 'private')
    }
  })

  // Help is available before unlock, but if an already-unlocked private
  // workspace locks while Help is open, make the lock transition explicit.
  $effect(() => {
    if ($route.name === 'help' && $appMode === 'private') {
      privateHelpOpen = true
    } else if ($route.name === 'help' && $appMode === 'locked' && privateHelpOpen) {
      privateHelpOpen = false
      redirect('unlock', 'public')
    } else if ($route.name !== 'help') {
      privateHelpOpen = false
    }
  })

  // Surface rows that failed decryption only in a private workspace. The demo
  // never reads IndexedDB and therefore cannot have decryption warnings.
  $effect(() => {
    if ($appMode === 'private' && !$locked && $loadWarnings > 0) {
      toast.show(
        `${$loadWarnings} record${$loadWarnings === 1 ? '' : 's'} could not be decrypted and ${$loadWarnings === 1 ? 'was' : 'were'} skipped. Restore from a backup if data is missing.`,
        null,
        10000
      )
    }
  })

  // Private data auto-locks after inactivity or a long hidden interval. Demo
  // data has no key and is already temporary, so the private lock timer does
  // not run there.
  $effect(() => {
    if ($appMode !== 'private' || $locked) return
    const minutes = $appSettings.autoLockMinutes ?? 15
    let lastActivity = Date.now()
    let hiddenAt = null
    let hiddenTimer = null
    const activity = () => {
      lastActivity = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((event) => addEventListener(event, activity, { passive: true }))
    const tick = setInterval(() => {
      if (Date.now() - lastActivity > minutes * 60000) lockNow()
    }, 15000)
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        clearTimeout(hiddenTimer)
        hiddenTimer = setTimeout(() => lockNow(), 5 * 60000)
      } else {
        clearTimeout(hiddenTimer)
        if (hiddenAt && Date.now() - hiddenAt > 5 * 60000) lockNow()
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      events.forEach((event) => removeEventListener(event, activity))
      clearInterval(tick)
      clearTimeout(hiddenTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })
</script>

{#if $route.mode === 'demo'}
  {#if $appMode === 'demo'}
    <Workspace demo />
  {:else}
    <main class="lock-wrap">
      <div class="lock-card">
        <h1>{demoFailed ? 'The demo could not be prepared' : 'Preparing fictional demo…'}</h1>
        <p class="muted">No passphrase is needed. Nothing here is saved.</p>
        {#if demoError}<p class="error-text" role="alert">{demoError}</p>{/if}
        {#if demoFailed}
          <div class="actions">
            <button class="btn-primary" onclick={retryDemo}>Retry demo</button>
            <a class="button-link" href="#/">Return to welcome</a>
          </div>
        {/if}
      </div>
    </main>
  {/if}
{:else if $route.name === 'welcome'}
  <Welcome />
{:else if $route.name === 'create'}
  <LockScreen screen="create" />
{:else if $route.name === 'unlock'}
  <LockScreen screen="unlock" />
{:else if $route.name === 'help' && $appMode !== 'private'}
  <Help locked />
{:else if $route.mode === 'private' || ($route.name === 'help' && $appMode === 'private')}
  {#if $appMode === 'private' && !$locked}
    <Workspace />
  {:else}
    <LockScreen screen="auto" />
  {/if}
{:else}
  <Welcome />
{/if}

<Toast />
