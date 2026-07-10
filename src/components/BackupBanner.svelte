<script>
  import { lastBackupAt, lastModifiedAt, plainSnapshot, vaultParams, currentKey, markBackupDone } from '../lib/repo.js'
  import { packBackup, saveBackupFile, backupFilename } from '../lib/backup.js'
  import { toast } from '../lib/toast.js'

  let dismissed = $state(false)
  let busy = $state(false)

  const SEVEN_DAYS = 7 * 86400000

  // Nag when there are new/changed records and the last export is > 7 days old
  // (or there has never been one) — browser storage is not durable (spec §3).
  const stale = $derived(
    !dismissed &&
      $lastModifiedAt != null &&
      ($lastBackupAt == null ||
        ($lastModifiedAt > $lastBackupAt && Date.now() - $lastBackupAt > SEVEN_DAYS))
  )

  async function exportNow() {
    busy = true
    try {
      const { salt, iterations } = await vaultParams()
      const bytes = await packBackup(plainSnapshot(), currentKey(), salt, iterations)
      const saved = await saveBackupFile(bytes, backupFilename())
      if (saved) {
        await markBackupDone()
        toast.show('Backup exported')
      }
    } finally {
      busy = false
    }
  }
</script>

{#if stale}
  <div class="banner no-print">
    <span>
      {#if $lastBackupAt == null}
        You have data that has never been backed up. Browser storage can be cleared without
        warning.
      {:else}
        Your last backup is more than 7 days old and there are new changes.
      {/if}
    </span>
    <button class="btn-primary" onclick={exportNow} disabled={busy}>Export backup</button>
    <button class="btn-quiet" onclick={() => (dismissed = true)}>Dismiss</button>
  </div>
{/if}
