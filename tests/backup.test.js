import { describe, it, expect } from 'vitest'
import {
  packBackup,
  unpackBackup,
  mergeRecords,
  mergeCorpusSettings,
  backupFilename
} from '../src/lib/backup.js'
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

  it('merge-mode settings: corpus travels, device preferences stay local', () => {
    const local = {
      autoLockMinutes: 5,
      therapistName: 'local',
      customObsTags: [{ id: 'custom-a', chip: 'local tag', clause: 'did local thing', archived: false }],
      learned: { S: ['local phrase'], O: [], A: [], P: [] },
      phraseUsage: { 'S:local phrase': { count: 2, lastUsedAt: 10 } },
      phraseDomains: { 'S:local phrase': ['fluency'] }
    }
    const incoming = {
      autoLockMinutes: 60,
      therapistName: 'other device',
      customObsTags: [
        { id: 'custom-a', chip: 'conflicting', clause: 'other version', archived: true },
        { id: 'custom-b', chip: 'AAC modeled', clause: 'required aided language modeling', archived: false }
      ],
      learned: { S: ['LOCAL PHRASE', 'imported phrase'], O: [], A: [], P: [] },
      phraseUsage: {
        'S:local phrase': { count: 9, lastUsedAt: 5 },
        'S:imported phrase': { count: 1, lastUsedAt: 3 }
      },
      phraseDomains: { 'S:local phrase': ['voice'] }
    }
    const merged = mergeCorpusSettings(local, incoming)
    // device preferences: local wins
    expect(merged.autoLockMinutes).toBe(5)
    expect(merged.therapistName).toBe('local')
    // custom tags: additive by id, local definition wins on conflict —
    // imported sessions referencing custom-b MUST keep rendering
    expect(merged.customObsTags).toHaveLength(2)
    expect(merged.customObsTags.find((t) => t.id === 'custom-a').clause).toBe('did local thing')
    expect(merged.customObsTags.find((t) => t.id === 'custom-b').chip).toBe('AAC modeled')
    // learned: additive, case-insensitive dedup
    expect(merged.learned.S).toEqual(['local phrase', 'imported phrase'])
    // usage: higher count wins; domains: union
    expect(merged.phraseUsage['S:local phrase'].count).toBe(9)
    expect(merged.phraseUsage['S:imported phrase'].count).toBe(1)
    expect(merged.phraseDomains['S:local phrase'].sort()).toEqual(['fluency', 'voice'])
  })

  it('merge-mode settings: caseload tag definitions travel with the records that use them', () => {
    const local = {
      caseloadTags: [{ id: 'ctag-a', label: 'Gr 3', archived: false }]
    }
    const incoming = {
      caseloadTags: [
        { id: 'ctag-a', label: 'Grade 3 (renamed elsewhere)', archived: true },
        { id: 'ctag-b', label: 'Rm 12', archived: false }
      ]
    }
    const merged = mergeCorpusSettings(local, incoming)
    // additive by id, local definition wins — imported clients tagged ctag-b
    // must keep their badge
    expect(merged.caseloadTags).toHaveLength(2)
    expect(merged.caseloadTags.find((t) => t.id === 'ctag-a').label).toBe('Gr 3')
    expect(merged.caseloadTags.find((t) => t.id === 'ctag-a').archived).toBe(false)
    expect(merged.caseloadTags.find((t) => t.id === 'ctag-b').label).toBe('Rm 12')
    // absent on both sides stays a clean empty list
    expect(mergeCorpusSettings({}, {}).caseloadTags).toEqual([])
  })
})
