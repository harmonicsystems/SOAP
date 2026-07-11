import { describe, it, expect } from 'vitest'
import { tokenize, textSimilarity, isNearDuplicate } from '../src/lib/similarity.js'

describe('anti-repetition similarity (round 3)', () => {
  const base =
    'Student transitioned willingly and participated actively throughout the entire session today.'

  it('tokenizes case-insensitively and strips punctuation', () => {
    expect(tokenize('Self-corrected, twice!')).toEqual(['self', 'corrected', 'twice'])
    expect(tokenize('')).toEqual([])
    expect(tokenize(null)).toEqual([])
  })

  it('identical text scores 1 and is a near-duplicate', () => {
    expect(textSimilarity(base, base)).toBe(1)
    expect(isNearDuplicate(base, base)).toBe(true)
  })

  it('a one-word tweak still reads as a near-duplicate', () => {
    const tweaked = base.replace('today', 'this morning')
    expect(isNearDuplicate(tweaked, base)).toBe(true)
  })

  it('genuinely different text is not flagged', () => {
    const different =
      'Arrived visibly upset after recess and required co-regulation before engaging with any task.'
    expect(textSimilarity(different, base)).toBeLessThan(0.5)
    expect(isNearDuplicate(different, base)).toBe(false)
  })

  it('short legitimate repeats are never flagged', () => {
    // "continue current goals"-style lines repeat honestly; below 5 tokens → no nudge
    expect(isNearDuplicate('Continue current goals.', 'Continue current goals.')).toBe(false)
  })

  it('empty previous text never flags', () => {
    expect(isNearDuplicate(base, '')).toBe(false)
    expect(textSimilarity(base, '')).toBe(0)
  })
})
