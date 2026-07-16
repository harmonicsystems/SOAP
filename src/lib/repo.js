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
  sampleProvenance,
  SAMPLE_DATASET_ID,
  DEMO_CASELOAD_TAGS
} from './sampleData.js'
import { todayISO } from './text.js'

let key = null // in-memory only; wiped on lock; never persisted
let lockGen = 0 // bumped on every lock; in-flight writes check it and bail
let sessionEpoch = null // vault epoch captured at unlock; guards cross-tab rekey

export const locked = writable(true)
export const appMode = writable('locked') // locked | private | demo
export const hasVault = writable(null) // null=checking, false=first run, true=vault exists
export const clients = writable([])
export const goals = writable([])
export const sessions = writable([])
export const appSettings = writable(defaultSettings())
export const lastBackupAt = writable(null)
export const lastModifiedAt = writable(null)
export const loadWarnings = writable(0) // rows skipped because they failed decryption
export const demoDirty = writable(false)
export const demoGuideStep = writable(1) // memory-only return point while exploring the demo

const DATA_TABLES = ['clients', 'goals', 'sessions']
const stores = { clients, goals, sessions }

// Screens with debounced pending edits register a flush here so lockNow() can
// persist them BEFORE the key is wiped (autosave must not lose data on lock).
const preLockHooks = new Set()
const pendingWrites = new Set()
export function onBeforeLock(fn) {
  preLockHooks.add(fn)
  return () => preLockHooks.delete(fn)
}

// A routed component can begin its destroy-time autosave just before the
// route-mode effect asks us to lock. Track those promises centrally so a mode
// transition cannot wipe the key while their encryption is still in flight.
export function trackPendingWrite(promise) {
  const pending = Promise.resolve(promise)
  pendingWrites.add(pending)
  pending.then(
    () => pendingWrites.delete(pending),
    () => pendingWrites.delete(pending)
  )
  return pending
}

async function awaitPendingWrites() {
  while (pendingWrites.size) await Promise.allSettled([...pendingWrites])
}

// Cross-tab safety: a passphrase change / erase / import in one tab must not
// let another tab keep writing under a stale key (that would permanently
// corrupt records). Other tabs hard-lock when the vault epoch changes.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('soap-vault') : null
channel?.addEventListener('message', (e) => {
  if (get(appMode) === 'private' && sessionEpoch !== null && e.data?.epoch !== sessionEpoch) {
    hardLock()
  }
})
function announceVaultChange(epoch = sessionEpoch) {
  channel?.postMessage({ epoch })
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
    hiddenObsTags: [],
    // Clinician-defined caseload tags: [{id, label, archived}] — neutral labels
    // (grade, room, site) for filtering/grouping the caseload. Archived, never
    // deleted, so clients referencing a retired tag keep rendering its badge.
    caseloadTags: []
  }
}

export async function checkVault() {
  const vault = await db.meta.get('vault')
  hasVault.set(!!vault)
  return !!vault
}

export async function createVault(passphrase) {
  if (get(appMode) !== 'locked') return false
  const gen = lockGen
  const salt = randomBytes(16)
  const k = await deriveKey(passphrase, salt)
  const check = await makeVerification(k)
  const epoch = crypto.randomUUID()
  let created = false
  let exists = false
  // The existence check must share the transaction with the create. Two
  // first-run tabs can otherwise both pass a pre-PBKDF check and the slower
  // one would orphan the first tab's encrypted records.
  await db.transaction('rw', db.meta, async () => {
    if (await db.meta.get('vault')) {
      exists = true
      return
    }
    if (lockGen !== gen || get(appMode) !== 'locked') return
    await db.meta.put({ key: 'vault', salt, iterations: PBKDF2_ITERATIONS, check, epoch })
    created = true
  })
  if (exists) throw new Error('vault-exists')
  if (!created) return false
  hasVault.set(true)
  announceVaultChange(epoch)
  if (lockGen !== gen || get(appMode) !== 'locked') return false

  const snapshot = await loadSnapshot(k)
  const liveVault = await db.meta.get('vault')
  if (
    lockGen !== gen ||
    get(appMode) !== 'locked' ||
    (liveVault?.epoch ?? null) !== epoch ||
    snapshot.epoch !== epoch
  ) {
    return false
  }
  publishPrivateSnapshot(k, epoch, snapshot)
  requestPersistentStorage()
  return true
}

