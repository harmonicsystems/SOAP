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

    expect(
      await repo.savePhrase('S', '  needed  co-regulation before starting ', [
        'articulation-phonology'
      ])
    ).toBe(true)
    expect(get(repo.appSettings).learned.S).toEqual(['needed co-regulation before starting'])
    // domain affinity stored under the SECTION-SCOPED key (round 3)
    expect(
      get(repo.appSettings).phraseDomains['S:needed co-regulation before starting']
    ).toEqual(['articulation-phonology'])

    // duplicate (case-insensitive) is rejected; duplicate of a default too
    expect(await repo.savePhrase('S', 'Needed co-regulation before starting')).toBe(false)
    expect(await repo.savePhrase('S', 'transitioned willingly to the session')).toBe(false)
    expect(get(repo.appSettings).learned.S).toHaveLength(1)

    repo.recordPhraseUse('S', 'needed co-regulation before starting')
    repo.recordPhraseUse('S', 'needed co-regulation before starting')
    expect(
      get(repo.appSettings).phraseUsage['S:needed co-regulation before starting'].count
    ).toBe(2)

    // persists through a lock/unlock cycle (settings written eagerly on save)
    await repo.lockNow()
    expect(await repo.unlock('corpus test passphrase')).toBe(true)
    expect(get(repo.appSettings).learned.S).toEqual(['needed co-regulation before starting'])

    // same text used as a chip in ANOTHER section keeps separate state…
    repo.recordPhraseUse('O', 'needed co-regulation before starting')
    await repo.removeLearnedPhrase('S', 'needed co-regulation before starting')
    expect(get(repo.appSettings).learned.S).toEqual([])
    expect(
      get(repo.appSettings).phraseUsage['S:needed co-regulation before starting']
    ).toBeUndefined()
    expect(
      get(repo.appSettings).phraseDomains['S:needed co-regulation before starting']
    ).toBeUndefined()
    // …and that O-section state survives the S-section removal
    expect(
      get(repo.appSettings).phraseUsage['O:needed co-regulation before starting'].count
    ).toBe(1)
  }, 30000)

  it('createGroup makes one linked session per client, sharing a groupId', async () => {
    await repo.createVault('group test passphrase')
    // three clients, each with a differing number of active goals
    for (const [cid, code] of [['c1', 'JD'], ['c2', 'S12'], ['c3', 'AB']]) {
      await repo.putRecord('clients', { id: cid, code, archived: false, createdAt: 1 })
    }
    await repo.putRecord('goals', { id: 'g1', clientId: 'c1', domain: 'articulation-phonology', text: 't', status: 'active', createdAt: 1 })
    await repo.putRecord('goals', { id: 'g2', clientId: 'c1', domain: 'articulation-phonology', text: 't', status: 'discontinued', createdAt: 1 })
    await repo.putRecord('goals', { id: 'g3', clientId: 'c2', domain: 'expressive-language', text: 't', status: 'active', createdAt: 1 })

    const gid = await repo.createGroup(['c1', 'c2', 'c3'], { date: '2026-07-11', durationMin: 30 })
    expect(typeof gid).toBe('string')

    const members = get(repo.sessions).filter((s) => s.groupId === gid)
    expect(members).toHaveLength(3)
    expect(members.every((s) => s.setting === 'group' && s.date === '2026-07-11')).toBe(true)
    expect(members.map((s) => s.clientId).sort()).toEqual(['c1', 'c2', 'c3'])
    // only ACTIVE goals seed goalData; c1 has 1 active (g2 discontinued), c3 has none
    expect(members.find((s) => s.clientId === 'c1').goalData.map((gd) => gd.goalId)).toEqual(['g1'])
    expect(members.find((s) => s.clientId === 'c3').goalData).toEqual([])
    // each member is an independent, individually-openable session record
    expect(new Set(members.map((s) => s.id)).size).toBe(3)
  }, 30000)
})
