// Schedule/calendar logic (round 6): pure date math and planned-vs-actual
// joins for the Schedule screen. Deterministic — all dates are ISO strings
// computed in UTC (matching sampleData.js) so a term renders identically
// everywhere. The planned side comes from Client.serviceDays; the actual side
// from Session.date. No times of day exist anywhere in the data model.
import { WEEKDAYS } from './caseload.js'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function toUTC(iso) {
  return new Date(`${iso}T12:00:00Z`)
}

export function addDaysISO(iso, days) {
  const d = toUTC(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ISO weekday 1=Mon … 7=Sun for an ISO date.
export function weekdayOf(iso) {
  const day = toUTC(iso).getUTCDay()
  return day === 0 ? 7 : day
}

// The Monday of the week containing `iso` (weekend dates map forward is wrong
// for history — they belong to the week they're in, so map back to Monday).
export function mondayOf(iso) {
  return addDaysISO(iso, 1 - weekdayOf(iso))
}

// Mon–Fri ISO dates for the school week starting at `mondayISO`.
export function weekDates(mondayISO) {
  return WEEKDAYS.map((d) => addDaysISO(mondayISO, d.id - 1))
}

// All seven dates of that week — summaries must count weekend-dated work even
// though the layout only draws Mon–Fri columns.
export function fullWeekDates(mondayISO) {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i))
}

// Every ISO date of the month, weekends included, for honest month totals.
export function monthDates(monthISO) {
  const out = []
  for (let d = `${monthISO}-01`; monthOf(d) === monthISO; d = addDaysISO(d, 1)) out.push(d)
  return out
}

// 'YYYY-MM' for an ISO date.
export function monthOf(iso) {
  return iso.slice(0, 7)
}

export function monthLabel(monthISO) {
  const [y, m] = monthISO.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function addMonths(monthISO, delta) {
  const [y, m] = monthISO.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  return `${year}-${String((total % 12) + 1).padStart(2, '0')}`
}

// School-month grid: an array of weeks, each week an array of 5 cells
// {date, inMonth}. Weeks run Mon–Fri; a week appears if any of its weekdays
// falls inside the month.
export function monthGrid(monthISO) {
  const first = `${monthISO}-01`
  const last = addDaysISO(addMonths(monthISO, 1) + '-01', -1)
  const weeks = []
  for (let monday = mondayOf(first); monday <= last; monday = addDaysISO(monday, 7)) {
    const dates = weekDates(monday)
    if (dates.every((d) => monthOf(d) !== monthISO)) continue
    weeks.push(dates.map((date) => ({ date, inMonth: monthOf(date) === monthISO })))
  }
  return weeks
}

// Group sessions by date; within a day keep record-creation order stable.
export function sessionsByDate(sessions) {
  const map = new Map()
  for (const s of [...sessions].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))) {
    const list = map.get(s.date)
    if (list) list.push(s)
    else map.set(s.date, [s])
  }
  return map
}

// Non-archived clients scheduled on an ISO weekday (1–5), by code.
export function plannedFor(clients, weekdayId) {
  return clients
    .filter((c) => !c.archived && (c.serviceDays ?? []).includes(weekdayId))
    .sort((a, b) => a.code.localeCompare(b.code))
}

// One weekday cell of the planned-vs-actual week view:
//  planned — every scheduled client with their session for that date (or null)
//  extra   — every OTHER session that date (unscheduled clients' makeups, AND
//            a scheduled client's surplus same-day sessions), which must never
//            disappear from the calendar. Claiming is by session id so a
//            second same-day record still surfaces as an extra row.
export function dayPlan(date, clients, byDate) {
  const daySessions = byDate.get(date) ?? []
  const claimed = new Set()
  const planned = plannedFor(clients, weekdayOf(date)).map((client) => {
    const session =
      daySessions.find((s) => s.clientId === client.id && !claimed.has(s.id)) ?? null
    if (session) claimed.add(session.id)
    return { client, session }
  })
  const extra = daySessions.filter((s) => !claimed.has(s.id))
  return { date, planned, extra }
}

// Documented/draft counts across a set of dates — the accountability summary.
export function rangeSummary(dates, byDate) {
  let total = 0
  let drafts = 0
  for (const date of dates) {
    for (const s of byDate.get(date) ?? []) {
      total++
      if (s.status === 'draft') drafts++
    }
  }
  return { total, drafts }
}

// Sessions whose dates fall outside the Mon–Fri grid of a month (rare —
// manually dated weekend work must still be discoverable, not silently
// hidden by the 5-column layout).
export function weekendSessions(monthISO, sessions) {
  return sessions.filter((s) => monthOf(s.date) === monthISO && weekdayOf(s.date) > 5)
}

// The most recent session date, or null. Used to anchor the demo calendar
// inside its fictional term instead of an empty "today".
export function latestSessionDate(sessions) {
  let latest = null
  for (const s of sessions) {
    if (s.date && (!latest || s.date > latest)) latest = s.date
  }
  return latest
}