export async function unlock(passphrase) {
  if (get(appMode) !== 'locked') return false
  const gen = lockGen
  const vault = await db.meta.get('vault')
  if (!vault) return false
  const expectedEpoch = vault.epoch ?? null
  const k = await deriveKey(passphrase, vault.salt, vault.iterations)
  if (!(await checkVerification(k, vault.check))) return false
  if (lockGen !== gen || get(appMode) !== 'locked') return false

  const snapshot = await loadSnapshot(k)
  const liveVault = await db.meta.get('vault')
  if (
    lockGen !== gen ||
    get(appMode) !== 'locked' ||
    snapshot.epoch !== expectedEpoch ||
    (liveVault?.epoch ?? null) !== expectedEpoch
  ) {
    // A different tab may have rekeyed/imported while PBKDF or decryption was
    // running. Stay locked and publish none of the partially loaded snapshot.
    if (lockGen === gen && get(appMode) === 'locked') hardLock()
    return false
  }
  publishPrivateSnapshot(k, expectedEpoch, snapshot)
  requestPersistentStorage()
  return true
}

function requestPersistentStorage() {
  // Reduce eviction risk for IndexedDB (spec §3). Best effort.
  try {
    Promise.resolve(globalThis.navigator?.storage?.persist?.()).catch(() => {})
  } catch {
    /* unsupported — ignore */
  }
}

async function loadSnapshot(readKey) {
  const raw = await db.transaction(
    'r',
    [db.meta, db.clients, db.goals, db.sessions, db.settings],
    async () => ({
      epoch: (await db.meta.get('vault'))?.epoch ?? null,
      rows: Object.fromEntries(
        await Promise.all(DATA_TABLES.map(async (name) => [name, await db[name].toArray()]))
      ),
      settingsRow: await db.settings.get('settings'),
      backupAt: (await db.meta.get('lastBackup'))?.value ?? null,
      modifiedAt: (await db.meta.get('lastModified'))?.value ?? null
    })
  )

  // Tolerate individual corrupt rows: one undecryptable blob must not make the
  // whole (mostly intact) vault inaccessible. Skipped rows are surfaced via
  // loadWarnings so the UI can tell the user to check backups.
  let skipped = 0
  const records = {}
  for (const name of DATA_TABLES) {
    const out = []
    for (const row of raw.rows[name]) {
      try {
        out.push(await decryptJSON(readKey, row.blob))
      } catch {
        skipped++
      }
    }
    records[name] = out
  }
  let settingsRec = defaultSettings()
  if (raw.settingsRow) {
    try {
      settingsRec = await decryptJSON(readKey, raw.settingsRow.blob)
    } catch {
      skipped++
    }
  }
  return { ...raw, records, settingsRec, skipped }
}

function publishPrivateSnapshot(readKey, epoch, snapshot) {
  // No awaits: consumers never observe a partially published private vault.
  key = readKey
  sessionEpoch = epoch
  for (const name of DATA_TABLES) stores[name].set(snapshot.records[name])
  appSettings.set(snapshot.settingsRec)
  lastBackupAt.set(snapshot.backupAt)
  lastModifiedAt.set(snapshot.modifiedAt)
  loadWarnings.set(snapshot.skipped)
  appMode.set('private')
  locked.set(false)
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
  await awaitPendingWrites()
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
  lastBackupAt.set(null)
  lastModifiedAt.set(null)
  loadWarnings.set(0)
  demoDirty.set(false)
  appMode.set('locked')
  locked.set(true)
}

