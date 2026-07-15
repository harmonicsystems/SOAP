// Encrypted repository layer (spec §2). Dexie rows are {id, updatedAt, blob};
// plaintext exists ONLY in these in-memory Svelte stores while unlocked.
// Locking wipes the key and every decrypted store.
import { writable, get } from 'svelte/store'
import { db } from './db.js'
import {
  deriveKey,
  encryptJSON,
  decryptJSON,
  makeVerification,
  checkVerification,
  randomBytes,
  PBKDF2_ITERATIONS
} from './crypto.js'
import { mergeRecords, mergeCorpusSettings } from './backup.js'
import { effectiveBank, phraseKey } from './phrasebanks.js'
import { newSessionRecord } from './session.js'
import {
  buildSampleDataset,
  isSampleRecord,
  sampleProvenance
} from './sampleData.js'
import { todayISO } from './text.js'

let key = null // in-memory only; wiped on lock; never persisted
let lockGen = 0 // bumped on every lock; in-flight writes check it and bail
let sessionEpoch = null // vault epoch captured at unlock; guards cross-tab rekey

export const locked = writable(true)
export const hasVault = writable(null) // null=checking, false=first run, true=vault exists
export const clients = writable([])
export const goals = writable([])
export const sessions = writable([])
export const appSettings = writable(defaultSettings())
export const lastBackupAt = writable(null)
export const lastModifiedAt = writable(null)
export const loadWarnings = writable(0) // rows skipped because they failed decryption

const DATA_TABLES = ['clients', 'goals', 'sessions']
const stores = { clients, goals, sessions }

// Screens with debounced pending edits register a flush here so lockNow() can
// persist them BEFORE the key is wiped (autosave must not lose data on lock).
const preLockHooks = new Set()
export function onBeforeLock(fn) {
  preLockHooks.add(fn)
  return () => preLockHooks.delete(fn)
}

// Cross-tab safety: a passphrase change / erase / import in one tab must not
// let another tab keep writing under a stale key (that would permanently
// corrupt records). Other tabs hard-lock when the vault epoch changes.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('soap-vault') : null
channel?.addEventListener('message', (e) => {
  if (sessionEpoch !== null && e.data?.epoch !== sessionEpoch) hardLock()
})
function announceVaultChange() {
  channel?.postMessage({ epoch: sessionEpoch })
}

export function defaultSettings() {
  return {
    id: 'settings',
    autoLockMinutes: 15,
    therapistName: '',
    // null per section = use shipped defaults; an array = user override.
    // Defaults are never mutated, so updates can ship new phrases (spec §6).
    phraseBanks: { S: null, O: null, A: null, P: null },
    // Phrases the clinician saved from their own typing (§1). Kept separate
    // from phraseBanks so a shipped-defaults reset never wipes them.
    learned: { S: [], O: [], A: [], P: [] },
    // Ranking signal for chips: { [lowercasedText]: { count, lastUsedAt } }.
    phraseUsage: {},
    // Domain affinity for learned phrases: { [lowercasedText]: [domainIds] },
    // captured from the session the phrase was saved in (round 3).
    phraseDomains: {},
    // Clinician-defined observation tags: [{id, chip, clause, archived}].
    // Archived (never deleted) so old sessions keep rendering their clauses.
    customObsTags: [],
    // Built-in observation tag ids the clinician has hidden from goal cards.
    hiddenObsTags: []
  }
}

export async function checkVault() {
  const vault = await db.meta.get('vault')
  hasVault.set(!!vault)
  return !!vault
}

export async function createVault(passphrase) {
  // A stale first-run tab must never overwrite an existing vault — that would
  // orphan every record encrypted under the previous key.
  if (await db.meta.get('vault')) {
    throw new Error('vault-exists')
  }
  const salt = randomBytes(16)
  const k = await deriveKey(passphrase, salt)
  const check = await makeVerification(k)
  const epoch = crypto.randomUUID()
  await db.meta.put({ key: 'vault', salt, iterations: PBKDF2_ITERATIONS, check, epoch })
  key = k
  sessionEpoch = epoch
  hasVault.set(true)
  announceVaultChange()
  await afterUnlock()
}

