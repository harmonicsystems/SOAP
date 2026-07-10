import Dexie from 'dexie'

// Every data table stores only {id, updatedAt, blob} where blob is AES-GCM
// ciphertext. All searchable/queryable fields live INSIDE the encrypted
// payload and are indexed in memory after unlock (spec §2.2).
// `meta` holds only non-identifying vault parameters (salt, iterations,
// verification value) and bookkeeping timestamps.
export const db = new Dexie('soap-note-builder')

db.version(1).stores({
  meta: 'key',
  clients: 'id, updatedAt',
  goals: 'id, updatedAt',
  sessions: 'id, updatedAt',
  settings: 'id'
})
