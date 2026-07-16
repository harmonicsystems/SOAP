<script>
  import {
    appSettings,
    saveSettings,
    changePassphrase,
    eraseAllData,
    plainSnapshot,
    vaultParams,
    currentKey,
    markBackupDone,
    importData,
    removeLearnedPhrase,
    lastBackupAt
  } from '../lib/repo.js'
  import { packBackup, unpackBackup, saveBackupFile, backupFilename } from '../lib/backup.js'
  import { DEFAULT_BANKS, phraseKey } from '../lib/phrasebanks.js'
  import { OBSERVATION_TAGS, domainLabel } from '../lib/constants.js'
  import { toast } from '../lib/toast.js'
  import { daysAgoLabel } from '../lib/text.js'
  import { navigate } from '../lib/router.js'

  // ---- general ----
  let therapistName = $state($appSettings.therapistName ?? '')
  let autoLockMinutes = $state($appSettings.autoLockMinutes ?? 15)

  async function saveGeneral() {
    await saveSettings({
      ...$appSettings,
      therapistName: therapistName.trim(),
      autoLockMinutes: Math.min(120, Math.max(1, Number(autoLockMinutes) || 15))
    })
    toast.show('Settings saved')
  }

  // ---- passphrase ----
  let curPass = $state('')
  let newPass = $state('')
  let confirmNew = $state('')
  let passError = $state('')
  let passBusy = $state(false)

  async function submitPassphrase(e) {
    e.preventDefault()
    passError = ''
    if (newPass.length < 8) {
      passError = 'New passphrase must be at least 8 characters.'
      return
    }
    if (newPass !== confirmNew) {
      passError = 'New passphrases do not match.'
      return
    }
    passBusy = true
    const ok = await changePassphrase(curPass, newPass)
    passBusy = false
    if (!ok) {
      passError = 'Current passphrase is incorrect.'
      return
    }
    curPass = newPass = confirmNew = ''
    toast.show('Passphrase changed — all data re-encrypted')
  }

  // ---- backup ----
  let exportBusy = $state(false)

  async function exportBackup() {
    exportBusy = true
    try {
      const { salt, iterations } = await vaultParams()
      const bytes = await packBackup(plainSnapshot(), currentKey(), salt, iterations)
      const saved = await saveBackupFile(bytes, backupFilename())
      if (saved) {
        await markBackupDone()
        toast.show('Backup exported')
      }
    } finally {
      exportBusy = false
    }
  }

  let importFile = $state(null)
  let importPass = $state('')
  let importMode = $state('replace')
  let importError = $state('')
  let importBusy = $state(false)

  function onFileChange(e) {
    importFile = e.target.files?.[0] ?? null
    importError = ''
  }

  async function runImport() {
    if (!importFile || !importPass) return
    importError = ''
    importBusy = true
    try {
      const bytes = new Uint8Array(await importFile.arrayBuffer())
      const data = await unpackBackup(bytes, importPass)
      if (data?.version !== 1) throw new Error('Unsupported backup version')
      const when = data.exportedAt?.slice(0, 10) ?? 'unknown date'
      const message =
        importMode === 'replace'
          ? `Replace ALL current data with the backup from ${when}? This cannot be undone.`
          : `Merge the backup from ${when} into current data? Newer records win.`
      if (!confirm(message)) return
      await importData(data, importMode)
      importFile = null
      importPass = ''
      toast.show('Backup imported')
    } catch (e) {
      importError =
        e.message === 'Not a SOAP backup file' || e.message === 'Unsupported backup version'
          ? e.message
          : 'Could not decrypt — wrong passphrase or corrupted file.'
    } finally {
      importBusy = false
    }
  }

  // ---- phrase banks ----
  const SECTIONS = ['S', 'O', 'A', 'P']
  const SECTION_NAMES = { S: 'Subjective', O: 'Objective observations', A: 'Assessment', P: 'Plan' }
  let bankDrafts = $state(null) // {S: 'line\nline', ...} while editing

  function startBankEdit() {
    bankDrafts = Object.fromEntries(
      SECTIONS.map((s) => [s, ($appSettings.phraseBanks?.[s] ?? DEFAULT_BANKS[s]).join('\n')])
    )
  }

  async function saveBanks() {
    const phraseBanks = {}
    for (const s of SECTIONS) {
      const lines = bankDrafts[s]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      // store null when identical to defaults so shipped updates still apply
      phraseBanks[s] =
        JSON.stringify(lines) === JSON.stringify(DEFAULT_BANKS[s]) ? null : lines
    }
    await saveSettings({ ...$appSettings, phraseBanks })
    bankDrafts = null
    toast.show('Phrase banks saved')
  }

  async function resetBanks() {
    await saveSettings({ ...$appSettings, phraseBanks: { S: null, O: null, A: null, P: null } })
    bankDrafts = null
    toast.show('Phrase banks reset to defaults')
  }

  // ---- observation tags (round 3) ----
  let newTagChip = $state('')
  let newTagClause = $state('')

  async function addObsTag() {
    const chip = newTagChip.trim()
    const clause = newTagClause.trim().replace(/\.+$/, '')
    if (!chip || !clause) return
    const custom = $appSettings.customObsTags ?? []
    const exists = [...OBSERVATION_TAGS, ...custom].some(
      (t) => t.chip.toLowerCase() === chip.toLowerCase()
    )
    if (exists) {
      toast.show('A tag with that label already exists')
      return
    }
    await saveSettings({
      ...$appSettings,
      customObsTags: [
        ...custom,
        { id: `custom-${crypto.randomUUID()}`, chip, clause, archived: false }
      ]
    })
    newTagChip = newTagClause = ''
    toast.show('Observation tag added')
  }

  async function setTagArchived(id, archived) {
    await saveSettings({
      ...$appSettings,
      customObsTags: ($appSettings.customObsTags ?? []).map((t) =>
        t.id === id ? { ...t, archived } : t
      )
    })
  }

  async function toggleBuiltinTag(id) {
    const hidden = new Set($appSettings.hiddenObsTags ?? [])
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    await saveSettings({ ...$appSettings, hiddenObsTags: [...hidden] })
  }

  // ---- erase ----
  let eraseText = $state('')

  async function erase() {
    if (eraseText !== 'ERASE') return
    await eraseAllData()
    navigate('', 'public')
  }
