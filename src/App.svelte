<script>
  import { onMount } from 'svelte'
  import { route, redirect } from './lib/router.js'
  import { locked, appSettings, checkVault, lockNow, loadWarnings } from './lib/repo.js'
  import { toast } from './lib/toast.js'
  import LockScreen from './components/LockScreen.svelte'
  import Header from './components/Header.svelte'
  import BackupBanner from './components/BackupBanner.svelte'
  import Toast from './components/Toast.svelte'
  import Caseload from './components/Caseload.svelte'
  import ClientDetail from './components/ClientDetail.svelte'
  import SessionScreen from './components/SessionScreen.svelte'
  import NoteOutput from './components/NoteOutput.svelte'
  import Progress from './components/Progress.svelte'
  import Settings from './components/Settings.svelte'

  onMount(() => {
    checkVault()
  })

  // The app opens locked; after unlock, '#/' lands on the caseload.
  // redirect (history replace), not navigate (push) — a push would re-trap the
  // Back button in an endless '#/' → '#/clients' loop.
  $effect(() => {
    if (!$locked && ($route.name === 'lock' || $route.name === 'notfound')) redirect('clients')
  })

  // Surface rows that failed decryption on unlock (corruption tolerance).
  $effect(() => {
    if (!$locked && $loadWarnings > 0) {
      toast.show(
        `${$loadWarnings} record${$loadWarnings === 1 ? '' : 's'} could not be decrypted and ${$loadWarnings === 1 ? 'was' : 'were'} skipped. Restore from a backup if data is missing.`,
        null,
        10000
      )
    }
  })

  // Auto-lock: idle > N minutes (configurable) or tab hidden > 5 minutes (spec §2.3).
  $effect(() => {
    if ($locked) return
    const minutes = $appSettings.autoLockMinutes ?? 15
    let lastActivity = Date.now()
    let hiddenAt = null
    let hiddenTimer = null
    const activity = () => {
      lastActivity = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => addEventListener(e, activity, { passive: true }))
    const tick = setInterval(() => {
      if (Date.now() - lastActivity > minutes * 60000) lockNow()
    }, 15000)
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        // Lock WHILE hidden, not just on return — the key and decrypted data
        // must not sit in memory for the whole hidden period (spec §2.3).
        // Background timers can be throttled; the visible-again check below is
        // the backstop.
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
      events.forEach((e) => removeEventListener(e, activity))
      clearInterval(tick)
      clearTimeout(hiddenTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })
</script>

{#if $locked}
  <LockScreen />
{:else}
  <Header />
  <BackupBanner />
  <main class="container">
    {#if $route.name === 'clients'}
      <Caseload />
    {:else if $route.name === 'client'}
      <ClientDetail id={$route.params.id} />
    {:else if $route.name === 'progress'}
      <Progress id={$route.params.id} />
    {:else if $route.name === 'session'}
      <SessionScreen id={$route.params.id} />
    {:else if $route.name === 'note'}
      <NoteOutput id={$route.params.id} />
    {:else if $route.name === 'settings'}
      <Settings />
    {/if}
  </main>
{/if}
<Toast />
