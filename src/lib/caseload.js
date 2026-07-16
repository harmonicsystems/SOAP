// Caseload legibility (round 5): pure filter/sort/group logic for the caseload
// screen, plus the clinician-defined caseload tag helpers. Tags are labels the
// clinician manages in Settings (grade, room, site, service pattern) and are
// archived, never deleted, so old records keep rendering their badges.
// serviceDays uses ISO weekday numbers (1=Mon … 5=Fri) — the structured
// foundation for schedule views; free-text tags can't be parsed into one.
import { goalCriterionStatus } from './progress.js'
import { DOMAINS } from './constants.js'

export const WEEKDAYS = [
  { id: 1, label: 'Monday', short: 'Mon' },
  { id: 2, label: 'Tuesday', short: 'Tue' },
  { id: 3, label: 'Wednesday', short: 'Wed' },
  { id: 4, label: 'Thursday', short: 'Thu' },
  { id: 5, label: 'Friday', short: 'Fri' }
]

// Resolves archived tags too — a retired tag must keep labelling old records.
export function resolveCaseloadTag(id, defs = []) {
  return defs.find((t) => t.id === id) ?? null
}

// Tags offered as filter chips / editable choices: active definitions only.
export function visibleCaseloadTags(settings) {
  return (settings?.caseloadTags ?? []).filter((t) => !t.archived)
}

// Most common domain among the active goals; ties break in DOMAINS order so
// the result is deterministic. Null when there are no active goals.
export function primaryDomain(activeGoals) {
  if (!activeGoals?.length) return null
  const counts = new Map()
  for (const g of activeGoals) counts.set(g.domain, (counts.get(g.domain) ?? 0) + 1)
  const max = Math.max(...counts.values())
  return DOMAINS.find((d) => counts.get(d.id) === max)?.id ?? null
}

// One pass over goals and sessions → per-client stats for rows, sorting, and
// grouping. Replaces the per-row recompute that scanned every goal and session
// once per rendered client.
export function buildStatsMap(clients, goals, sessions) {
  const goalsByClient = new Map()
  for (const g of goals) {
    const list = goalsByClient.get(g.clientId)
    if (list) list.push(g)
    else goalsByClient.set(g.clientId, [g])
  }
  const sessionsByClient = new Map()
  for (const s of sessions) {
    const list = sessionsByClient.get(s.clientId)
    if (list) list.push(s)
    else sessionsByClient.set(s.clientId, [s])
  }
  const map = new Map()
  for (const c of clients) {
    const active = (goalsByClient.get(c.id) ?? []).filter((g) => g.status === 'active')
    const clientSessions = sessionsByClient.get(c.id) ?? []
    let lastSession = null
    for (const s of clientSessions) {
      if (s.date && (!lastSession || s.date > lastSession)) lastSession = s.date
    }
    const nearing = active.filter((g) => {
      const st = goalCriterionStatus(g, clientSessions)
      return st.nearing || st.met
    }).length
    map.set(c.id, {
      activeCount: active.length,
      lastSession,
      nearing,
      primaryDomain: primaryDomain(active)
    })
  }
  return map
}

// Search on code + AND across selected tags + archived visibility. Selected
// tag ids that are unknown or archived are dropped before filtering, so a
// stale selection (tag archived meanwhile, or carried across a demo/private
// mode switch) never silently blanks the list.
export function filterClients(clients, { search = '', tagIds = [], showArchived = false, tagDefs = [] } = {}) {
  const q = search.trim().toLowerCase()
  const known = new Set(tagDefs.filter((t) => !t.archived).map((t) => t.id))
  const applied = tagIds.filter((id) => known.has(id))
  return clients.filter((c) => {
    if (!showArchived && c.archived) return false
    if (q && !c.code.toLowerCase().includes(q)) return false
    return applied.every((id) => (c.tags ?? []).includes(id))
  })
}

// 'code' = A–Z (the long-standing default). 'last-seen' answers “who am I
// overdue to see?”: never-seen clients first, then oldest last session first;
// ties break by code so the order is stable. Returns a new array.
export function sortClients(clients, key, statsById) {
  const byCode = (a, b) => a.code.localeCompare(b.code)
  const sorted = [...clients]
  if (key !== 'last-seen') return sorted.sort(byCode)
  return sorted.sort((a, b) => {
    const la = statsById?.get(a.id)?.lastSession ?? null
    const lb = statsById?.get(b.id)?.lastSession ?? null
    if (la === null && lb === null) return byCode(a, b)
    if (la === null) return -1
    if (lb === null) return 1
    return la < lb ? -1 : la > lb ? 1 : byCode(a, b)
  })
}

// Partition an already filtered+sorted list into titled sections, preserving
// input order within each section (so the active sort applies inside groups).
// Multi-membership is intentional for tags and days — “who is in Rm 12” and
// “who do I see Tuesday” both want the full roster. Domain uses the client's
// primary domain (single membership) so the caseload reads once per student.
// Catch-all buckets (“Untagged”, “No active goals”, “Unscheduled”) come last.
export function groupClients(clients, dimension, { statsById, tagDefs = [] } = {}) {
  if (dimension === 'tag') {
    const active = tagDefs.filter((t) => !t.archived)
    const activeIds = new Set(active.map((t) => t.id))
    const sections = active.map((t) => ({
      key: t.id,
      label: t.label,
      clients: clients.filter((c) => (c.tags ?? []).includes(t.id))
    }))
    sections.push({
      key: 'untagged',
      label: 'Untagged',
      clients: clients.filter((c) => !(c.tags ?? []).some((id) => activeIds.has(id)))
    })
    return sections.filter((s) => s.clients.length)
  }
  if (dimension === 'domain') {
    const sections = DOMAINS.map((d) => ({
      key: d.id,
      label: d.label,
      clients: clients.filter((c) => statsById?.get(c.id)?.primaryDomain === d.id)
    }))
    sections.push({
      key: 'no-active-goals',
      label: 'No active goals',
      clients: clients.filter((c) => !statsById?.get(c.id)?.primaryDomain)
    })
    return sections.filter((s) => s.clients.length)
  }
  if (dimension === 'day') {
    const sections = WEEKDAYS.map((d) => ({
      key: `day-${d.id}`,
      label: d.label,
      clients: clients.filter((c) => (c.serviceDays ?? []).includes(d.id))
    }))
    sections.push({
      key: 'unscheduled',
      label: 'Unscheduled',
      clients: clients.filter((c) => !(c.serviceDays ?? []).some((n) => n >= 1 && n <= 5))
    })
    return sections.filter((s) => s.clients.length)
  }
  return [{ key: 'all', label: '', clients }]
}
