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

  it('keeps the passphrase-free demo entirely separate from the private vault', async () => {
    await repo.createVault('demo isolation test passphrase')
    await repo.putRecord('clients', {
      id: 'private-client',
      code: 'KEEP',
      notes: 'private sentinel',
      archived: false,
      createdAt: 1
    })
    await repo.putRecord('goals', {
      id: 'private-goal',
      clientId: 'private-client',
      domain: 'expressive-language',
      text: 'private goal sentinel',
      status: 'active',
      createdAt: 1
    })
    await repo.savePhrase('S', 'private learned phrase sentinel', ['expressive-language'])
    await repo.saveSettings({
      ...get(repo.appSettings),
      therapistName: 'Private Therapist'
    })
    const privateSettings = get(repo.appSettings)
    let flushed = false
    const off = repo.onBeforeLock(async () => {
      flushed = !!(await repo.putRecord('sessions', {
        id: 'private-pending-session',
        clientId: 'private-client',
        date: '2026-07-14',
        createdAt: 2
      }))
    })
    expect(await repo.enterDemo('2026-07-14')).toBe(true)
    off()
    expect(flushed).toBe(true)
    expect(get(repo.appMode)).toBe('demo')
    expect(get(repo.locked)).toBe(false)
    expect(get(repo.clients)).toHaveLength(25)
    expect(get(repo.clients).some((client) => client.id === 'private-client')).toBe(false)
    expect(get(repo.appSettings).therapistName).toBe('')
    expect(repo.currentKey()).toBeNull()
    expect(() => repo.plainSnapshot()).toThrow('private-vault-required')
    const privateRowsAfterEntry = {
      clients: await db.clients.toArray(),
      goals: await db.goals.toArray(),
      sessions: await db.sessions.toArray(),
      settings: await db.settings.toArray(),
      meta: await db.meta.toArray()
    }

    const demoSession = get(repo.sessions)[0]
    const demoGoal = get(repo.goals)[0]
    await repo.putRecord('sessions', { ...demoSession, durationMin: 99 })
    await repo.deleteRecord('goals', demoGoal.id)
    await repo.putRecord('clients', {
      id: 'temporary-demo-client',
      code: 'TMP',
      archived: false,
      createdAt: 3
    })
    await repo.saveSettings({ ...get(repo.appSettings), therapistName: 'Temporary Demo' })
    await repo.savePhrase('S', 'temporary demo phrase')
    const groupId = await repo.createGroup(get(repo.clients).slice(0, 2).map((client) => client.id), {
      date: '2026-03-20',
      durationMin: 30
    })
    expect(groupId).toEqual(expect.any(String))
    expect(get(repo.demoDirty)).toBe(true)
    expect(get(repo.clients).some((client) => client.id === 'temporary-demo-client')).toBe(true)
    expect(get(repo.clients).find((client) => client.id === 'temporary-demo-client')).toEqual(
      expect.objectContaining({ sample: true, sampleDataset: 'winter-trimester-v2' })
    )
    expect({
      clients: await db.clients.toArray(),
      goals: await db.goals.toArray(),
      sessions: await db.sessions.toArray(),
      settings: await db.settings.toArray(),
      meta: await db.meta.toArray()
    }).toEqual(privateRowsAfterEntry)

    // Reset awaits the outgoing screen's pending save, then rebuilds the
    // canonical fixture afterward; the stale working copy cannot resurrect.
    const resetSession = get(repo.sessions)[0]
    const offReset = repo.onBeforeLock(() =>
      repo.putRecord('sessions', { ...resetSession, durationMin: 123 })
    )
    expect(await repo.resetDemo('2026-07-14')).toBe(true)
    offReset()
    expect(get(repo.sessions).find((session) => session.id === resetSession.id)?.durationMin).not.toBe(123)
    expect(get(repo.clients)).toHaveLength(25)
    expect(get(repo.clients).some((client) => client.id === 'temporary-demo-client')).toBe(false)
    expect(get(repo.demoDirty)).toBe(false)
    expect(await repo.resetDemo('2026-07-14')).toBe(true)
    expect(get(repo.clients)).toHaveLength(25)
    expect(get(repo.sessions)).toHaveLength(268)
    expect(repo.exitDemo()).toBe(true)
    expect(get(repo.appMode)).toBe('locked')
    expect(get(repo.clients)).toEqual([])

    expect(await repo.unlock('demo isolation test passphrase')).toBe(true)
    expect(get(repo.clients)).toContainEqual(
      expect.objectContaining({ id: 'private-client', code: 'KEEP', notes: 'private sentinel' })
    )
    expect(get(repo.sessions)).toContainEqual(expect.objectContaining({ id: 'private-pending-session' }))
    expect(get(repo.goals)).toContainEqual(expect.objectContaining({ id: 'private-goal' }))
    expect(get(repo.appSettings)).toEqual(privateSettings)
  }, 30000)

  it('cancels stale create and unlock completions when demo entry wins the lifecycle', async () => {
    const pendingCreate = repo.createVault('stale create passphrase')
    await repo.enterDemo('2026-07-14')
    expect(await pendingCreate).toBe(false)
    expect(get(repo.appMode)).toBe('demo')
    expect(repo.currentKey()).toBeNull()
    expect(await db.meta.get('vault')).toBeUndefined()

    repo.exitDemo()
    await repo.createVault('stale unlock passphrase')
    await repo.putRecord('clients', { id: 'private', code: 'PV', archived: false, createdAt: 1 })
    await repo.lockNow()
    const pendingUnlock = repo.unlock('stale unlock passphrase')
    await repo.enterDemo('2026-07-14')
    expect(await pendingUnlock).toBe(false)
    expect(get(repo.appMode)).toBe('demo')
    expect(get(repo.clients).some((client) => client.id === 'private')).toBe(false)
    expect(repo.currentKey()).toBeNull()
  }, 30000)

  it('serializes concurrent first-run vault creation', async () => {
    const attempts = await Promise.allSettled([
      repo.createVault('first concurrent passphrase'),
      repo.createVault('second concurrent passphrase')
    ])
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled' && attempt.value === true)).toHaveLength(1)
    expect(attempts.filter((attempt) => attempt.status === 'rejected' && attempt.reason?.message === 'vault-exists')).toHaveLength(1)
    await repo.lockNow()
    const firstWorks = await repo.unlock('first concurrent passphrase')
    if (firstWorks) await repo.lockNow()
    const secondWorks = await repo.unlock('second concurrent passphrase')
    expect(Number(firstWorks) + Number(secondWorks)).toBe(1)
  }, 30000)

  it('awaits destroy-time writes before entering demo', async () => {
    await repo.createVault('tracked write passphrase')
    const pending = repo.trackPendingWrite(
      repo.putRecord('sessions', {
        id: 'destroy-save',
        clientId: 'private-client',
        date: '2026-07-14',
        notes: 'x'.repeat(1024 * 1024),
        createdAt: 1
      })
    )
    await repo.enterDemo('2026-07-14')
    expect(await pending).toEqual(expect.objectContaining({ id: 'destroy-save' }))
    repo.exitDemo()
    expect(await repo.unlock('tracked write passphrase')).toBe(true)
    expect(get(repo.sessions)).toContainEqual(expect.objectContaining({ id: 'destroy-save' }))
  }, 30000)

  it('cancels rekey, import, and group creation when the app switches to demo', async () => {
    await repo.createVault('exclusive race passphrase')
    await repo.putRecord('clients', { id: 'c1', code: 'AA', archived: false, createdAt: 1 })
    await repo.putRecord('clients', { id: 'c2', code: 'BB', archived: false, createdAt: 1 })
    await repo.putRecord('goals', { id: 'g1', clientId: 'c1', domain: 'other', text: 'target', status: 'active', createdAt: 1 })

    const pendingGroup = repo.createGroup(['c1', 'c2'], { date: '2026-07-14' })
    await repo.enterDemo('2026-07-14')
    expect(await pendingGroup).toBeNull()
    repo.exitDemo()
    expect(await repo.unlock('exclusive race passphrase')).toBe(true)
    expect(get(repo.sessions)).toHaveLength(0)

    const pendingRekey = repo.changePassphrase('exclusive race passphrase', 'replacement passphrase')
    await repo.enterDemo('2026-07-14')
    expect(await pendingRekey).toBe(false)
    repo.exitDemo()
    expect(await repo.unlock('exclusive race passphrase')).toBe(true)

    const pendingImport = repo.importData({
      clients: [{ id: 'imported', code: 'IM', notes: 'x'.repeat(1024 * 1024), updatedAt: 2 }],
      goals: [],
      sessions: []
    }, 'replace')
    await repo.enterDemo('2026-07-14')
    expect(await pendingImport).toBe(false)
    repo.exitDemo()
    expect(await repo.unlock('exclusive race passphrase')).toBe(true)
    expect(get(repo.clients).some((client) => client.id === 'imported')).toBe(false)
    expect(get(repo.clients).map((client) => client.id).sort()).toEqual(['c1', 'c2'])
  }, 60000)

  it('does not publish an unlock snapshot after the vault epoch changes', async () => {
    await repo.createVault('unlock epoch passphrase')
    await repo.putRecord('clients', {
      id: 'large',
      code: 'LG',
      notes: 'x'.repeat(1024 * 1024),
      archived: false,
      createdAt: 1
    })
    await repo.lockNow()
    const pending = repo.unlock('unlock epoch passphrase')
    await new Promise((resolve) => setTimeout(resolve, 20))
    const vault = await db.meta.get('vault')
    await db.meta.put({ ...vault, epoch: 'changed-during-unlock' })
    expect(await pending).toBe(false)
    expect(get(repo.locked)).toBe(true)
    expect(get(repo.clients)).toEqual([])
  }, 30000)

  it('drops record and settings writes that began before an epoch change', async () => {
    await repo.createVault('in-flight epoch test passphrase')
    const largeText = 'x'.repeat(1024 * 1024)

    // putRecord captures the epoch before its asynchronous encryption. Change
    // the live epoch while that encryption is in flight: the row must not land.
    const pendingRecord = repo.putRecord('clients', {
      id: 'late-client',
      code: 'L8',
      notes: largeText,
      archived: false,
      createdAt: 1
    })
    const firstVault = await db.meta.get('vault')
    await db.meta.put({ ...firstVault, epoch: 'record-epoch-changed' })
    expect(await pendingRecord).toBeNull()
    expect(await db.clients.get('late-client')).toBeUndefined()
    expect(get(repo.locked)).toBe(true)

    expect(await repo.unlock('in-flight epoch test passphrase')).toBe(true)
    const pendingSettings = repo.saveSettings({
      ...get(repo.appSettings),
      therapistName: largeText
    })
    const secondVault = await db.meta.get('vault')
    await db.meta.put({ ...secondVault, epoch: 'settings-epoch-changed' })
    await pendingSettings
    expect(await db.settings.get('settings')).toBeUndefined()
    expect(await db.meta.get('lastModified')).toBeUndefined()
    expect(get(repo.locked)).toBe(true)
  }, 30000)
})
