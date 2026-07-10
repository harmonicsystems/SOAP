import { describe, it, expect } from 'vitest'
import { goalSentence, generateO, shortLabelFor } from '../src/lib/ogen.js'

const goal = {
  id: 'g1',
  shortLabel: '/r/ in words',
  text: 'Will produce /r/ in the initial position at the word level…'
}

describe('O-section generation', () => {
  it('follows the exact spec pattern', () => {
    const gd = {
      goalId: 'g1',
      trials: { correct: 8, total: 10 },
      cueLevel: 'minimal',
      cueTypes: ['verbal', 'visual'],
      activity: 'structured drill'
    }
    expect(goalSentence('JD', goal, gd)).toBe(
      'JD produced /r/ in words with 80% accuracy (8/10 trials) given minimal verbal, visual cues during structured drill.'
    )
  })

  it('reads independent productions as "independently"', () => {
    const gd = { goalId: 'g1', trials: { correct: 9, total: 10 }, cueLevel: 'independent', cueTypes: [] }
    expect(goalSentence('JD', goal, gd)).toBe(
      'JD produced /r/ in words with 90% accuracy (9/10 trials) independently.'
    )
  })

  it('omits the activity clause when blank and cue types when none', () => {
    const gd = { goalId: 'g1', trials: { correct: 5, total: 10 }, cueLevel: 'moderate', cueTypes: [] }
    expect(goalSentence('JD', goal, gd)).toBe(
      'JD produced /r/ in words with 50% accuracy (5/10 trials) given moderate cues.'
    )
  })

  it('omits goals with no trials and appends observations', () => {
    const goals = [goal, { id: 'g2', shortLabel: 'wh-questions', text: 'Will answer…' }]
    const goalData = [
      { goalId: 'g1', trials: { correct: 8, total: 10 }, cueLevel: 'minimal', cueTypes: [] },
      { goalId: 'g2', trials: null, cueLevel: 'minimal', cueTypes: [] }
    ]
    const o = generateO('JD', goals, goalData, 'Remained engaged throughout.')
    expect(o).toBe(
      'JD produced /r/ in words with 80% accuracy (8/10 trials) given minimal cues. Remained engaged throughout.'
    )
    expect(o).not.toContain('wh-questions')
  })

  it('derives a short label from goal text when none is set', () => {
    const g = { text: 'Will follow 2-step directions containing temporal concepts with 80%…' }
    expect(shortLabelFor(g)).toBe('follow 2-step directions containing temporal concepts')
  })
})
