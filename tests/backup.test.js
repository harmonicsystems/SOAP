import { describe, it, expect } from 'vitest'
import { packBackup, unpackBackup, mergeRecords, backupFilename } from '../src/lib/backup.js'
import { deriveKey, randomBytes } from '../src/lib/crypto.js'

const ITER = 1000

const sampleData = {
  version: 1,
  exportedAt: '2026-07-10T12:00:00.000Z',
  clients: [{ id: 'c1', code: 'JD', archived: false, createdAt: 1, updatedAt: 5 }],
  goals: [{ id: 'g1', clientId: 'c1', domain: 'articulation-phonology', text: 'Will produce /r/…', updatedAt: 5 }],
  sessions: [],
  settings: { id: 'settings', autoLockMinutes: 15 }
}

describe('backup', () => {
  it('round-trips through pack/unpack', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('my passphrase', salt, ITER)
    const bytes = await packBackup(sampleData, key, salt, ITER)
    const restored = await unpackBackup(bytes, 'my passphrase')
    expect(restored).toEqual(sampleData)
  })

  it('rejects the wrong passphrase', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('my passphrase', salt, ITER)
    const bytes = await packBackup(sampleData, key, salt, ITER)
    await expect(unpackBackup(bytes, 'not my passphrase')).rejects.toThrow()
  })

  it('rejects files that are not SOAP backups', async () => {
    await expect(unpackBackup(new Uint8Array(40), 'x')).rejects.toThrow('Not a SOAP backup file')
    await expect(unpackBackup(new Uint8Array(3), 'x')).rejects.toThrow('Not a SOAP backup file')
  })

  it('merge: newer updatedAt wins, unknown ids are added', () => {
    const existing = [
      { id: 'a', v: 'old', updatedAt: 10 },
      { id: 'b', v: 'newer-local', updatedAt: 30 }
    ]
    const incoming = [
      { id: 'a', v: 'new', updatedAt: 20 },
      { id: 'b', v: 'older-import', updatedAt: 20 },
      { id: 'c', v: 'brand-new', updatedAt: 5 }
    ]
    const merged = mergeRecords(existing, incoming)
    const byId = Object.fromEntries(merged.map((r) => [r.id, r.v]))
    expect(byId).toEqual({ a: 'new', b: 'newer-local', c: 'brand-new' })
  })

  it('names the file soap-backup-YYYY-MM-DD.enc', () => {
    expect(backupFilename(new Date(2026, 6, 10))).toBe('soap-backup-2026-07-10.enc')
  })
})
