import { describe, it, expect } from 'vitest'
import {
  buildSampleDataset,
  isSampleRecord,
  SAMPLE_CLIENT_IDS,
  SAMPLE_DATASET_ID,
  DEMO_DATASET_SUMMARY,
  DEMO_GUIDE_TARGETS,
  DEMO_CASELOAD_TAGS,
  winterTerm
} from '../src/lib/sampleData.js'
import {
  CUE_LEVELS,
  CUE_TYPES,
  DOMAINS,
  SESSION_SETTINGS,
  observationTag
} from '../src/lib/constants.js'
import { generateO } from '../src/lib/ogen.js'
import { assembleNote } from '../src/lib/note.js'
import { goalCriterionStatus, goalPoints } from '../src/lib/progress.js'

const anchorDate = '2026-07-15'

function windowMean(points, side) {
  const values = (side === 'first' ? points.slice(0, 3) : points.slice(-3)).map((point) => point.pct)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function deltaFor(goal, sessions) {
  const points = goalPoints(goal.id, sessions)
  return windowMean(points, 'last') - windowMean(points, 'first')
}

describe('fictional January–April public-demo dataset', () => {
  it('is deterministic for an anchor and chooses the most recently completed winter term', () => {
    const first = buildSampleDataset({ anchorDate })
    expect(buildSampleDataset({ anchorDate })).toEqual(first)
    expect(winterTerm(anchorDate)).toEqual({ year: 2026, start: '2026-01-05', end: '2026-04-03' })
    expect(winterTerm('2026-02-01')).toEqual({ year: 2025, start: '2025-01-06', end: '2025-04-04' })
    expect(() => buildSampleDataset({})).toThrow('anchor date')
    expect(() => buildSampleDataset({ anchorDate: '07/15/2026' })).toThrow('anchor date')
  })

  it('has the approved lean caseload counts and letter-only codes', () => {
    const data = buildSampleDataset({ anchorDate })
    expect(DEMO_DATASET_SUMMARY).toEqual({ clients: 25, goals: 35, sessions: 268, groups: 7, meetings: 110 })
    expect(data.clients).toHaveLength(25)
    expect(data.goals).toHaveLength(35)
    expect(data.sessions).toHaveLength(268)
    expect(new Set(data.clients.map((client) => client.code)).size).toBe(25)
    expect(data.clients.every((client) => /^[A-Z]{2,3}$/.test(client.code))).toBe(true)

    const records = [...data.clients, ...data.goals, ...data.sessions]
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length)
    expect(records.every((record) => isSampleRecord(record))).toBe(true)
    expect(records.every((record) => record.sampleDataset === SAMPLE_DATASET_ID)).toBe(true)
  })

  it('gives every client resolvable caseload tags and a service day matching its session history', () => {
    const data = buildSampleDataset({ anchorDate })
    const tagIds = new Set(DEMO_CASELOAD_TAGS.map((t) => t.id))
    expect(DEMO_CASELOAD_TAGS.every((t) => t.archived === false)).toBe(true)
    // fictional labels only: a grade spread and two neutral room labels
    expect(DEMO_CASELOAD_TAGS.map((t) => t.label)).toEqual([
      'Gr K', 'Gr 1', 'Gr 2', 'Gr 3', 'Gr 4', 'Gr 5', 'Rm 4', 'Rm 9'
    ])
    for (const client of data.clients) {
      expect(client.tags.length).toBeGreaterThanOrEqual(1)
      expect(client.tags.every((id) => tagIds.has(id))).toBe(true)
      // exactly one weekly service day, and it matches every session's weekday
      expect(client.serviceDays).toHaveLength(1)
      const day = client.serviceDays[0]
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(5)
      const sessions = data.sessions.filter((s) => s.clientId === client.id)
      for (const s of sessions) {
        const weekday = new Date(`${s.date}T12:00:00Z`).getUTCDay()
        expect(weekday).toBe(day)
      }
    }
    // every grade tag and both rooms are actually used, so grouping by tag
    // shows a full spread in the demo
    const used = new Set(data.clients.flatMap((c) => c.tags))
    expect([...tagIds].every((id) => used.has(id))).toBe(true)
  })

  it('covers the full January–April term with varied 10–12-session schedules', () => {
    const data = buildSampleDataset({ anchorDate })
    const dates = data.sessions.map((session) => session.date).sort()
    expect(dates[0]).toBe('2026-01-05')
    expect(dates.at(-1)).toBe('2026-04-03')
    expect(data.sessions.every((session) => session.date >= '2026-01-05' && session.date <= '2026-04-03')).toBe(true)
    for (const client of data.clients) {
      const sessions = data.sessions.filter((session) => session.clientId === client.id)
      expect(sessions.length).toBeGreaterThanOrEqual(10)
      expect(sessions.length).toBeLessThanOrEqual(12)
      expect(sessions.map((session) => session.date)).toEqual(
        sessions.map((session) => session.date).sort()
      )
    }
    expect(new Set(data.clients.map((client) => data.sessions.filter((session) => session.clientId === client.id).length)).size).toBeGreaterThan(1)
    expect(new Set(data.sessions.map((session) => session.durationMin)).size).toBeGreaterThan(2)
    expect(new Set(data.goals.map((goal) => JSON.stringify(goal.targetCriterion))).size).toBeGreaterThan(1)
    expect(data.sessions.filter((session) => session.status === 'draft')).toHaveLength(3)
  })

  it('uses valid references, enums, trials, and built-in observations', () => {
    const data = buildSampleDataset({ anchorDate })
    const clients = new Map(data.clients.map((client) => [client.id, client]))
    const goals = new Map(data.goals.map((goal) => [goal.id, goal]))
    const domains = new Set(DOMAINS.map((domain) => domain.id))

    for (const goal of data.goals) {
      expect(clients.has(goal.clientId)).toBe(true)
      expect(domains.has(goal.domain)).toBe(true)
      expect(CUE_LEVELS).toContain(goal.targetCriterion.cueLevel)
      expect(['active', 'met', 'discontinued']).toContain(goal.status)
    }
    for (const session of data.sessions) {
      expect(clients.has(session.clientId)).toBe(true)
      expect(SESSION_SETTINGS).toContain(session.setting)
      const opportunityDomain = ['social-pragmatic', 'fluency', 'voice', 'other'].includes(
        goals.get(session.goalData[0]?.goalId)?.domain
      )
      for (const gd of session.goalData) {
        expect(goals.get(gd.goalId)?.clientId).toBe(session.clientId)
        expect(CUE_LEVELS).toContain(gd.cueLevel)
        expect(gd.cueTypes.every((cue) => CUE_TYPES.includes(cue))).toBe(true)
        expect(gd.observations.every((id) => observationTag(id))).toBe(true)
        if (gd.observations.includes('model')) expect(gd.cueTypes).toContain('model')
        // support-implying observations never contradict the cue data
        if (gd.cueLevel === 'independent') expect(gd.observations).toEqual([])
        if (gd.observations.includes('visual')) expect(gd.cueTypes).toContain('visual')
        expect(Number.isInteger(gd.trials.correct)).toBe(true)
        expect(Number.isInteger(gd.trials.total)).toBe(true)
        // opportunity-based behaviors are scored per natural opportunity —
        // far fewer per session than drilled articulation/language trials
        expect(gd.trials.total).toBeGreaterThanOrEqual(opportunityDomain ? 8 : 15)
        expect(gd.trials.total).toBeLessThanOrEqual(opportunityDomain ? 12 : 22)
        expect(gd.trials.correct).toBeGreaterThanOrEqual(0)
        expect(gd.trials.correct).toBeLessThanOrEqual(gd.trials.total)
      }
      if (/\bmodel\b/i.test(session.standout)) {
        expect(session.goalData.some((gd) => gd.cueTypes.includes('model'))).toBe(true)
      }
    }
  })

  it('creates 74 valid linked group meetings and 36 individual meetings', () => {
    const data = buildSampleDataset({ anchorDate })
    const groups = new Map()
    for (const session of data.sessions.filter((record) => record.groupId)) {
      const members = groups.get(session.groupId) ?? []
      members.push(session)
      groups.set(session.groupId, members)
    }
    expect(groups.size).toBe(74)
    for (const members of groups.values()) {
      expect(members.length).toBeGreaterThanOrEqual(2)
      expect(members.length).toBeLessThanOrEqual(4)
      expect(new Set(members.map((member) => member.date)).size).toBe(1)
      expect(new Set(members.map((member) => member.durationMin)).size).toBe(1)
      expect(members.every((member) => member.setting === 'group')).toBe(true)
      expect(new Set(members.map((member) => member.soap.O)).size).toBe(members.length)
    }
    expect(data.sessions.filter((session) => !session.groupId)).toHaveLength(36)
    expect(data.sessions.filter((session) => !session.groupId).every((session) => session.setting === 'individual')).toBe(true)
  })

  it('generates every O section through production logic and cleanly assembles every note', () => {
    const data = buildSampleDataset({ anchorDate })
    const clients = new Map(data.clients.map((client) => [client.id, client]))
    for (const session of data.sessions) {
      const client = clients.get(session.clientId)
      const goals = data.goals.filter((goal) => goal.clientId === client.id)
      expect(session.soap.O).toBe(
        generateO(client.code, goals, session.goalData, session.observations, session.standout)
      )
      expect(assembleNote(client, session)).not.toMatch(/\b(?:null|undefined)\b/)
      expect(session.soap.O).not.toMatch(
        /\bproduced (?:answer|enter|explain|follow|identify|maintain|make|request|retell|share|use)\b/i
      )
    }
  })

  it('locks the realistic outcome distribution, including plateaus and lower recent performance', () => {
    const data = buildSampleDataset({ anchorDate })
    const counts = data.clients.reduce((groups, client) => {
      groups[client.demoOutcome] = [...(groups[client.demoOutcome] ?? []), client]
      return groups
    }, {})
    expect(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length]))).toEqual({
      clear: 5,
      'cue-dependent': 2,
      mixed: 4,
      'lower-recent': 3,
      modest: 6,
      plateau: 5
    })

    for (const client of counts.plateau) {
      const goal = data.goals.find((record) => record.clientId === client.id)
      const sessions = data.sessions.filter((session) => session.clientId === client.id)
      expect(Math.abs(deltaFor(goal, sessions))).toBeLessThanOrEqual(5)
    }
    for (const client of counts['lower-recent']) {
      const goal = data.goals.find((record) => record.clientId === client.id)
      const sessions = data.sessions.filter((session) => session.clientId === client.id)
      expect(deltaFor(goal, sessions)).toBeLessThanOrEqual(-5)
    }

    for (const client of counts.mixed) {
      const clientGoals = data.goals.filter((goal) => goal.clientId === client.id)
      const clientSessions = data.sessions.filter((session) => session.clientId === client.id)
      const deltas = clientGoals.map((goal) => deltaFor(goal, clientSessions))
      expect(clientGoals).toHaveLength(2)
      expect(Math.max(...deltas) - Math.min(...deltas)).toBeGreaterThanOrEqual(4)
    }
  })

  it('keeps accuracy-before-cues stories below their cue-aware criteria', () => {
    const data = buildSampleDataset({ anchorDate })
    for (const code of ['BEX', 'NIX']) {
      const clientId = SAMPLE_CLIENT_IDS[code.toLowerCase()]
      const goal = data.goals.find((record) => record.clientId === clientId)
      const sessions = data.sessions.filter((session) => session.clientId === clientId)
      const points = goalPoints(goal.id, sessions)
      expect(windowMean(points, 'last') - windowMean(points, 'first')).toBeGreaterThan(20)
      expect(points.slice(-3).every((point) => point.cueLevel === 'moderate')).toBe(true)
      expect(goalCriterionStatus(goal, sessions).met).toBe(false)
    }
  })

  it('has only a minority of met goals and preserves discontinued/reframed histories', () => {
    const data = buildSampleDataset({ anchorDate })
    expect(data.goals.filter((goal) => goal.status === 'met')).toHaveLength(5)
    expect(data.goals.filter((goal) => goal.status === 'discontinued')).toHaveLength(2)
    expect(data.goals.filter((goal) => goal.status === 'active')).toHaveLength(28)
    const criterionMet = data.goals.filter((goal) => {
      const sessions = data.sessions.filter((session) => session.clientId === goal.clientId)
      return goalCriterionStatus(goal, sessions).met
    })
    expect(criterionMet).toHaveLength(5)
  })

  it('matches the approved per-student goal matrix and locks its hero stories', () => {
    const data = buildSampleDataset({ anchorDate })
    const goalCounts = Object.fromEntries(
      data.clients.map((client) => [
        client.code,
        data.goals.filter((goal) => goal.clientId === client.id).length
      ])
    )
    expect(goalCounts).toEqual({
      AV: 2, BEX: 1, CY: 2, DOR: 1, ELM: 2, FEN: 1, GRA: 2, HUX: 1,
      IVQ: 2, JET: 1, KAL: 1, LUM: 2, MEP: 1, NIX: 1, ORQ: 2, PAV: 1,
      QET: 1, RUS: 2, SIV: 1, TOL: 1, UMB: 2, VEK: 1, WIR: 1, XAN: 1, ZEP: 2
    })

    const clientFor = (code) => data.clients.find((client) => client.code === code)
    const sessionsFor = (code) => data.sessions.filter((session) => session.clientId === clientFor(code).id)
    const goalsFor = (code) => data.goals.filter((goal) => goal.clientId === clientFor(code).id)

    const graSessions = sessionsFor('GRA')
    const graRepair = goalsFor('GRA')[1]
    const graObs = graSessions.map((session) => session.goalData.find((gd) => gd.goalId === graRepair.id)?.observations ?? [])
    expect(graObs.slice(-5).filter((tags) => tags.includes('self-correct')).length)
      .toBeGreaterThan(graObs.slice(0, 5).filter((tags) => tags.includes('self-correct')).length)

    expect(sessionsFor('KAL').every((session) => session.goalData[0].cueLevel === 'moderate')).toBe(true)
    const umbSessions = sessionsFor('UMB')
    expect(goalCriterionStatus(goalsFor('UMB')[0], umbSessions).nearing).toBe(true)
    expect(goalCriterionStatus(goalsFor('UMB')[1], umbSessions).nearing).toBe(false)
    const vekPoints = goalPoints(goalsFor('VEK')[0].id, sessionsFor('VEK'))
    expect(vekPoints.slice(-3).every((point) => point.cueLevel === 'independent')).toBe(true)
    expect(vekPoints.slice(0, 3).every((point) => point.cueLevel === 'moderate')).toBe(true)
    expect(sessionsFor('ZEP').map((session) => session.standout).join(' ')).toMatch(/picture.*gesture.*spoken/s)
  })

  it('keeps generated A/P language consistent with the current goal data and phase', () => {
    const data = buildSampleDataset({ anchorDate })
    for (const session of data.sessions.filter((record) => record.goalData.length === 1)) {
      expect(`${session.soap.A} ${session.soap.P}`).not.toMatch(/\b(?:two|both|each)\b/i)
    }
    for (const code of ['AV', 'HUX', 'QET', 'SIV', 'TOL']) {
      const client = data.clients.find((record) => record.code === code)
      const early = data.sessions.filter((session) => session.clientId === client.id).slice(0, 3)
      expect(early.map((session) => session.soap.P).join(' ')).not.toMatch(/maintenance/i)
    }
  })

  it('provides stable, valid records for every guide step', () => {
    const data = buildSampleDataset({ anchorDate })
    expect(data.clients.some((client) => client.id === DEMO_GUIDE_TARGETS.clientId)).toBe(true)
    expect(data.clients.some((client) => client.id === DEMO_GUIDE_TARGETS.progressClientId)).toBe(true)
    expect(data.sessions.find((session) => session.id === DEMO_GUIDE_TARGETS.draftSessionId)?.status).toBe('draft')
    expect(data.sessions.find((session) => session.id === DEMO_GUIDE_TARGETS.noteSessionId)?.status).toBe('final')
    expect(data.sessions.filter((session) => session.groupId === DEMO_GUIDE_TARGETS.groupId)).toHaveLength(4)
  })

  it('locks the content-review contract: honest claims, no meta-language, varied specifics', () => {
    const data = buildSampleDataset({ anchorDate })
    const goals = new Map(data.goals.map((goal) => [goal.id, goal]))

    for (const session of data.sessions) {
      // goal labels never collide with the "with N% accuracy" O frame
      expect(session.soap.O).not.toMatch(/\bproduced accurate\b/i)
      // a "met the criteria" claim only appears when every measured goal met
      if (/met (?:the|its) stated/i.test(session.soap.A)) {
        const scoped = /remain(?:ed|s) below criterion/i.test(session.soap.A)
        if (!scoped) {
          expect(
            session.goalData.every((gd) => goals.get(gd.goalId)?.status === 'met')
          ).toBe(true)
        }
      }
      // the content rulebook never leaks into the clinical text
      expect(`${session.soap.A} ${session.soap.P}`).not.toMatch(
        /without attributing|no cause was inferred|clinician judgment/i
      )
    }

    // first sessions never assert trends or cross-session comparisons
    for (const client of data.clients) {
      const first = data.sessions.find((session) => session.clientId === client.id)
      expect(first.soap.A).not.toMatch(/\b(?:increased|improved|earlier|other early|lower than)\b/i)
      // standouts vary across the term — the "specific moment" is never
      // stamped identically on every visit
      const standouts = new Set(
        data.sessions.filter((s) => s.clientId === client.id).map((s) => s.standout)
      )
      expect(standouts.size).toBeGreaterThanOrEqual(3)
    }

    // two-target standout lines only appear beside two measured goals
    for (const session of data.sessions.filter((s) => s.goalData.length === 1)) {
      expect(session.standout).not.toMatch(/\b(?:two|both|one target)\b/i)
    }

    // no baseline inversion: connected-speech goals sit below their
    // structured-word/sentence siblings for the same sound class
    const byCode = (code) =>
      data.goals.filter((g) => g.clientId === SAMPLE_CLIENT_IDS[code.toLowerCase()])
    for (const code of ['ELM', 'AV']) {
      const [structured, connected] = byCode(code)
      const pct = (goal) => Number(goal.baseline.match(/^(\d+)/)[1])
      expect(pct(connected)).toBeLessThan(pct(structured))
    }

    // opportunity-based goal text uses the opportunities convention
    for (const goal of data.goals) {
      const client = data.clients.find((c) => c.id === goal.clientId)
      const opportunity = ['social-pragmatic', 'fluency', 'voice', 'other'].includes(goal.domain)
      expect(goal.text.includes('% of observed opportunities')).toBe(opportunity)
      void client
    }
  })

  it('contains no identifying fields or blame/causation language', () => {
    const data = buildSampleDataset({ anchorDate })
    const forbiddenKeys = new Set(['name', 'fullName', 'dob', 'birthDate', 'school', 'teacher', 'diagnosis'])
    function inspect(value) {
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        expect(forbiddenKeys.has(key)).toBe(false)
        inspect(child)
      }
    }
    inspect(data)
    const fixtureText = JSON.stringify(data)
    expect(fixtureText).not.toMatch(/therapy failed|failed to progress|noncompliant|poor motivation/i)
    expect(fixtureText).not.toMatch(/\b(?:school|teacher|grade|diagnosis|birthdate|address)\b/i)
    const assessmentAndPlans = data.sessions.flatMap((session) => [session.soap.A, session.soap.P])
    expect(assessmentAndPlans.join(' ')).not.toMatch(
      /\b(?:because|caused|diagnosis|prognosis|normal|expected outcome|will improve)\b/i
    )
  })
})