function populateDemo(anchorDate) {
  const data = buildSampleDataset({ anchorDate })
  for (const table of DATA_TABLES) stores[table].set(data[table].map((record) => ({ ...record })))
  // Fresh copies each reset: demo settings mutations must never reach the
  // module-level tag definitions (or the private defaults).
  appSettings.set({
    ...defaultSettings(),
    caseloadTags: DEMO_CASELOAD_TAGS.map((t) => ({ ...t }))
  })
  lastBackupAt.set(null)
  lastModifiedAt.set(null)
  loadWarnings.set(0)
  demoDirty.set(false)
  demoGuideStep.set(1)
  appMode.set('demo')
  locked.set(false)
}

// The public demo reuses the production stores and components, but never the
// private key or IndexedDB. Entering from an unlocked vault first gives screens
// a chance to flush pending private autosaves, then wipes all decrypted state.
export async function enterDemo(anchorDate = todayISO()) {
  if (get(appMode) === 'private') await lockNow()
  else hardLock()
  populateDemo(anchorDate)
  return true
}

export async function resetDemo(anchorDate = todayISO()) {
  if (get(appMode) !== 'demo') return false
  await lockNow()
  populateDemo(anchorDate)
  return true
}

export function exitDemo() {
  if (get(appMode) !== 'demo') return false
  hardLock()
  return true
}

export function markDemoChanged() {
  if (get(appMode) === 'demo') demoDirty.set(true)
}

