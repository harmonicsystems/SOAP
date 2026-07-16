import { describe, it, expect } from 'vitest'
import {
  buildStatsMap,
  filterClients,
  sortClients,
  groupClients,
  primaryDomain,
  resolveCaseloadTag,
  visibleCaseloadTags,
  WEEKDAYS
} from '../src/lib/caseload.js'

const client = (id, code, extra = {}) => ({ id, code, archived: false, ...extra })
const goal = (clientId, domain, status = 'active', extra = {}) => ({
  id: `g-${clientId}-${domain}-${Math.abs(hash(`${clientId}${domain}${status}${JSON.stringify(extra)}`))}`,
  clientId,
  domain,
  status,
  ...extra
})
function hash(s) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}
const session = (clientId, date, goalData = []) => ({
  id: `s-${clientId}-${date}`,
  clientId,
  date,
  createdAt: 0,
  goalData
})

const TAGS = [
  { id: 'ctag-gr3', label: 'Gr 3', archived: false },
  { id: 'ctag-rm12', label: 'Rm 12', archived: false },
  { id: 'ctag-old', label: 'Old room', archived: true }
]

describe('caseload tag helpers', () => {
  it('resolves archived tags but only offers active ones', () => {
    expect(resolveCaseloadTag('ctag-old', TAGS)?.label).toBe('Old room')
    expect(resolveCaseloadTag('ctag-missing', TAGS)).toBeNull()
    expect(visibleCaseloadTags({ caseloadTags: TAGS }).map((t) => t.id)).toEqual([
      'ctag-gr3',
      'ctag-rm12'
    ])
    expect(visibleCaseloadTags({})).toEqual([])
  })
})

describe('primaryDomain', () => {
  it('picks the most common active-goal domain with DOMAINS-order tie-break', () => {
    expect(
      primaryDomain([
        goal('c1', 'fluency'),
        goal('c1', 'articulation-phonology', 'active', { n: 1 }),
        goal('c1', 'articulation-phonology', 'active', { n: 2 })
      ])
    ).toBe('articulation-phonology')
    // tie between expressive (later in DOMAINS) and receptive (earlier)
    expect(primaryDomain([goal('c1', 'expressive-language'), goal('c1', 'receptive-language')])).toBe(
      'receptive-language'
    )
    expect(primaryDomain([])).toBeNull()
    expect(primaryDomain(undefined)).toBeNull()
  })
})

describe('buildStatsMap', () => {
  const clients = [client('c1', 'AB'), client('c2', 'CD')]
  const goals = [
    goal('c1', 'fluency', 'active', {
      targetCriterion: { accuracyPct: 80, consecutiveSessions: 2, cueLevel: 'minimal' }
    }),
    goal('c1', 'voice', 'met'),
    goal('c2', 'other', 'active')
  ]
  const g1 = goals[0]
  const sessions = [
    session('c1', '2026-01-10', [
      { goalId: g1.id, trials: { correct: 9, total: 10 }, cueLevel: 'minimal' }
    ]),
    session('c1', '2026-01-03', [
      { goalId: g1.id, trials: { correct: 8, total: 10 }, cueLevel: 'minimal' }
    ]),
    session('c2', '2026-02-01')
  ]

  it('computes active count, latest session date, nearing, and primary domain per client', () => {
    const stats = buildStatsMap(clients, goals, sessions)
    expect(stats.get('c1')).toEqual({
      activeCount: 1,
      lastSession: '2026-01-10',
      nearing: 1, // two consecutive sessions ≥80% at minimal cues → met counts as nearing
      primaryDomain: 'fluency'
    })
    expect(stats.get('c2')).toEqual({
      activeCount: 1,
      lastSession: '2026-02-01',
      nearing: 0,
      primaryDomain: 'other'
    })
  })

  it('handles clients with no goals or sessions', () => {
    const stats = buildStatsMap([client('c3', 'EF')], [], [])
    expect(stats.get('c3')).toEqual({
      activeCount: 0,
      lastSession: null,
      nearing: 0,
      primaryDomain: null
    })
  })
})

describe('filterClients', () => {
  const clients = [
    client('c1', 'AB', { tags: ['ctag-gr3', 'ctag-rm12'] }),
    client('c2', 'CD', { tags: ['ctag-gr3'] }),
    client('c3', 'EF', { archived: true, tags: ['ctag-gr3'] }),
    client('c4', 'ABZ', { tags: ['ctag-old'] })
  ]

  it('hides archived clients unless asked, and searches by code', () => {
    expect(filterClients(clients).map((c) => c.id)).toEqual(['c1', 'c2', 'c4'])
    expect(filterClients(clients, { showArchived: true }).map((c) => c.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4'
    ])
    expect(filterClients(clients, { search: '  ab ' }).map((c) => c.id)).toEqual(['c1', 'c4'])
  })

  it('applies AND semantics across selected tags', () => {
    expect(
      filterClients(clients, { tagIds: ['ctag-gr3'], tagDefs: TAGS }).map((c) => c.id)
    ).toEqual(['c1', 'c2'])
    expect(
      filterClients(clients, { tagIds: ['ctag-gr3', 'ctag-rm12'], tagDefs: TAGS }).map((c) => c.id)
    ).toEqual(['c1'])
  })

  it('drops unknown and archived tag ids from the selection (stale selections are no-ops)', () => {
    // 'ctag-old' is archived and 'nope' does not exist — neither may constrain
    expect(
      filterClients(clients, { tagIds: ['nope', 'ctag-old'], tagDefs: TAGS }).map((c) => c.id)
    ).toEqual(['c1', 'c2', 'c4'])
    expect(
      filterClients(clients, { tagIds: ['ctag-gr3', 'nope'], tagDefs: TAGS }).map((c) => c.id)
    ).toEqual(['c1', 'c2'])
  })
})

