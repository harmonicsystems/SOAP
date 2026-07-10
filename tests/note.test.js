import { describe, it, expect } from 'vitest'
import { assembleNote, scrubPlainText } from '../src/lib/note.js'

describe('note assembly (spec §7)', () => {
  const client = { code: 'JD' }
  const session = {
    date: '2026-07-10',
    durationMin: 30,
    setting: 'individual',
    soap: {
      S: 'Transitioned willingly.',
      O: 'JD produced /r/ in words with 80% accuracy (8/10 trials) given minimal cues.',
      A: 'Improved from 60% to 80%.',
      P: 'Continue current goals.'
    }
  }

  it('produces the exact plain-text format', () => {
    expect(assembleNote(client, session)).toBe(
      'SOAP NOTE — JD — 2026-07-10 — 30 min — individual\n' +
        '\n' +
        'S: Transitioned willingly.\n' +
        '\n' +
        'O: JD produced /r/ in words with 80% accuracy (8/10 trials) given minimal cues.\n' +
        '\n' +
        'A: Improved from 60% to 80%.\n' +
        '\n' +
        'P: Continue current goals.'
    )
  })

  it('scrubs smart quotes, tabs, and extra blank lines', () => {
    expect(scrubPlainText('“quoted” and ‘single’')).toBe(
      '"quoted" and \'single\''
    )
    expect(scrubPlainText('a\tb')).toBe('a b')
    expect(scrubPlainText('line one\n\n\nline two')).toBe('line one\nline two')
    expect(scrubPlainText('  padded  ')).toBe('padded')
    expect(scrubPlainText(null)).toBe('')
  })
})
