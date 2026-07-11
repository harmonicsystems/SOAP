import { describe, it, expect } from 'vitest'
import { matchRoute } from '../src/lib/router.js'

describe('hash route matching', () => {
  it('resolves the new #/help route', () => {
    expect(matchRoute('#/help')).toEqual({ name: 'help', params: {} })
  })

  it('still resolves every existing route (no ROUTES collision)', () => {
    expect(matchRoute('').name).toBe('lock')
    expect(matchRoute('#/').name).toBe('lock')
    expect(matchRoute('#/clients').name).toBe('clients')
    expect(matchRoute('#/client/abc')).toEqual({ name: 'client', params: { id: 'abc' } })
    expect(matchRoute('#/client/abc/progress')).toEqual({
      name: 'progress',
      params: { id: 'abc' }
    })
    expect(matchRoute('#/session/s1')).toEqual({ name: 'session', params: { id: 's1' } })
    expect(matchRoute('#/session/s1/note')).toEqual({ name: 'note', params: { id: 's1' } })
    expect(matchRoute('#/settings').name).toBe('settings')
  })

  it('unknown paths fall through to notfound', () => {
    expect(matchRoute('#/nope').name).toBe('notfound')
    expect(matchRoute('#/help/extra').name).toBe('notfound')
  })
})
