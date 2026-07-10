import { describe, it, expect } from 'vitest'
import { extractSlots, fillTemplate, slotLabel } from '../src/lib/templates.js'
import { getTemplates } from '../src/lib/goalTemplates.js'

describe('goal-template slot filler', () => {
  const tpl =
    'Will produce {phonemes} in the {position} position with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.'

  it('extracts slots uniquely, in order', () => {
    expect(extractSlots(tpl)).toEqual(['phonemes', 'position', 'accuracy', 'cueLevel', 'sessions'])
    expect(extractSlots('{a} and {b} and {a}')).toEqual(['a', 'b'])
  })

  it('fills all provided slots', () => {
    const out = fillTemplate(tpl, {
      phonemes: '/r/',
      position: 'initial',
      accuracy: 80,
      cueLevel: 'minimal',
      sessions: 3
    })
    expect(out).toBe(
      'Will produce /r/ in the initial position with 80% accuracy given minimal cues across 3 consecutive sessions.'
    )
  })

  it('leaves missing slots visible as placeholders', () => {
    expect(fillTemplate('{skill} at {accuracy}%', { accuracy: 90 })).toBe('{skill} at 90%')
    expect(fillTemplate('{skill}', { skill: '' })).toBe('{skill}')
  })

  it('prettifies slot names for form labels', () => {
    expect(slotLabel('conceptType')).toBe('concept type')
    expect(slotLabel('fieldSize')).toBe('field size')
  })

  it('ships at least 8 templates per priority domain', () => {
    for (const domain of [
      'receptive-language',
      'expressive-language',
      'articulation-phonology',
      'social-pragmatic'
    ]) {
      expect(getTemplates(domain).length, domain).toBeGreaterThanOrEqual(8)
    }
    // generic fallback for the rest
    for (const domain of ['fluency', 'voice', 'other']) {
      expect(getTemplates(domain).length, domain).toBeGreaterThanOrEqual(4)
    }
  })
})
