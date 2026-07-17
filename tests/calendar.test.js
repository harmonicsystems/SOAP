import { describe, it, expect } from 'vitest'
import {
  addDaysISO,
  weekdayOf,
  mondayOf,
  weekDates,
  fullWeekDates,
  monthOf,
  monthLabel,
  monthDates,
  addMonths,
  monthGrid,
  sessionsByDate,
  plannedFor,
  dayPlan,
  rangeSummary,
  weekendSessions,
  latestSessionDate
} from '../src/lib/calendar.js'

const session = (clientId, date, status = 'final', createdAt = 0) => ({
  id: `s-${clientId}-${date}-${createdAt}`,
  clientId,
  date,
  status,
  createdAt
})

describe('calendar date math', () => {
  it('computes weekdays and Mondays across week and month boundaries', () => {
    expect(weekdayOf('2026-07-13')).toBe(1) // a Monday
    expect(weekdayOf('2026-07-17')).toBe(5) // Friday
    expect(weekdayOf('2026-07-19')).toBe(7) // Sunday
    expect(mondayOf('2026-07-16')).toBe('2026-07-13')
    expect(mondayOf('2026-07-13')).toBe('2026-07-13')
    // weekend dates belong to the week they are in (map back, not forward)
    expect(mondayOf('2026-07-18')).toBe('2026-07-13')
    expect(mondayOf('2026-07-19')).toBe('2026-07-13')
    // month boundary
    expect(mondayOf('2026-08-01')).toBe('2026-07-27')
  })

  it('produces Mon–Fri week dates', () => {
    expect(weekDates('2026-07-13')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17'
    ])
  })

  it('labels and increments months, including year rollover', () => {
    expect(monthOf('2026-07-16')).toBe('2026-07')
    expect(monthLabel('2026-07')).toBe('July 2026')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-07', 0)).toBe('2026-07')
  })

  it('builds a Mon–Fri month grid whose weeks all touch the month', () => {
    const grid = monthGrid('2026-07') // July 2026: Jul 1 is a Wednesday
    expect(grid[0].map((c) => c.date)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03'
    ])
    expect(grid[0].map((c) => c.inMonth)).toEqual([false, false, true, true, true])
    expect(grid.at(-1).map((c) => c.date)).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31'
    ])
    expect(grid).toHaveLength(5)
    // every week contains at least one in-month weekday
    expect(grid.every((week) => week.some((c) => c.inMonth))).toBe(true)
    // a month whose final week is weekend-only (August 2026 ends Monday Aug 31)
    const aug = monthGrid('2026-08')
    expect(aug.at(-1)[0].date).toBe('2026-08-31')
  })
})

describe('planned-vs-actual joins', () => {
  const clients = [
    { id: 'c1', code: 'AB', archived: false, serviceDays: [1, 3] },
    { id: 'c2', code: 'CD', archived: false, serviceDays: [3] },
    { id: 'c3', code: 'EF', archived: true, serviceDays: [3] },
    { id: 'c4', code: 'GH', archived: false, serviceDays: [] }
  ]

  it('plannedFor filters by weekday, drops archived, sorts by code', () => {
    expect(plannedFor(clients, 3).map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(plannedFor(clients, 5)).toEqual([])
  })

  it('sessionsByDate groups by date in creation order', () => {
    const byDate = sessionsByDate([
      session('c2', '2026-07-15', 'final', 5),
      session('c1', '2026-07-15', 'draft', 2),
      session('c1', '2026-07-13', 'final', 1)
    ])
    expect(byDate.get('2026-07-15').map((s) => s.clientId)).toEqual(['c1', 'c2'])
    expect(byDate.get('2026-07-13')).toHaveLength(1)
  })

  it('dayPlan surfaces a scheduled client\'s surplus same-day sessions as extras', () => {
    // the review-panel repro: a Wednesday-scheduled client with a group
    // session AND a same-day makeup draft — the second must never vanish
    const byDate = sessionsByDate([
      session('c1', '2026-07-15', 'final', 1),
      session('c1', '2026-07-15', 'draft', 2)
    ])
    const plan = dayPlan('2026-07-15', clients, byDate)
    expect(plan.planned.find((p) => p.client.id === 'c1').session.status).toBe('final')
    expect(plan.extra.map((s) => s.status)).toEqual(['draft'])
    // header count and rendered rows agree: 2 sessions, 2 rows
    const rendered = plan.planned.filter((p) => p.session).length + plan.extra.length
    expect(rangeSummary(['2026-07-15'], byDate).total).toBe(rendered)
  })

  it('full-range date helpers include weekends so summaries never undercount', () => {
    expect(fullWeekDates('2026-07-13')).toHaveLength(7)
    expect(fullWeekDates('2026-07-13').slice(5)).toEqual(['2026-07-18', '2026-07-19'])
    expect(monthDates('2026-07')).toHaveLength(31)
    expect(monthDates('2026-02')).toHaveLength(28)
    // a Saturday session counts in the week and month totals
    const byDate = sessionsByDate([session('c1', '2026-07-18', 'final')])
    expect(rangeSummary(fullWeekDates('2026-07-13'), byDate).total).toBe(1)
    expect(rangeSummary(monthDates('2026-07'), byDate).total).toBe(1)
  })

  it('dayPlan pairs scheduled clients with their sessions and surfaces unscheduled extras', () => {
    const byDate = sessionsByDate([
      session('c1', '2026-07-15', 'draft'), // scheduled Wednesday, documented
      session('c4', '2026-07-15', 'final') // NOT scheduled Wednesday — makeup
    ])
    const plan = dayPlan('2026-07-15', clients, byDate) // a Wednesday
    expect(plan.planned.map((p) => p.client.id)).toEqual(['c1', 'c2'])
    expect(plan.planned[0].session.status).toBe('draft')
    expect(plan.planned[1].session).toBeNull() // scheduled but undocumented
    expect(plan.extra.map((s) => s.clientId)).toEqual(['c4'])
  })

  it('rangeSummary counts sessions and drafts across dates', () => {
    const byDate = sessionsByDate([
      session('c1', '2026-07-13', 'final'),
      session('c1', '2026-07-15', 'draft'),
      session('c2', '2026-07-15', 'final')
    ])
    expect(rangeSummary(weekDates('2026-07-13'), byDate)).toEqual({ total: 3, drafts: 1 })
    expect(rangeSummary(['2026-07-14'], byDate)).toEqual({ total: 0, drafts: 0 })
  })

  it('finds weekend-dated sessions per month and the latest session date', () => {
    const sessions = [
      session('c1', '2026-07-18', 'final'), // Saturday
      session('c1', '2026-07-15', 'final'),
      session('c2', '2026-06-27', 'final') // Saturday, other month
    ]
    expect(weekendSessions('2026-07', sessions).map((s) => s.date)).toEqual(['2026-07-18'])
    expect(latestSessionDate(sessions)).toBe('2026-07-18')
    expect(latestSessionDate([])).toBeNull()
  })
})
