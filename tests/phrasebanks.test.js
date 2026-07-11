import { describe, it, expect } from 'vitest'
import {
  rankedBank,
  effectiveBank,
  DEFAULT_BANKS,
  phraseKey,
  usedInPrevText
} from '../src/lib/phrasebanks.js'

describe('phrase corpus ranking (§1)', () => {
  it('with no usage, returns base bank then learned, in order', () => {
    const settings = {
      phraseBanks: { S: ['alpha', 'beta'] },
      learned: { S: ['gamma'] }
    }
    expect(rankedBank(settings, 'S', {})).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('ranks by use count, then most-recent use, then base order', () => {
    const settings = { phraseBanks: { S: ['alpha', 'beta', 'gamma'] }, learned: { S: [] } }
    const usage = {
      alpha: { count: 1, lastUsedAt: 100 },
      beta: { count: 3, lastUsedAt: 50 },
      gamma: { count: 1, lastUsedAt: 200 }
    }
    // beta (3) first; then gamma vs alpha both count 1 → gamma more recent
    expect(rankedBank(settings, 'S', usage)).toEqual(['beta', 'gamma', 'alpha'])
  })

  it('dedupes a learned phrase identical to a base phrase', () => {
    const settings = { phraseBanks: { S: ['alpha', 'beta'] }, learned: { S: ['alpha', 'delta'] } }
    const ranked = rankedBank(settings, 'S', {})
    expect(ranked).toEqual(['alpha', 'beta', 'delta'])
    expect(ranked.filter((p) => p === 'alpha')).toHaveLength(1)
  })

  it('dedupes case-insensitively (base casing wins) and merges usage by lowercase key', () => {
    // e.g. base bank edited to 'Great effort today', learned holds 'great effort today'
    const settings = {
      phraseBanks: { S: ['Great effort today', 'beta'] },
      learned: { S: ['great effort today'] }
    }
    const usage = { 'great effort today': { count: 3, lastUsedAt: 10 } }
    const ranked = rankedBank(settings, 'S', usage)
    expect(ranked.filter((p) => p.toLowerCase() === 'great effort today')).toHaveLength(1)
    // base casing displayed, and usage keyed by lowercase still ranks it first
    expect(ranked[0]).toBe('Great effort today')
  })

  it('falls back to shipped defaults when no override, and tolerates missing fields', () => {
    expect(effectiveBank({}, 'S')).toEqual(DEFAULT_BANKS.S)
    expect(rankedBank({}, 'A', undefined)).toEqual(DEFAULT_BANKS.A)
    expect(rankedBank(undefined, 'P', {})).toEqual(DEFAULT_BANKS.P)
  })

  it('a frozen usage snapshot keeps order stable even as real counts change', () => {
    const settings = { phraseBanks: { S: ['alpha', 'beta'] }, learned: { S: [] } }
    const snapshot = { alpha: { count: 5, lastUsedAt: 1 } }
    // beta gets used a lot AFTER the snapshot — but ranking uses the snapshot
    expect(rankedBank(settings, 'S', snapshot)).toEqual(['alpha', 'beta'])
  })
})

describe('context-aware ranking (round 3)', () => {
  it('demotes phrases that appeared in this client\'s previous note, even heavily-used ones', () => {
    const settings = { phraseBanks: { S: ['alpha phrase', 'beta phrase'] }, learned: { S: [] } }
    const usage = { 'alpha phrase': { count: 9, lastUsedAt: 100 } }
    const context = { prevText: 'Alpha phrase. Something else happened too.' }
    // alpha was in last session's note → sinks below beta despite 9 uses
    expect(rankedBank(settings, 'S', usage, context)).toEqual(['beta phrase', 'alpha phrase'])
  })

  it('boosts domain-matched phrases above neutral, and mismatched below neutral', () => {
    const settings = {
      phraseBanks: { A: ['neutral untagged'] },
      learned: { A: ['artic phrase', 'social phrase'] },
      phraseDomains: {
        'artic phrase': ['articulation-phonology'],
        'social phrase': ['social-pragmatic']
      }
    }
    const context = { domains: ['articulation-phonology'] }
    expect(rankedBank(settings, 'A', {}, context)).toEqual([
      'artic phrase',
      'neutral untagged',
      'social phrase'
    ])
  })

  it('freshness demotion outranks domain affinity (rotation beats affinity)', () => {
    const settings = {
      phraseBanks: { A: ['neutral untagged'] },
      learned: { A: ['artic phrase'] },
      phraseDomains: { 'artic phrase': ['articulation-phonology'] }
    }
    const context = {
      domains: ['articulation-phonology'],
      prevText: 'artic phrase was used last time.'
    }
    expect(rankedBank(settings, 'A', {}, context)).toEqual(['neutral untagged', 'artic phrase'])
  })

  it('without context, behaves exactly as before (usage then order)', () => {
    const settings = {
      phraseBanks: { S: ['alpha', 'beta'] },
      learned: { S: [] },
      phraseDomains: { alpha: ['fluency'] }
    }
    // no context.domains → domain tags are neutral for everyone
    expect(rankedBank(settings, 'S', { beta: { count: 2, lastUsedAt: 5 } })).toEqual([
      'beta',
      'alpha'
    ])
  })
})

describe('phrase state keying (review fixes)', () => {
  it('phraseKey is section-scoped and whitespace/case-insensitive', () => {
    expect(phraseKey('S', '  Great   Effort  ')).toBe('S:great effort')
    expect(phraseKey('O', 'great effort')).not.toBe(phraseKey('A', 'great effort'))
  })

  it('rankedBank prefers section-scoped state but falls back to legacy plain keys', () => {
    const settings = { phraseBanks: { S: ['alpha', 'beta'] }, learned: { S: [] } }
    // legacy (pre-scoping) usage entry still ranks alpha first
    expect(rankedBank(settings, 'S', { alpha: { count: 3, lastUsedAt: 1 } })).toEqual([
      'alpha',
      'beta'
    ])
    // scoped entry for another section does NOT leak into S
    expect(rankedBank(settings, 'S', { 'O:alpha': { count: 3, lastUsedAt: 1 } })).toEqual([
      'alpha',
      'beta'
    ])
  })

  it('usage lookup tolerates base-bank phrases with irregular whitespace', () => {
    const settings = { phraseBanks: { S: ['double  space phrase', 'other'] }, learned: { S: [] } }
    // usage recorded under the normalized key still ranks the raw-text chip
    const usage = { 'S:double space phrase': { count: 5, lastUsedAt: 1 } }
    expect(rankedBank(settings, 'S', usage)[0]).toBe('double  space phrase')
  })
})

describe('usedInPrevText (review fixes)', () => {
  it('matches {slot} phrases after their slots were filled in', () => {
    expect(
      usedInPrevText(
        'difficulty generalizing skills to {context}',
        'Noted difficulty generalizing skills to the classroom.'
      )
    ).toBe(true)
    expect(
      usedInPrevText('recommend home practice: {activity}', 'Recommend home practice: flashcards.')
    ).toBe(true)
    expect(
      usedInPrevText('probe {skill} next session', 'Will probe categories next session.')
    ).toBe(true) // slot filled with "categories" — both literal segments still present
  })

  it('does not false-match mid-word (reported a good week vs weekend)', () => {
    expect(usedInPrevText('reported a good week', 'Mom reported a good weekend at home.')).toBe(
      false
    )
    expect(usedInPrevText('reported a good week', 'Teacher reported a good week overall.')).toBe(
      true
    )
  })

  it('handles empty and all-slot inputs safely', () => {
    expect(usedInPrevText('anything', '')).toBe(false)
    expect(usedInPrevText('{a} {b}', 'some previous text')).toBe(false)
  })
})
