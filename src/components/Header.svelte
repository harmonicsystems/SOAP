<script>
  import { lockNow, lastBackupAt } from '../lib/repo.js'
  import { route } from '../lib/router.js'
  import { daysAgoLabel } from '../lib/text.js'

  const backupLabel = $derived(
    $lastBackupAt ? `Last backup: ${daysAgoLabel($lastBackupAt)}` : 'No backup yet'
  )
</script>

<header class="app-header no-print">
  <a class="brand" href="#/clients">SOAP Notes</a>
  <nav>
    <a href="#/clients" class:active={['clients', 'client', 'progress'].includes($route.name)}>
      Caseload
    </a>
    <a href="#/settings" class:active={$route.name === 'settings'}>Settings</a>
    <a href="#/help" class:active={$route.name === 'help'}>Help</a>
  </nav>
  <div class="spacer"></div>
  <span class="backup-status">{backupLabel}</span>
  <button onclick={lockNow}>Lock</button>
</header>