export async function unlock(passphrase) {
  const vault = await db.meta.get('vault')
  if (!vault) return false
  const k = await deriveKey(passphrase, vault.salt, vault.iterations)
  if (!(await checkVerification(k, vault.check))) return false
  key = k
  sessionEpoch = vault.epoch ?? null
  await afterUnlock()
  return true
}

async function afterUnlock() {
  await loadAll()
  locked.set(false)
  // Reduce eviction risk for IndexedDB (spec §3). Best effort.
  try {
    await globalThis.navigator?.storage?.persist?.()
  } catch {
    /* unsupported — ignore */
  }
}

async function loadAll() {
  // Tolerate individual corrupt rows: one undecryptable blob must not make the
  // whole (mostly intact) vault inaccessible. Skipped rows are surfaced via
  // loadWarnings so the UI can tell the user to check backups.
  let skipped = 0
  for (const [name, store] of Object.entries(stores)) {
    const rows = await db[name].toArray()
    const out = []
    for (const row of rows) {
      try {
        out.push(await decryptJSON(key, row.blob))
      } catch {
        skipped++
      }
    }
    store.set(out)
  }
  const settingsRow = await db.settings.get('settings')
  let settingsRec = defaultSettings()
  if (settingsRow) {
    try {
      settingsRec = await decryptJSON(key, settingsRow.blob)
    } catch {
      skipped++
    }
  }
  appSettings.set(settingsRec)
  lastBackupAt.set((await db.meta.get('lastBackup'))?.value ?? null)
  lastModifiedAt.set((await db.meta.get('lastModified'))?.value ?? null)
  loadWarnings.set(skipped)
}

// Normal lock path: lets registered screens flush pending debounced edits
// while the key is still valid, THEN wipes.
export async function lockNow() {
  for (const fn of [...preLockHooks]) {
    try {
      await fn()
    } catch {
      /* flush is best-effort */
    }
  }
  hardLock()
}

// Immediate lock without flushing — used when pending writes would be UNSAFE
// (another tab rekeyed the vault, so our key is stale).
export function hardLock() {
  lockGen++
  clearTimeout(usageTimer) // drop any pending soft usage write
  key = null
  sessionEpoch = null
  for (const store of Object.values(stores)) store.set([])
  appSettings.set(defaultSettings())
  locked.set(true)
}

async function touchModified() {
  const now = Date.now()
  lastModifiedAt.set(now)
  await db.meta.put({ key: 'lastModified', value: now })
}

export async function putRecord(table, record) {
  const writeKey = key
  if (!writeKey) return null // locked mid-write (e.g., stale autosave timer) — drop
  const gen = lockGen
  const expectedEpoch = sessionEpoch
  const rec = { ...record, updatedAt: Date.now() }
  const blob = await encryptJSON(writeKey, rec)
  // Cross-tab guard and write share one IndexedDB transaction, so a rekey,
  // import, or sample reset cannot land between the epoch check and the put.
  let stale = false
  let observedEpoch = null
  let wrote = false
  await db.transaction('rw', [db.meta, db[table]], async () => {
    const vault = await db.meta.get('vault')
    observedEpoch = vault?.epoch ?? null
    if (observedEpoch !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || key !== writeKey) return
    await db[table].put({ id: rec.id, updatedAt: rec.updatedAt, blob })
    await db.meta.put({ key: 'lastModified', value: rec.updatedAt })
    wrote = true
  })
  if (stale) {
    // A same-tab exclusive operation may have intentionally advanced the
    // epoch while this encryption was in flight. Drop the obsolete write but
    // keep the now-current tab unlocked; an external epoch change still locks.
    if (sessionEpoch !== observedEpoch) hardLock()
    return null
  }
  if (!wrote) return null
  if (lockGen !== gen) return rec // locked mid-write: row is valid, but leave wiped caches alone
  stores[table].update((list) => {
    const i = list.findIndex((r) => r.id === rec.id)
    if (i >= 0) {
      const copy = [...list]
      copy[i] = rec
      return copy
    }
    return [...list, rec]
  })
  lastModifiedAt.set(rec.updatedAt)
  return rec
}