</script>

<h1>Settings</h1>

<div class="card">
  <h2>General</h2>
  <div class="field">
    <label for="set-name">Therapist name (optional — shown on printed notes only)</label>
    <input id="set-name" bind:value={therapistName} style="width:260px" />
  </div>
  <div class="field">
    <label for="set-lock">Auto-lock after inactivity (minutes)</label>
    <input id="set-lock" type="number" min="1" max="120" bind:value={autoLockMinutes} style="width:90px" />
  </div>
  <button class="btn-primary" onclick={saveGeneral}>Save</button>
</div>

<div class="card">
  <h2>Backup</h2>
  <p class="hint">
    Browser storage is not durable — the browser can clear it without warning. Export a backup
    regularly and keep it somewhere safe. Last backup: {daysAgoLabel($lastBackupAt)}.
  </p>
  <button class="btn-primary" onclick={exportBackup} disabled={exportBusy}>Export backup</button>

  <h3 style="margin-top:1.25rem">Restore from backup</h3>
  <div class="field">
    <input type="file" accept=".enc" onchange={onFileChange} />
  </div>
  {#if importFile}
    <div class="field">
      <label for="import-pass">Backup passphrase</label>
      <input id="import-pass" type="password" bind:value={importPass} style="width:260px" />
    </div>
    <div class="field">
      <label style="display:inline-flex; gap:0.4rem; align-items:center; color:var(--ink)">
        <input type="radio" bind:group={importMode} value="replace" /> Replace all current data
      </label>
      <label style="display:inline-flex; gap:0.4rem; align-items:center; color:var(--ink); margin-left:1rem">
        <input type="radio" bind:group={importMode} value="merge" /> Merge (newer records win)
      </label>
    </div>
    <button class="btn-primary" onclick={runImport} disabled={!importPass || importBusy}>
      {importBusy ? 'Importing…' : 'Import'}
    </button>
  {/if}
  {#if importError}<p class="error-text">{importError}</p>{/if}
</div>

<div class="card">
  <h2>Change passphrase</h2>
  <p class="hint">
    Re-encrypts all data with the new passphrase. If you forget the new passphrase, your data
    cannot be recovered.
  </p>
  <form onsubmit={submitPassphrase}>
    <div class="field">
      <label for="cur-pass">Current passphrase</label>
      <input id="cur-pass" type="password" bind:value={curPass} style="width:260px" autocomplete="current-password" />
    </div>
    <div class="field-row">
      <div class="field">
        <label for="new-pass2">New passphrase</label>
        <input id="new-pass2" type="password" bind:value={newPass} style="width:260px" autocomplete="new-password" />
      </div>
      <div class="field">
        <label for="confirm-new">Confirm new passphrase</label>
        <input id="confirm-new" type="password" bind:value={confirmNew} style="width:260px" autocomplete="new-password" />
      </div>
    </div>
    {#if passError}<p class="error-text">{passError}</p>{/if}
    <button class="btn-primary" type="submit" disabled={!curPass || !newPass || passBusy}>
      {passBusy ? 'Re-encrypting…' : 'Change passphrase'}
    </button>
  </form>
</div>

<div class="card">
  <h2>Phrase banks</h2>
  <p class="hint">
    One phrase per line. Placeholders in braces (like {'{context}'} or {'{activity}'}) stay as-is
    when inserted so you can fill them in. Data-driven suggestions on the session screen are
    generated automatically and are not edited here.
  </p>
  {#if bankDrafts === null}
    <button onclick={startBankEdit}>Edit phrase banks</button>
  {:else}
    {#each SECTIONS as s}
      <div class="field">
        <label for="bank-{s}">
          {s} — {SECTION_NAMES[s]}
          {#if $appSettings.phraseBanks?.[s]}<span class="tag warn">customized</span>{/if}
        </label>
        <textarea id="bank-{s}" rows="6" bind:value={bankDrafts[s]}></textarea>
      </div>
    {/each}
    <div class="toolbar">
      <button class="btn-primary" onclick={saveBanks}>Save phrase banks</button>
      <button onclick={() => (bankDrafts = null)}>Cancel</button>
      <button class="btn-quiet" onclick={resetBanks}>Reset all to defaults</button>
    </div>
  {/if}
</div>

<div class="card">
  <h2>Your saved phrases</h2>
  <p class="hint">
    Phrases you saved from your own notes during sessions. The ones you use most rise to the top
    of the chips automatically. Remove any you no longer want.
  </p>
  {#if SECTIONS.every((s) => ($appSettings.learned?.[s] ?? []).length === 0)}
    <p class="muted" style="margin:0">
      None yet. On the session screen, type a note and tap “＋ Save phrase” to add it here.
    </p>
  {:else}
    {#each SECTIONS as s}
      {@const learned = $appSettings.learned?.[s] ?? []}
      {#if learned.length}
        <h3 style="margin:0.75rem 0 0.25rem">{s} — {SECTION_NAMES[s]}</h3>
        <div class="row-list">
          {#each learned as phrase (phrase)}
            <div class="row-item" style="padding:0.4rem 0.75rem">
              <span style="flex:1">{phrase}</span>
              {#each $appSettings.phraseDomains?.[phraseKey(s, phrase)] ?? $appSettings.phraseDomains?.[phrase.toLowerCase()] ?? [] as d}
                <span class="tag quiet">{domainLabel(d)}</span>
              {/each}
              <button class="btn-quiet" onclick={() => removeLearnedPhrase(s, phrase)}>Remove</button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<div class="card">
  <h2>Observation tags</h2>
  <p class="hint">
    The quick-tap “what happened this session?” chips on goal cards. Each tag writes its full
    clause into the O section after the client code — e.g. chip “AAC modeled” → “S7 required
    aided language modeling on the device.” Click a built-in tag to hide or show it. Custom tags
    are archived, never deleted, so old notes keep their wording.
  </p>

  <h3 style="margin-top:0.75rem">Built-in</h3>
  <div class="chips">
    {#each OBSERVATION_TAGS as t (t.id)}
      {@const hidden = ($appSettings.hiddenObsTags ?? []).includes(t.id)}
      <button
        type="button"
        class="chip obs"
        class:active={!hidden}
        style={hidden ? 'opacity:0.45; text-decoration:line-through' : ''}
        title={hidden ? `Hidden — click to show. Writes: “…${t.clause}.”` : `Writes: “…${t.clause}.” Click to hide.`}
        onclick={() => toggleBuiltinTag(t.id)}
      >
        {t.chip}
      </button>
    {/each}
  </div>

  <h3 style="margin-top:0.75rem">Your tags</h3>
  {#if ($appSettings.customObsTags ?? []).length === 0}
    <p class="muted">None yet — add one below.</p>
  {:else}
    <div class="row-list">
      {#each $appSettings.customObsTags ?? [] as t (t.id)}
        <div class="row-item" style="padding:0.4rem 0.75rem">
          <span class="chip obs active" style="pointer-events:none">{t.chip}</span>
          <span class="muted" style="flex:1; font-size:0.85rem">…{t.clause}.</span>
          {#if t.archived}
            <span class="tag quiet">archived</span>
            <button class="btn-quiet" onclick={() => setTagArchived(t.id, false)}>Restore</button>
          {:else}
            <button class="btn-quiet" onclick={() => setTagArchived(t.id, true)}>Archive</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="field-row" style="margin-top:0.75rem">
    <div class="field" style="margin-bottom:0">
      <label for="tag-chip">Chip label (short)</label>
      <input id="tag-chip" bind:value={newTagChip} maxlength="24" placeholder="e.g., AAC modeled" style="width:180px" />
    </div>
    <div class="field" style="flex:1; min-width:260px; margin-bottom:0">
      <label for="tag-clause">Clause (reads after the client code)</label>
      <input
        id="tag-clause"
        bind:value={newTagClause}
        placeholder="e.g., required aided language modeling on the device"
        style="width:100%"
      />
    </div>
    <button class="btn-primary" onclick={addObsTag} disabled={!newTagChip.trim() || !newTagClause.trim()}>
      Add tag
    </button>
  </div>
  {#if newTagClause.trim()}
    <p class="hint" style="margin-top:0.4rem">
      Preview: “JD {newTagClause.trim().replace(/\.+$/, '')}.”
    </p>
  {/if}
</div>

<div class="card" style="border-color: var(--bad)">
  <h2>Erase all data</h2>
  <p class="hint">
    Permanently deletes every client, goal, session, and setting on this device. Export a backup
    first if you might need this data again.
  </p>
  <div class="field">
    <label for="erase-confirm">Type ERASE to confirm</label>
    <input id="erase-confirm" bind:value={eraseText} style="width:160px" />
  </div>
  <button class="btn-danger" disabled={eraseText !== 'ERASE'} onclick={erase}>
    Erase all data
  </button>
</div>