describe('sortClients', () => {
  const clients = [client('c1', 'ZZ'), client('c2', 'AA'), client('c3', 'MM'), client('c4', 'BB')]
  const stats = new Map([
    ['c1', { lastSession: '2026-01-05' }],
    ['c2', { lastSession: '2026-03-01' }],
    ['c3', { lastSession: null }],
    ['c4', { lastSession: '2026-01-05' }]
  ])

  it('sorts A–Z by default and does not mutate the input', () => {
    const input = [...clients]
    expect(sortClients(clients, 'code', stats).map((c) => c.code)).toEqual([
      'AA',
      'BB',
      'MM',
      'ZZ'
    ])
    expect(clients).toEqual(input)
  })

  it('last-seen puts never-seen first, then oldest, with code tie-break', () => {
    expect(sortClients(clients, 'last-seen', stats).map((c) => c.id)).toEqual([
      'c3', // never seen
      'c4', // 01-05, BB before ZZ
      'c1', // 01-05
      'c2' // 03-01
    ])
  })
})

describe('groupClients', () => {
  const clients = [
    client('c1', 'AB', { tags: ['ctag-gr3', 'ctag-rm12'], serviceDays: [1, 3] }),
    client('c2', 'CD', { tags: ['ctag-rm12'], serviceDays: [3] }),
    client('c3', 'EF', { tags: ['ctag-old'] }),
    client('c4', 'GH', {})
  ]
  const statsById = new Map([
    ['c1', { primaryDomain: 'fluency' }],
    ['c2', { primaryDomain: 'fluency' }],
    ['c3', { primaryDomain: 'voice' }],
    ['c4', { primaryDomain: null }]
  ])

  it("'none' returns one section preserving order", () => {
    const sections = groupClients(clients, 'none', { statsById, tagDefs: TAGS })
    expect(sections).toHaveLength(1)
    expect(sections[0].clients).toEqual(clients)
  })

  it("'tag' sections follow definition order with multi-membership; archived-only clients fall to Untagged", () => {
    const sections = groupClients(clients, 'tag', { statsById, tagDefs: TAGS })
    expect(sections.map((s) => s.label)).toEqual(['Gr 3', 'Rm 12', 'Untagged'])
    expect(sections[0].clients.map((c) => c.id)).toEqual(['c1'])
    expect(sections[1].clients.map((c) => c.id)).toEqual(['c1', 'c2'])
    // c3's only tag is archived (no section) → Untagged, along with untagged c4
    expect(sections[2].clients.map((c) => c.id)).toEqual(['c3', 'c4'])
  })

  it("'domain' uses primary domain, DOMAINS order, no-active-goals bucket last", () => {
    const sections = groupClients(clients, 'domain', { statsById, tagDefs: TAGS })
    expect(sections.map((s) => s.label)).toEqual(['Fluency', 'Voice', 'No active goals'])
    expect(sections[0].clients.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(sections[2].clients.map((c) => c.id)).toEqual(['c4'])
  })

  it("'day' sections run Mon–Fri with multi-membership and Unscheduled last", () => {
    const sections = groupClients(clients, 'day', { statsById, tagDefs: TAGS })
    expect(sections.map((s) => s.label)).toEqual(['Monday', 'Wednesday', 'Unscheduled'])
    expect(sections[0].clients.map((c) => c.id)).toEqual(['c1'])
    expect(sections[1].clients.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(sections[2].clients.map((c) => c.id)).toEqual(['c3', 'c4'])
  })

  it('preserves the incoming (already sorted) order inside each section', () => {
    const reversed = [...clients].reverse()
    const sections = groupClients(reversed, 'day', { statsById, tagDefs: TAGS })
    expect(sections.find((s) => s.label === 'Wednesday').clients.map((c) => c.id)).toEqual([
      'c2',
      'c1'
    ])
  })

  it('drops empty sections entirely', () => {
    const sections = groupClients([clients[3]], 'tag', { statsById, tagDefs: TAGS })
    expect(sections.map((s) => s.key)).toEqual(['untagged'])
  })
})

describe('WEEKDAYS', () => {
  it('covers Monday through Friday with ISO ids', () => {
    expect(WEEKDAYS.map((d) => d.id)).toEqual([1, 2, 3, 4, 5])
  })
})