export async function deleteRecord(table, id) {
  const writeKey = key
  if (!writeKey) return false
  const gen = lockGen
  const expectedEpoch = sessionEpoch
  const modifiedAt = Date.now()
  let stale = false
  let observedEpoch = null
  let deleted = false
  await db.transaction('rw', [db.meta, db[table]], async () => {
    const vault = await db.meta.get('vault')
    observedEpoch = vault?.epoch ?? null
    if (observedEpoch !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || key !== writeKey) return
    await db[table].delete(id)
    await db.meta.put({ key: 'lastModified', value: modifiedAt })
    deleted = true
  })
  if (stale) {
    if (sessionEpoch !== observedEpoch) hardLock()
    return false
  }
  if (!deleted) return false
  if (lockGen !== gen) return true
  stores[table].update((list) => list.filter((r) => r.id !== id))
  lastModifiedAt.set(modifiedAt)
  return true
}

// Install/reset the fictional longitudinal caseload as ordinary encrypted
// records. Deterministic ids make retries safe after interruption. Settings
// and the clinician's phrase corpus are deliberately untouched.
function sampleConflictError(message, details = {}) {
  return Object.assign(new Error(message), details)
}

function assertSampleModelIsSafe(data) {
  const sampleCodes = new Set(data.clients.map((client) => client.code.toLowerCase()))
  const conflicts = get(clients)
    .filter(
      (client) => !isSampleRecord(client) && sampleCodes.has(client.code?.toLowerCase())
    )
    .map((client) => client.code)
  if (conflicts.length) throw sampleConflictError('sample-code-conflict', { conflicts })
  for (const table of DATA_TABLES) {
    const occupied = new Map(get(stores[table]).map((record) => [record.id, record]))
    const conflict = data[table].find((record) => {
      const existing = occupied.get(record.id)
      return existing && !isSampleRecord(existing)
    })
    if (conflict) {
      throw sampleConflictError('sample-id-conflict', { table, recordId: conflict.id })
    }
  }
}

async function assertNoRawSampleIdConflicts(data) {
  for (const table of DATA_TABLES) {
    const modelById = new Map(get(stores[table]).map((record) => [record.id, record]))
    for (const record of data[table]) {
      const row = await db[table].get(record.id)
      const model = modelById.get(record.id)
      if (row && (!model || !isSampleRecord(model))) {
        throw sampleConflictError('sample-id-conflict', { table, recordId: record.id })
      }
    }
  }
}

// Rotate first to quiesce other tabs before taking a destructive-operation
// snapshot. putRecord/deleteRecord include meta in their transactions, so an
// in-flight mutation either commits before this rotation (and is reloaded) or
// observes the new epoch and aborts.
async function beginExclusiveVaultChange() {
  if (!key) return false
  const expectedEpoch = sessionEpoch
  const gen = lockGen
  const epoch = crypto.randomUUID()
  let stale = false
  let changed = false
  await db.transaction('rw', [db.meta], async () => {
    const vault = await db.meta.get('vault')
    if ((vault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || !key) return
    await db.meta.put({ ...vault, epoch })
    changed = true
  })
  if (stale) {
    hardLock()
    return false
  }
  if (!changed) return false
  sessionEpoch = epoch
  announceVaultChange()
  return true
}

export async function installSampleDataset(anchorDate = todayISO()) {
  if (!key) return false
  const data = buildSampleDataset({ anchorDate })
  // Avoid rotating/locking sibling tabs for an obvious local conflict.
  assertSampleModelIsSafe(data)
  if (!(await beginExclusiveVaultChange())) return false
  await loadAll()
  // Reload captures any other-tab write serialized before the epoch rotation.
  assertSampleModelIsSafe(data)
  await assertNoRawSampleIdConflicts(data)
  const gen = lockGen
  const expectedEpoch = sessionEpoch

  const modifiedAt = Date.now()
  const next = {}
  const rows = {}
  for (const table of DATA_TABLES) {
    next[table] = data[table].map((record) => ({ ...record, updatedAt: modifiedAt }))
    rows[table] = await Promise.all(
      next[table].map(async (record) => ({
        id: record.id,
        updatedAt: record.updatedAt,
        blob: await encryptJSON(key, record)
      }))
    )
  }
  if (lockGen !== gen || !key) return false

  const idsToRemove = Object.fromEntries(
    DATA_TABLES.map((table) => [
      table,
      get(stores[table]).filter((record) => isSampleRecord(record)).map((record) => record.id)
    ])
  )
  const epoch = crypto.randomUUID()
  let stale = false
  let installed = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions], async () => {
    const vault = await db.meta.get('vault')
    if ((vault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || !key) return
    for (const table of DATA_TABLES) {
      await db[table].bulkDelete(idsToRemove[table])
      await db[table].bulkPut(rows[table])
    }
    await db.meta.put({ ...vault, epoch })
    await db.meta.put({ key: 'lastModified', value: modifiedAt })
    installed = true
  })
  if (stale) {
    hardLock()
    return false
  }
  if (!installed) return false
  sessionEpoch = epoch
  announceVaultChange()
  for (const table of DATA_TABLES) {
    stores[table].update((list) => [
      ...list.filter((record) => !isSampleRecord(record)),
      ...next[table]
    ])
  }
  lastModifiedAt.set(modifiedAt)
  return true
}

