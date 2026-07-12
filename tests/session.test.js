import { describe, it, expect } from 'vitest'
import { newSessionRecord } from '../src/lib/session.js'

const goals = [
  { id: 'g1', targetCriterion: { cueLevel: 'moderate' } },
  { id: 'g2', targetCriterion: { cueLevel: 'independent' } }
]

describe('newSessionRecord (shared session builder)', () => {
  it('builds an individual session with the full round-3 shape', () => {
    const s = newSessionRecord('c1', goals, { date: '2026-07-11', durationMin: 45 })
    expect(s.clientId).toBe('c1')
    expect(s.groupId).toBeNull()
    expect(s.date).toBe('2026-07-11')
    expect(s.durationMin).toBe(45)
    expect(s.setting).toBe('individual')
    expect(s.status).toBe('draft')
    expect(s.soap).toEqual({ S: '', O: '', A: '', P: '' })
    expect(s.oEdited).toBe(false)
    expect(s.observations).toBe('')
    expect(s.standout).toBe('')
    expect(typeof s.id).toBe('string')
  })

  it('seeds goalData from active goals, carrying the cue level and empty round-3 fields', () => {
    const s = newSessionRecord('c1', goals)
    expect(s.goalData).toHaveLength(2)
    expect(s.goalData[0]).toEqual({
      goalId: 'g1',
      trials: null,
      cueLevel: 'moderate',
      cueTypes: [],
      observations: [],
      activity: '',
      notes: ''
    })
    expect(s.goalData[1].cueLevel).toBe('independent')
  })

  it('carries a groupId and group setting for group members; defaults cue level', () => {
    const s = newSessionRecord('c2', [{ id: 'g9' }], { groupId: 'grp-1', setting: 'group' })
    expect(s.groupId).toBe('grp-1')
    expect(s.setting).toBe('group')
    expect(s.goalData[0].cueLevel).toBe('minimal') // fallback when no targetCriterion
  })

  it('defaults to today and 30 min with no options; empty goals → no cards', () => {
    const s = newSessionRecord('c1', [])
    expect(s.durationMin).toBe(30)
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(s.goalData).toEqual([])
  })
})
