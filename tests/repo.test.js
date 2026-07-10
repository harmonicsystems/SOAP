import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { db } from '../src/lib/db.js'
import * as repo from '../src/lib/repo.js'

// Uses production iteration counts (a few derivations ≈ 1-2s in node) —
// acceptable for integration tests of the full encrypted-repository path.
describe('encrypted repository', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    repo.hardLock()
  })

  it('create vault → write → lock → unlock round-trip; ciphertext at rest', async () => {
    await repo.createVault('a strong passphrase')
    expect(get(repo.locked)).toBe(false)

    await repo.putRecord('clients', {
      id: 'c1',
      code: 'JDXQZ',
      notes: '',
      archived: false,
      createdAt: 1
    })
    expect(get(repo.clients)).toHaveLength(1)

    // at rest: only {id, updatedAt, blob}, and the blob is not plaintext
    const row = await db.clients.get('c1')
    expect(Object.keys(row).sort()).toEqual(['blob', 'id', 'updatedAt'])
    expect(row.blob).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(row.blob)).not.toContain('JDXQZ')

    await repo.lockNow()
    expect(get(repo.locked)).toBe(true)
    expect(get(repo.clients)).toEqual([]) // decrypted cache wiped

    expect(await repo.unlock('wrong passphrase')).toBe(false)
    expect(get(repo.locked)).toBe(true)

    expect(await repo.unlock('a strong passphrase')).toBe(true)
    expect(get(repo.clients).map((c) => c.code)).toEqual(['JDXQZ'])
  }, 30000)

  it('refuses to overwrite an existing vault (stale first-run tab)', async () => {
    await repo.createVault('first passphrase!')
    await repo.putRecord('clients', { id: 'c1', code: 'AB', archived: false, createdAt: 1 })
    await repo.lockNow()
    await expect(repo.createVault('second passphrase!')).rejects.toThrow('vault-exists')
    // original vault untouched
    expect(await repo.unlock('first passphrase!')).toBe(true)
    expect(get(repo.clients)).toHaveLength(1)
  }, 30000)

  it('lockNow flushes registered pending saves before wiping the key', async () => {
    await repo.createVault('flush test passphrase')
    let flushed = false
    const off = repo.onBeforeLock(async () => {
      // simulates SessionScreen's debounced flush — must still succeed
      const saved = await repo.putRecord('sessions', {
        id: 's1',
        clientId: 'c1',
        date: '2026-07-10',
        createdAt: 1
      })
      flushed = !!saved
    })
    await repo.lockNow()
    off()
    expect(flushed).toBe(true)
    expect(await repo.unlock('flush test passphrase')).toBe(true)
    expect(get(repo.sessions)).toHaveLength(1)
  }, 30000)

  it('tolerates a corrupt row: unlock succeeds, row skipped, warning counted', async () => {
    await repo.createVault('corruption test pass')
    await repo.putRecord('clients', { id: 'good', code: 'OK', archived: false, createdAt: 1 })
    // simulate a corrupted/garbage blob at rest
    await db.clients.put({ id: 'bad', updatedAt: 2, blob: crypto.getRandomValues(new Uint8Array(64)) })
    await repo.lockNow()
    expect(await repo.unlock('corruption test pass')).toBe(true)
    expect(get(repo.clients).map((c) => c.id)).toEqual(['good'])
    expect(get(repo.loadWarnings)).toBe(1)
  }, 30000)

  it('learns phrases (dedup), records usage, and persists across lock/unlock', async () => {
    await repo.createVault('corpus test passphrase')

    expect(await repo.savePhrase('S', '  needed  co-regulation before starting ')).toBe(true)
    expect(get(repo.appSettings).learned.S).toEqual(['needed co-regulation before starting'])

    // duplicate (case-insensitive) is rejected; duplicate of a default too
    expect(await repo.savePhrase('S', 'Needed co-regulation before starting')).toBe(false)
    expect(await repo.savePhrase('S', 'transitioned willingly to the session')).toBe(false)
    expect(get(repo.appSettings).learned.S).toHaveLength(1)

    repo.recordPhraseUse('needed co-regulation before starting')
    repo.recordPhraseUse('needed co-regulation before starting')
    expect(get(repo.appSettings).phraseUsage['needed co-regulation before starting'].count).toBe(2)

    // persists through a lock/unlock cycle (settings written eagerly on save)
    await repo.lockNow()
    expect(await repo.unlock('corpus test passphrase')).toBe(true)
    expect(get(repo.appSettings).learned.S).toEqual(['needed co-regulation before starting'])

    await repo.removeLearnedPhrase('S', 'needed co-regulation before starting')
    expect(get(repo.appSettings).learned.S).toEqual([])
    expect(get(repo.appSettings).phraseUsage['needed co-regulation before starting']).toBeUndefined()
  }, 30000)
})