// Remove only records carrying the exact supported provenance marker. Delete
// children before parents so an interrupted retry never leaves more orphans.
export async function removeSampleDataset() {
  if (!key) return false
  if (!(await beginExclusiveVaultChange())) return false
  await loadAll()
  const gen = lockGen
  const expectedEpoch = sessionEpoch
  const ids = Object.fromEntries(
    DATA_TABLES.map((table) => [
      table,
      get(stores[table]).filter((record) => isSampleRecord(record)).map((record) => record.id)
    ])
  )
  if (Object.values(ids).every((list) => list.length === 0)) return true
  const modifiedAt = Date.now()
  const epoch = crypto.randomUUID()
  let stale = false
  let removed = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions], async () => {
    const vault = await db.meta.get('vault')
    if ((vault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || !key) return
    for (const table of ['sessions', 'goals', 'clients']) await db[table].bulkDelete(ids[table])
    await db.meta.put({ ...vault, epoch })
    await db.meta.put({ key: 'lastModified', value: modifiedAt })
    removed = true
  })
  if (stale) {
    hardLock()
    return false
  }
  if (!removed) return false
  sessionEpoch = epoch
  announceVaultChange()
  for (const table of DATA_TABLES) {
    stores[table].update((list) => list.filter((record) => !isSampleRecord(record)))
  }
  lastModifiedAt.set(modifiedAt)
  return true
}

// Create a group session: one linked per-client Session record per client,
// sharing a groupId and the shared header (date/duration/setting). Each member
// is seeded with that client's active goals. Returns the shared groupId.
export async function createGroup(clientIds, opts = {}) {
  if (!key) return null
  const groupId = crypto.randomUUID()
  const allGoals = get(goals)
  const allClients = get(clients)
  const chosenClients = clientIds
    .map((id) => allClients.find((client) => client.id === id))
    .filter(Boolean)
  if (new Set(chosenClients.map((client) => isSampleRecord(client))).size > 1) return null
  for (const clientId of clientIds) {
    const active = allGoals.filter((g) => g.clientId === clientId && g.status === 'active')
    const client = allClients.find((record) => record.id === clientId)
    // a group session is always the 'group' setting — createGroup owns that
    await putRecord('sessions', {
      ...newSessionRecord(clientId, active, { ...opts, setting: 'group', groupId }),
      ...sampleProvenance(client)
    })
  }
  return groupId
}

// Same cross-tab guard as putRecord: the epoch check, encrypted settings write,
// and (for user-authored settings changes) backup-staleness timestamp are one
// transaction. `expectedEpoch` is captured before encryption so an autosave
// already in flight cannot cross a sample reset/rekey boundary.
async function persistSettings(rec, markModified = false) {
  const writeKey = key
  if (!writeKey) return false
  const gen = lockGen
  const expectedEpoch = sessionEpoch
  const blob = await encryptJSON(writeKey, rec)
  let stale = false
  let observedEpoch = null
  let wrote = false
  await db.transaction('rw', [db.meta, db.settings], async () => {
    const vault = await db.meta.get('vault')
    observedEpoch = vault?.epoch ?? null
    if (observedEpoch !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || key !== writeKey) return
    await db.settings.put({ id: 'settings', updatedAt: rec.updatedAt, blob })
    if (markModified) await db.meta.put({ key: 'lastModified', value: rec.updatedAt })
    wrote = true
  })
  if (stale) {
    if (sessionEpoch !== observedEpoch) hardLock()
    return false
  }
  if (!wrote) return false
  if (markModified) lastModifiedAt.set(rec.updatedAt)
  return true
}

