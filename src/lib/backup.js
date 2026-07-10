// Backup export/import (spec §3).
//
// File format: soap-backup-YYYY-MM-DD.enc
//   [8 bytes magic "SOAPBKP1"]
//   [1 byte  salt length]
//   [N bytes salt]
//   [4 bytes PBKDF2 iterations, little-endian]
//   [12-byte IV + AES-GCM ciphertext of versioned JSON]
//
// The salt/iterations header makes the file self-contained: restoring on a
// fresh device only needs the passphrase.
import { deriveKey, encryptJSON, decryptJSON } from './crypto.js'
import { todayISO } from './text.js'

const MAGIC = 'SOAPBKP1'
const te = new TextEncoder()
const td = new TextDecoder()

export async function packBackup(data, key, salt, iterations) {
  const blob = await encryptJSON(key, data)
  const out = new Uint8Array(8 + 1 + salt.length + 4 + blob.length)
  out.set(te.encode(MAGIC), 0)
  out[8] = salt.length
  out.set(salt, 9)
  new DataView(out.buffer).setUint32(9 + salt.length, iterations, true)
  out.set(blob, 9 + salt.length + 4)
  return out
}

export async function unpackBackup(bytes, passphrase) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (u8.length < 14 || td.decode(u8.slice(0, 8)) !== MAGIC) {
    throw new Error('Not a SOAP backup file')
  }
  const saltLen = u8[8]
  const salt = u8.slice(9, 9 + saltLen)
  const iterations = new DataView(u8.buffer, u8.byteOffset).getUint32(9 + saltLen, true)
  const blob = u8.slice(9 + saltLen + 4)
  const key = await deriveKey(passphrase, salt, iterations)
  return decryptJSON(key, blob) // throws on wrong passphrase (GCM auth failure)
}

// Merge policy: by id, newer updatedAt wins (spec §3 "merge" import mode).
export function mergeRecords(existing, incoming) {
  const byId = new Map(existing.map((r) => [r.id, r]))
  for (const r of incoming) {
    const cur = byId.get(r.id)
    if (!cur || (r.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(r.id, r)
  }
  return [...byId.values()]
}

export function backupFilename(d = new Date()) {
  return `soap-backup-${todayISO(d)}.enc`
}

// File System Access API on Edge/Chrome, <a download> fallback (spec §3).
// Returns true if the file was saved, false if the user cancelled.
export async function saveBackupFile(bytes, filename = backupFilename()) {
  if (globalThis.showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          { description: 'Encrypted SOAP backup', accept: { 'application/octet-stream': ['.enc'] } }
        ]
      })
      const writable = await handle.createWritable()
      await writable.write(bytes)
      await writable.close()
      return true
    } catch (e) {
      if (e.name === 'AbortError') return false
      // any other failure → fall through to the download fallback
    }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}
