<script>
  import { lockNow, exitDemo, lastBackupAt, demoGuideStep } from '../lib/repo.js'
  import { route, hrefFor, navigate } from '../lib/router.js'
  import { daysAgoLabel } from '../lib/text.js'

  let { demo = false } = $props()

  const backupLabel = $derived(
    $lastBackupAt ? `Last backup: ${daysAgoLabel($lastBackupAt)}` : 'No backup yet'
  )

  function leaveDemo() {
    exitDemo()
    navigate('', 'public')
  }
</script>

<header class="app-header no-print">
  <a class="brand" href={hrefFor('clients', demo ? 'demo' : 'private')}>SOAP Notes</a>
  <nav>
    <a
      href={hrefFor('clients', demo ? 'demo' : 'private')}
      class:active={['clients', 'client', 'progress'].includes($route.name)}
    >
      Caseload
    </a>
    {#if demo}
      <a href={hrefFor(`guide/${$demoGuideStep}`, 'demo')} class:active={$route.name === 'guide'}>Guide</a>
      <a href={hrefFor('help', 'demo')} class:active={$route.name === 'help'}>Help</a>
    {:else}
      <a href={hrefFor('settings', 'private')} class:active={$route.name === 'settings'}>Settings</a>
      <a href={hrefFor('help', 'private')} class:active={$route.name === 'help'}>Help</a>
    {/if}
  </nav>
  <div class="spacer"></div>
  {#if demo}
    <button onclick={leaveDemo}>Exit demo</button>
  {:else}
    <span class="backup-status">{backupLabel}</span>
    <button onclick={lockNow}>Lock</button>
  {/if}
</header>