export async function saveSettings(next) {
  if (!key) return
  const rec = { ...next, id: 'settings', updatedAt: Date.now() }
  if (!(await persistSettings(rec, true))) return // stale key / locked — drop
  appSettings.set(rec)
}

// Normalize a phrase for the corpus: single-line, trimmed. Case preserved so
// the clinician's own capitalization/voice survives.
function normalizePhrase(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

// Save a clinician-typed phrase into their learned corpus (§1). No-op on empty
// or on a phrase already present (case-insensitive) in the base bank or learned
// list, so the same line never appears twice. `domains` (the session's goal
// domains) gives the phrase its affinity for domain-aware ranking (round 3).
// Returns true if added.
export async function savePhrase(section, text, domains = []) {
  if (!key) return false
  const phrase = normalizePhrase(text)
  if (!phrase) return false
  const s = get(appSettings)
  const base = effectiveBank(s, section) ?? []
  const learned = s.learned?.[section] ?? []
  const lower = phrase.toLowerCase()
  if ([...base, ...learned].some((p) => p.toLowerCase() === lower)) return false
  const nextLearned = { ...(s.learned ?? { S: [], O: [], A: [], P: [] }) }
  nextLearned[section] = [...learned, phrase]
  const next = { ...s, learned: nextLearned }
  if (domains.length) {
    // Section-scoped key: identical text in another section keeps its own tags.
    next.phraseDomains = {
      ...(s.phraseDomains ?? {}),
      [phraseKey(section, phrase)]: [...new Set(domains)]
    }
  }
  await saveSettings(next)
  return true
}

export async function removeLearnedPhrase(section, text) {
  if (!key) return
  const s = get(appSettings)
  const learned = s.learned?.[section] ?? []
  const nextLearned = { ...(s.learned ?? { S: [], O: [], A: [], P: [] }) }
  nextLearned[section] = learned.filter((p) => p !== text)
  // Drop its usage and domain entries so a re-added phrase starts fresh —
  // ONLY the section-scoped keys: identical text used as a chip in another
  // section must keep its own accumulated state.
  const usage = { ...(s.phraseUsage ?? {}) }
  delete usage[phraseKey(section, text)]
  const phraseDomains = { ...(s.phraseDomains ?? {}) }
  delete phraseDomains[phraseKey(section, text)]
  await saveSettings({ ...s, learned: nextLearned, phraseUsage: usage, phraseDomains })
}

// Record a chip use for ranking (§1). Updates the in-memory store immediately
// (so the next session's snapshot is fresh) and debounces the encrypted write —
// a soft signal, so a dropped write on lock is harmless.
let usageTimer = null
export function recordPhraseUse(section, text) {
  if (!key) return
  const phrase = normalizePhrase(text)
  if (!phrase) return
  const k = phraseKey(section, phrase) // section-scoped, case/whitespace-insensitive
  appSettings.update((s) => {
    const usage = { ...(s.phraseUsage ?? {}) }
    const cur = usage[k] ?? { count: 0, lastUsedAt: 0 }
    usage[k] = { count: cur.count + 1, lastUsedAt: Date.now() }
    return { ...s, phraseUsage: usage }
  })
  clearTimeout(usageTimer)
  usageTimer = setTimeout(() => {
    const rec = { ...get(appSettings), id: 'settings', updatedAt: Date.now() }
    persistSettings(rec) // key-guarded; silently drops if locked meanwhile
  }, 1200)
}

export async function changePassphrase(currentPass, newPass) {
  const expectedEpoch = sessionEpoch
  const vault = await db.meta.get('vault')
  const cur = await deriveKey(currentPass, vault.salt, vault.iterations)
  if (!(await checkVerification(cur, vault.check))) return false
  const salt = randomBytes(16)
  const newKey = await deriveKey(newPass, salt)
  const check = await makeVerification(newKey)
  const epoch = crypto.randomUUID()
  // Pre-encrypt everything BEFORE the transaction: Dexie transactions abort if
  // you await non-IndexedDB promises (WebCrypto) inside them.
  const rows = {}
  for (const t of DATA_TABLES) {
    rows[t] = await Promise.all(
      get(stores[t]).map(async (rec) => ({
        id: rec.id,
        updatedAt: rec.updatedAt ?? 0,
        blob: await encryptJSON(newKey, rec)
      }))
    )
  }
  const settingsRec = get(appSettings)
  const settingsRow = {
    id: 'settings',
    updatedAt: Date.now(),
    blob: await encryptJSON(newKey, settingsRec)
  }
  let stale = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    const liveVault = await db.meta.get('vault')
    if ((liveVault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    for (const t of DATA_TABLES) await db[t].bulkPut(rows[t])
    await db.settings.put(settingsRow)
    await db.meta.put({ key: 'vault', salt, iterations: PBKDF2_ITERATIONS, check, epoch })
  })
  if (stale) {
    hardLock()
    return false
  }
  key = newKey
  sessionEpoch = epoch
  announceVaultChange() // other tabs hard-lock; their stale key must not write
  return true
}

export async function eraseAllData() {
  key = null
  lockGen++
  await db.delete()
  await db.open()
  for (const store of Object.values(stores)) store.set([])
  appSettings.set(defaultSettings())
  lastBackupAt.set(null)
  lastModifiedAt.set(null)
  hasVault.set(false)
  locked.set(true)
  sessionEpoch = null
  channel?.postMessage({ epoch: null })
}

// ---- backup support ----

export function plainSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    clients: get(clients),
    goals: get(goals),
    sessions: get(sessions),
    settings: get(appSettings)
  }
}

