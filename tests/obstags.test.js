import { describe, it, expect } from 'vitest'
import { OBSERVATION_TAGS, resolveObsTag, visibleObsTags } from '../src/lib/constants.js'

const custom = [
  { id: 'custom-1', chip: 'AAC modeled', clause: 'required aided language modeling', archived: false },
  { id: 'custom-2', chip: 'old tag', clause: 'did the old thing', archived: true }
]

describe('observation tags (round 3)', () => {
  it('resolves built-in, custom, and ARCHIVED custom tags (old notes must render)', () => {
    expect(resolveObsTag('self-correct', custom)?.clause).toBe('self-corrected errors independently')
    expect(resolveObsTag('custom-1', custom)?.clause).toBe('required aided language modeling')
    expect(resolveObsTag('custom-2', custom)?.clause).toBe('did the old thing')
    expect(resolveObsTag('nope', custom)).toBeNull()
  })

  it('visibleObsTags: built-ins + active custom by default; archived excluded', () => {
    const tags = visibleObsTags({ customObsTags: custom, hiddenObsTags: [] })
    const ids = tags.map((t) => t.id)
    expect(ids).toContain('self-correct')
    expect(ids).toContain('custom-1')
    expect(ids).not.toContain('custom-2')
  })

  it('hidden built-ins are excluded unless selected in this session', () => {
    const settings = { customObsTags: [], hiddenObsTags: ['fatigue'] }
    expect(visibleObsTags(settings).map((t) => t.id)).not.toContain('fatigue')
    // a reopened draft that already has it selected can still un-toggle it
    expect(visibleObsTags(settings, ['fatigue']).map((t) => t.id)).toContain('fatigue')
  })

  it('archived custom tags reappear only when selected in this session', () => {
    const settings = { customObsTags: custom, hiddenObsTags: [] }
    expect(visibleObsTags(settings, ['custom-2']).map((t) => t.id)).toContain('custom-2')
  })

  it('tolerates missing settings fields', () => {
    expect(visibleObsTags({}).map((t) => t.id)).toEqual(OBSERVATION_TAGS.map((t) => t.id))
    expect(visibleObsTags(undefined)).toHaveLength(OBSERVATION_TAGS.length)
  })
})
