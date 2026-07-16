import { describe, it, expect } from 'vitest'
import { accuracyPct } from '../src/lib/ogen.js'
import { streakFromPoints, goalCriterionStatus, progressSummary } from '../src/lib/progress.js'

describe('accuracy calculation', () => {
  it('computes rounded percentages', () => {
    expect(accuracyPct(8, 10)).toBe(80)
    expect(accuracyPct(1, 3)).toBe(33)
    expect(accuracyPct(2, 3)).toBe(67)
    expect(accuracyPct(10, 10)).toBe(100)
    expect(accuracyPct(0, 10)).toBe(0)
  })

  it('handles zero and missing totals', () => {
    expect(accuracyPct(0, 0)).toBe(0)
    expect(accuracyPct(5, 0)).toBe(0)
    expect(accuracyPct(0, undefined)).toBe(0)
  })
})

describe('criterion streaks', () => {
  const pts = (values) => values.map((pct, i) => ({ pct, date: `2026-01-0${i + 1}` }))

  it('counts consecutive sessions at/above target from the end', () => {
    expect(streakFromPoints(pts([50, 90, 85]), 80)).toBe(2)
    expect(streakFromPoints(pts([90, 90, 70]), 80)).toBe(0)
    expect(streakFromPoints(pts([80, 80, 80]), 80)).toBe(3)
    expect(streakFromPoints([], 80)).toBe(0)
  })

  it('reports met/nearing status', () => {
    const goal = {
      id: 'g1',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
    }
    const mkSession = (date, correct, total) => ({
      id: `s${date}`,
      date,
      createdAt: 1,
      goalData: [{ goalId: 'g1', trials: { correct, total }, cueLevel: 'minimal' }]
    })
    const sessions = [
      mkSession('2026-01-01', 5, 10), // 50%
      mkSession('2026-01-02', 9, 10), // 90%
      mkSession('2026-01-03', 8, 10) // 80%
    ]
    const st = goalCriterionStatus(goal, sessions)
    expect(st.streak).toBe(2)
    expect(st.met).toBe(false)
    expect(st.nearing).toBe(true) // 2 of 3 ≥ ceil(3/2)
  })

  it('requires the target cue level as well as target accuracy', () => {
    const goal = {
      id: 'g1',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
    }
    const mkSession = (date, cueLevel) => ({
      id: `s${date}`,
      date,
      createdAt: 1,
      goalData: [{ goalId: 'g1', trials: { correct: 9, total: 10 }, cueLevel }]
    })
    const sessions = [
      mkSession('2026-01-01', 'moderate'),
      mkSession('2026-01-02', 'moderate'),
      mkSession('2026-01-03', 'minimal'),
      mkSession('2026-01-04', 'independent')
    ]
    const st = goalCriterionStatus(goal, sessions)
    expect(st.streak).toBe(2)
    expect(st.met).toBe(false)
    expect(st.nearing).toBe(true)
  })

  it('describes an independent latest point without calling it a cue', () => {
    const goal = {
      id: 'g1',
      text: 'Will produce complete sentences.',
      shortLabel: 'complete sentences',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 1, cueLevel: 'independent' }
    }
    const sessions = [
      {
        id: 's1',
        date: '2026-01-01',
        goalData: [
          { goalId: 'g1', trials: { correct: 9, total: 10 }, cueLevel: 'independent' }
        ]
      }
    ]
    expect(progressSummary(goal, sessions)).toContain('most recently 90% independently.')
    expect(progressSummary(goal, sessions)).not.toContain('independent cues')
  })

  it('states a non-active goal status in copied progress text', () => {
    const goal = {
      id: 'g1',
      text: 'Will produce complete sentences.',
      shortLabel: 'complete sentences',
      status: 'discontinued',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
    }
    const sessions = [{
      id: 's1',
      date: '2026-01-01',
      goalData: [{ goalId: 'g1', trials: { correct: 5, total: 10 }, cueLevel: 'moderate' }]
    }]
    expect(progressSummary(goal, sessions)).toContain('Status: Discontinued.')
  })
})
