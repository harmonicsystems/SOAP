import { describe, it, expect } from 'vitest'
import { goalSentence, generateO, shortLabelFor, observationSentence } from '../src/lib/ogen.js'

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

describe('observation sentences (§2)', () => {
  it('joins one, two, and three tags grammatically with an Oxford comma', () => {
    expect(observationSentence('JD', { observations: ['self-correct'] })).toBe(
      'JD self-corrected errors independently.'
    )
    expect(observationSentence('JD', { observations: ['self-correct', 'fatigue'] })).toBe(
      'JD self-corrected errors independently and showed fatigue toward the end of the session.'
    )
    expect(
      observationSentence('JD', { observations: ['self-correct', 'model', 'generalized'] })
    ).toBe(
      'JD self-corrected errors independently, required repeated models, and generalized the target to spontaneous speech.'
    )
  })

  it('returns null with no observations and ignores unknown tag ids', () => {
    expect(observationSentence('JD', { observations: [] })).toBeNull()
    expect(observationSentence('JD', {})).toBeNull()
    expect(observationSentence('JD', { observations: ['not-a-real-tag'] })).toBeNull()
  })

  it('appends a goal observation sentence after its trial sentence in O', () => {
    const goals = [{ id: 'g1', shortLabel: '/r/ in words', text: 'Will produce /r/…' }]
    const goalData = [
      {
        goalId: 'g1',
        trials: { correct: 8, total: 10 },
        cueLevel: 'minimal',
        cueTypes: [],
        observations: ['self-correct']
      }
    ]
    expect(generateO('JD', goals, goalData)).toBe(
      'JD produced /r/ in words with 80% accuracy (8/10 trials) given minimal cues. JD self-corrected errors independently.'
    )
  })

  it('includes a goal with observations but no trials, and appends the standout line last', () => {
    const goals = [{ id: 'g1', shortLabel: 'wh-questions', text: 'Will answer…' }]
    const goalData = [
      { goalId: 'g1', trials: null, cueLevel: 'minimal', cueTypes: [], observations: ['initiated'] }
    ]
    // lowercase input is capitalized because it becomes its own sentence
    const o = generateO('JD', goals, goalData, '', 'used the whiteboard unprompted to self-cue')
    expect(o).toBe(
      'JD initiated responses independently. Used the whiteboard unprompted to self-cue.'
    )
  })
})
