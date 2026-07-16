import { describe, it, expect } from 'vitest'
import { matchRoute, hrefFor } from '../src/lib/router.js'

describe('hash route matching', () => {
  it('resolves public welcome, workspace, and Help routes', () => {
    expect(matchRoute('')).toEqual({ mode: 'public', name: 'welcome', params: {} })
    expect(matchRoute('#/')).toEqual({ mode: 'public', name: 'welcome', params: {} })
    expect(matchRoute('#/create')).toEqual({ mode: 'public', name: 'create', params: {} })
    expect(matchRoute('#/unlock')).toEqual({ mode: 'public', name: 'unlock', params: {} })
    expect(matchRoute('#/help')).toEqual({ mode: 'public', name: 'help', params: {} })
  })

  it('resolves every private workspace route', () => {
    expect(matchRoute('#/clients')).toEqual({ mode: 'private', name: 'clients', params: {} })
    expect(matchRoute('#/client/abc')).toEqual({
      mode: 'private',
      name: 'client',
      params: { id: 'abc' }
    })
    expect(matchRoute('#/client/abc/progress')).toEqual({
      mode: 'private',
      name: 'progress',
      params: { id: 'abc' }
    })
    expect(matchRoute('#/session/s1')).toEqual({
      mode: 'private',
      name: 'session',
      params: { id: 's1' }
    })
    expect(matchRoute('#/session/s1/note')).toEqual({
      mode: 'private',
      name: 'note',
      params: { id: 's1' }
    })
    expect(matchRoute('#/group/grp1')).toEqual({
      mode: 'private',
      name: 'group',
      params: { groupId: 'grp1' }
    })
    expect(matchRoute('#/settings')).toEqual({ mode: 'private', name: 'settings', params: {} })
  })

  it('resolves demo-prefixed application and guide routes', () => {
    expect(matchRoute('#/demo')).toEqual({ mode: 'demo', name: 'demo-entry', params: {} })
    expect(matchRoute('#/demo/guide/4')).toEqual({
      mode: 'demo',
      name: 'guide',
      params: { step: '4' }
    })
    expect(matchRoute('#/demo/clients')).toEqual({ mode: 'demo', name: 'clients', params: {} })
    expect(matchRoute('#/demo/client/a%20b')).toEqual({
      mode: 'demo',
      name: 'client',
      params: { id: 'a b' }
    })
    expect(matchRoute('#/demo/session/s1/note')).toEqual({
      mode: 'demo',
      name: 'note',
      params: { id: 's1' }
    })
    expect(matchRoute('#/demo/help')).toEqual({ mode: 'demo', name: 'help', params: {} })
    expect(matchRoute('#/demo/settings').name).toBe('notfound')
  })

  it('builds mode-aware links without hidden state', () => {
    expect(hrefFor('client/abc', 'private')).toBe('#/client/abc')
    expect(hrefFor('client/abc', 'demo')).toBe('#/demo/client/abc')
    expect(hrefFor('create', 'public')).toBe('#/create')
    expect(hrefFor('', 'demo')).toBe('#/demo/')
  })

  it('unknown paths fall through safely in their requested mode', () => {
    expect(matchRoute('#/nope')).toEqual({ mode: 'public', name: 'notfound', params: {} })
    expect(matchRoute('#/demo/nope')).toEqual({ mode: 'demo', name: 'notfound', params: {} })
    expect(matchRoute('#/client/%E0%A4%A')).toEqual({ mode: 'public', name: 'notfound', params: {} })
    expect(matchRoute('#/demo/session/%')).toEqual({ mode: 'demo', name: 'notfound', params: {} })
  })
})