export async function putRecord(table, record) {
  if (get(appMode) === 'demo') {
    // Every descendant created while evaluating the demo remains visibly
    // fictional, including print views for newly-added records.
    const rec = {
      ...record,
      sample: true,
      sampleDataset: SAMPLE_DATASET_ID,
      updatedAt: Date.now()
    }
    stores[table].update((list) => {
      const index = list.findIndex((item) => item.id === rec.id)
      if (index < 0) return [...list, rec]
      const copy = [...list]
      copy[index] = rec
      return copy
    })
    demoDirty.set(true)
    return rec
  }
  const writeKey = key
  if (!writeKey) return null // locked mid-write (e.g., stale autosave timer) — drop
  const gen = lockGen
  const expectedEpoch = sessionEpoch
  const rec = { ...record, updatedAt: Date.now() }
  const blob = await encryptJSON(writeKey, rec)
  // Cross-tab guard and write share one IndexedDB transaction, so a rekey,
  // import, or rekey cannot land between the epoch check and the put.
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
  if (get(appMode) === 'demo') {
    stores[table].update((list) => list.filter((record) => record.id !== id))
    demoDirty.set(true)
    return true
  }
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

// Create a group session: one linked per-client Session record per client,
// sharing a groupId and the shared header (date/duration/setting). Each member
// is seeded with that client's active goals. Returns the shared groupId.
export async function createGroup(clientIds, opts = {}) {
  const mode = get(appMode)
  const gen = lockGen
  const writeKey = key
  const expectedEpoch = sessionEpoch
  if (mode !== 'demo' && (mode !== 'private' || !writeKey)) return null
  const groupId = crypto.randomUUID()
  const allGoals = get(goals)
  const allClients = get(clients)
  const records = clientIds.map((clientId) => {
    const active = allGoals.filter((g) => g.clientId === clientId && g.status === 'active')
    const client = allClients.find((record) => record.id === clientId)
    return {
      ...newSessionRecord(clientId, active, { ...opts, setting: 'group', groupId }),
      ...sampleProvenance(client)
    }
  })

  if (mode === 'demo') {
    if (lockGen !== gen || get(appMode) !== 'demo') return null
    const modifiedAt = Date.now()
    const marked = records.map((record) => ({
      ...record,
      sample: true,
      sampleDataset: SAMPLE_DATASET_ID,
      updatedAt: modifiedAt
    }))
    sessions.update((list) => [...list, ...marked])
    demoDirty.set(true)
    return groupId
  }

  const modifiedAt = Date.now()
  const persisted = records.map((record) => ({ ...record, updatedAt: modifiedAt }))
  const rows = await Promise.all(
    persisted.map(async (record) => ({
      id: record.id,
      updatedAt: record.updatedAt,
      blob: await encryptJSON(writeKey, record)
    }))
  )
  if (
    lockGen !== gen ||
    get(appMode) !== 'private' ||
    key !== writeKey ||
    sessionEpoch !== expectedEpoch
  ) {
    return null
  }
  let stale = false
  let wrote = false
  await db.transaction('rw', [db.meta, db.sessions], async () => {
    const vault = await db.meta.get('vault')
    if ((vault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return
    await db.sessions.bulkPut(rows)
    await db.meta.put({ key: 'lastModified', value: modifiedAt })
    wrote = true
  })
  if (stale) {
    if (lockGen === gen && get(appMode) === 'private' && key === writeKey) hardLock()
    return null
  }
  if (!wrote || lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return null
  sessions.update((list) => [...list, ...persisted])
  lastModifiedAt.set(modifiedAt)
  return groupId
}

// Same cross-tab guard as putRecord: the epoch check, encrypted settings write,
// and (for user-authored settings changes) backup-staleness timestamp are one
// transaction. `expectedEpoch` is captured before encryption so an autosave
// already in flight cannot cross a rekey/import boundary.
async function persistSettings(rec, markModified = false) {
  if (get(appMode) === 'demo') {
    if (markModified) demoDirty.set(true)
    return true
  }
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
  if (!key && get(appMode) !== 'demo') return
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
  if (!key && get(appMode) !== 'demo') return false
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
  if (!key && get(appMode) !== 'demo') return
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
  if (!key && get(appMode) !== 'demo') return
  const phrase = normalizePhrase(text)
  if (!phrase) return
  const k = phraseKey(section, phrase) // section-scoped, case/whitespace-insensitive
  appSettings.update((s) => {
    const usage = { ...(s.phraseUsage ?? {}) }
    const cur = usage[k] ?? { count: 0, lastUsedAt: 0 }
    usage[k] = { count: cur.count + 1, lastUsedAt: Date.now() }
    return { ...s, phraseUsage: usage }
  })
  if (get(appMode) === 'demo') {
    demoDirty.set(true)
    return
  }
  clearTimeout(usageTimer)
  usageTimer = setTimeout(() => {
    const rec = { ...get(appSettings), id: 'settings', updatedAt: Date.now() }
    persistSettings(rec) // key-guarded; silently drops if locked meanwhile
  }, 1200)
}

export async function changePassphrase(currentPass, newPass) {
  const writeKey = key
  const gen = lockGen
  if (get(appMode) !== 'private' || !writeKey) return false
  const expectedEpoch = sessionEpoch
  const vault = await db.meta.get('vault')
  if (!vault || (vault.epoch ?? null) !== expectedEpoch) {
    if (lockGen === gen && get(appMode) === 'private' && key === writeKey) hardLock()
    return false
  }
  const cur = await deriveKey(currentPass, vault.salt, vault.iterations)
  if (!(await checkVerification(cur, vault.check))) return false
  if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return false

  // Capture one private snapshot before the re-encryption work. Demo entry
  // wipes these stores, so reading them later could otherwise replace the
  // private vault with the fictional caseload.
  const source = Object.fromEntries(DATA_TABLES.map((name) => [name, get(stores[name])]))
  const settingsRec = get(appSettings)
  const salt = randomBytes(16)
  const newKey = await deriveKey(newPass, salt)
  const check = await makeVerification(newKey)
  const epoch = crypto.randomUUID()
  // Pre-encrypt everything BEFORE the transaction: Dexie transactions abort if
  // you await non-IndexedDB promises (WebCrypto) inside them.
  const rows = {}
  for (const t of DATA_TABLES) {
    rows[t] = await Promise.all(
      source[t].map(async (rec) => ({
        id: rec.id,
        updatedAt: rec.updatedAt ?? 0,
        blob: await encryptJSON(newKey, rec)
      }))
    )
  }
  const settingsRow = {
    id: 'settings',
    updatedAt: Date.now(),
    blob: await encryptJSON(newKey, settingsRec)
  }
  if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return false
  let stale = false
  let committed = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    const liveVault = await db.meta.get('vault')
    if ((liveVault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return
    for (const t of DATA_TABLES) await db[t].bulkPut(rows[t])
    await db.settings.put(settingsRow)
    await db.meta.put({ key: 'vault', salt, iterations: PBKDF2_ITERATIONS, check, epoch })
    committed = true
  })
  if (stale) {
    if (lockGen === gen && get(appMode) === 'private' && key === writeKey) hardLock()
    return false
  }
  if (!committed || lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return false
  key = newKey
  sessionEpoch = epoch
  announceVaultChange() // other tabs hard-lock; their stale key must not write
  return true
}

export async function eraseAllData() {
  if (get(appMode) === 'demo') {
    exitDemo()
    return
  }
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
  appMode.set('locked')
  sessionEpoch = null
  channel?.postMessage({ epoch: null })
}

// ---- backup support ----

export function plainSnapshot() {
  if (get(appMode) !== 'private' || !key) throw new Error('private-vault-required')
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
  if (get(appMode) !== 'private' || !key) throw new Error('private-vault-required')
  const v = await db.meta.get('vault')
  return { salt: v.salt, iterations: v.iterations }
}

export function currentKey() {
  return get(appMode) === 'private' ? key : null
}

export async function markBackupDone() {
  if (get(appMode) !== 'private' || !key) return false
  const now = Date.now()
  await db.meta.put({ key: 'lastBackup', value: now })
  lastBackupAt.set(now)
}

export async function importData(data, mode) {
  const writeKey = key
  const gen = lockGen
  if (get(appMode) !== 'private' || !writeKey) return false
  const expectedEpoch = sessionEpoch
  const current = Object.fromEntries(DATA_TABLES.map((name) => [name, get(stores[name])]))
  const currentSettings = get(appSettings)
  const incoming = {
    clients: data.clients ?? [],
    goals: data.goals ?? [],
    sessions: data.sessions ?? []
  }
  const next = {}
  for (const t of DATA_TABLES) {
    next[t] = mode === 'replace' ? incoming[t] : mergeRecords(current[t], incoming[t])
  }
  // Pre-encrypt outside the transaction (see changePassphrase).
  const rows = {}
  for (const t of DATA_TABLES) {
    rows[t] = await Promise.all(
      next[t].map(async (r) => ({
        id: r.id,
        updatedAt: r.updatedAt ?? 0,
        blob: await encryptJSON(writeKey, r)
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
        ? { ...mergeCorpusSettings(currentSettings, data.settings), id: 'settings' }
        : null
  const settingsRow = settingsRec
    ? { id: 'settings', updatedAt: Date.now(), blob: await encryptJSON(writeKey, settingsRec) }
    : null
  if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return false
  // Bump the epoch so other open tabs hard-lock instead of overwriting the
  // imported data with their stale in-memory copies. Same key, new epoch.
  const vault = await db.meta.get('vault')
  if (!vault || (vault.epoch ?? null) !== expectedEpoch) {
    if (lockGen === gen && get(appMode) === 'private' && key === writeKey) hardLock()
    return false
  }
  const epoch = crypto.randomUUID()
  const modifiedAt = Date.now()
  let stale = false
  let committed = false
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    const liveVault = await db.meta.get('vault')
    if ((liveVault?.epoch ?? null) !== expectedEpoch) {
      stale = true
      return
    }
    if (lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return
    for (const t of DATA_TABLES) {
      if (mode === 'replace') await db[t].clear()
      await db[t].bulkPut(rows[t])
    }
    if (settingsRow) await db.settings.put(settingsRow)
    await db.meta.put({ ...liveVault, epoch })
    await db.meta.put({ key: 'lastModified', value: modifiedAt })
    committed = true
  })
  if (stale) {
    if (lockGen === gen && get(appMode) === 'private' && key === writeKey) hardLock()
    return false
  }
  if (!committed || lockGen !== gen || get(appMode) !== 'private' || key !== writeKey) return false
  sessionEpoch = epoch
  announceVaultChange()
  for (const t of DATA_TABLES) stores[t].set(next[t])
  if (settingsRec) appSettings.set(settingsRec)
  lastModifiedAt.set(modifiedAt)
  return true
}
