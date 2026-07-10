import { describe, it, expect } from 'vitest'
import { rankedBank, effectiveBank, DEFAULT_BANKS } from '../src/lib/phrasebanks.js'

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
