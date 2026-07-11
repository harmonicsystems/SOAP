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
  if (!key) return null // locked mid-write (e.g., stale autosave timer) — drop
  const gen = lockGen
  const rec = { ...record, updatedAt: Date.now() }
  const blob = await encryptJSON(key, rec)
  // Cross-tab guard: never write under a stale key after another tab rekeyed.
  const vault = await db.meta.get('vault')
  if (vault && (vault.epoch ?? null) !== sessionEpoch) {
    hardLock()
    return null
  }
  if (lockGen !== gen || !key) return null // locked while we were encrypting
  await db[table].put({ id: rec.id, updatedAt: rec.updatedAt, blob })
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
  await touchModified()
  return rec
}

export async function deleteRecord(table, id) {
  if (!key) return
  await db[table].delete(id)
  stores[table].update((list) => list.filter((r) => r.id !== id))
  await touchModified()
}

// Same cross-tab guard as putRecord: never write under a stale key after
// another tab rekeyed the vault (that would corrupt the settings row and
// silently reset learned phrases on next unlock). Returns true on success.
async function persistSettings(rec) {
  if (!key) return false
  const blob = await encryptJSON(key, rec)
  const vault = await db.meta.get('vault')
  if (vault && (vault.epoch ?? null) !== sessionEpoch) {
    hardLock()
    return false
  }
  if (!key) return false
  await db.settings.put({ id: 'settings', updatedAt: rec.updatedAt, blob })
  return true
}

export async function saveSettings(next) {
  if (!key) return
  const rec = { ...next, id: 'settings', updatedAt: Date.now() }
  if (!(await persistSettings(rec))) return // stale key / locked — drop
  appSettings.set(rec)
  // Settings (phrase banks, therapist name) are part of backups too — the
  // backup-staleness nag must see these changes.
  await touchModified()
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
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    for (const t of DATA_TABLES) await db[t].bulkPut(rows[t])
    await db.settings.put(settingsRow)
    await db.meta.put({ key: 'vault', salt, iterations: PBKDF2_ITERATIONS, check, epoch })
  })
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
  await db.transaction('rw', [db.meta, db.clients, db.goals, db.sessions, db.settings], async () => {
    for (const t of DATA_TABLES) {
      if (mode === 'replace') await db[t].clear()
      await db[t].bulkPut(rows[t])
    }
    if (settingsRow) await db.settings.put(settingsRow)
    await db.meta.put({ ...vault, epoch })
  })
  sessionEpoch = epoch
  announceVaultChange()
  for (const t of DATA_TABLES) stores[t].set(next[t])
  if (settingsRec) appSettings.set(settingsRec)
  await touchModified()
}