export async function vaultParams() {
  const v = await db.meta.get('vault')
  return { salt: v.salt, iterations: v.iterations }
}

export function currentKey() {
  return key
}

export async function markBackupDone() {
  const now = Date.now()
  await db.meta.put({ key: 'lastBackup', value: now })
  lastBackupAt.set(now)
}

export async function importData(data, mode) {
  if (!key) return
  const expectedEpoch = sessionEpoch
  const incoming = {
    clients: data.clients ?? [],
    goals: data.goals ?? [],
    sessions: data.sessions ?? []
  }
  const next = {}
  for (const t of DATA_TABLES) {
    next[t] = mode === 'replace' ? incoming[t] : mergeRecords(get(stores[t]), incoming[t])
  }
  // Pre-encrypt outside the transaction (see changePassphrase).
  const rows = {}
  for (const t of DATA_TABLES) {
    rows[t] = await Promise.all(
      next[t].map(async (r) => ({
        id: r.id,
        updatedAt: r.updatedAt ?? 0,
        blob: await encryptJSON(key, r)
      }))
    )
  }
  // replace: take the backup's settings wholesale. merge: keep local device
  // preferences but merge the corpus (custom tags MUST travel with sessions
  // that reference them — see mergeCorpusSettings).
  const settingsRec =
    mode === 'replace' && data.settings
      ? { ...data.settings, id: 'settings' }
      : mode === 'merge' && data.settings
        ? { ...mergeCorpusSettings(get(appSettings), data.settings), id: 'settings' }
        : null
  const settingsRow = settingsRec
    ? { id: 'settings', updatedAt: Date.now(), blob: await encryptJSON(key, settingsRec) }
    : null
  // Bump the epoch so other open tabs hard-lock instead of overwriting the
  // imported data with their stale in-memory copies. Same key, new epoch.
  const vault = await db.meta.get('vault')
  const epoch = crypto.randomUUID()
  let stale = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    const liveVault = await db.meta.get('vault')
    if ((liveVault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    for (const t of DATA_TABLES) {
      if (mode === 'replace') await db[t].clear()
      await db[t].bulkPut(rows[t])
    }
    if (settingsRow) await db.settings.put(settingsRow)
    await db.meta.put({ ...vault, epoch })
  })
  if (stale) {
    hardLock()
    return false
  }
  sessionEpoch = epoch
  announceVaultChange()
  for (const t of DATA_TABLES) stores[t].set(next[t])
  if (settingsRec) appSettings.set(settingsRec)
  await touchModified()
  return true
}
