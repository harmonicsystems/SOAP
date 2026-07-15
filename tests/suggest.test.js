import { describe, it, expect } from 'vitest'
import { aSuggestions } from '../src/lib/suggest.js'

describe('data-driven assessment suggestions', () => {
  it('does not claim criterion when accuracy qualifies but cueing does not', () => {
    const goal = {
      id: 'g1',
      shortLabel: 'multistep directions',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
    }
    const makeSession = (id, date, cueLevel) => ({
      id,
      clientId: 'c1',
      date,
      goalData: [
        {
          goalId: 'g1',
          trials: { correct: 9, total: 10 },
          cueLevel,
          cueTypes: ['visual']
        }
      ]
    })
    const sessions = [
      makeSession('s1', '2026-01-01', 'moderate'),
      makeSession('s2', '2026-01-08', 'moderate'),
      makeSession('s3', '2026-01-15', 'minimal'),
      makeSession('s4', '2026-01-22', 'minimal')
    ]

    const suggestions = aSuggestions(sessions[3], new Map([['g1', goal]]), sessions)
    expect(suggestions).toContain(
      'multistep directions: approaching criterion (2 of 3 consecutive sessions at target)'
    )
    expect(suggestions.some((text) => text.includes('met criterion'))).toBe(false)
  })

  it('does not call a goal emerging in the same set that says criterion is met', () => {
    const goal = {
      id: 'g1',
      shortLabel: 'vocalic /r/',
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
    }
    const sessions = ['01', '08', '15'].map((day, index) => ({
      id: `s${index}`,
      clientId: 'c1',
      date: `2026-01-${day}`,
      goalData: [
        {
          goalId: 'g1',
          trials: { correct: 9, total: 10 },
          cueLevel: 'minimal',
          cueTypes: ['visual']
        }
      ]
    }))

    const suggestions = aSuggestions(sessions[2], new Map([['g1', goal]]), sessions)
    expect(suggestions.some((text) => text.includes('met criterion'))).toBe(true)
    expect(suggestions.some((text) => text.includes('emerging skill'))).toBe(false)
  })
})
