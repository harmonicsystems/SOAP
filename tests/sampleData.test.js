import { describe, it, expect } from 'vitest'
import {
  buildSampleDataset,
  isSampleRecord,
  SAMPLE_CLIENT_IDS,
  SAMPLE_DATASET_ID,
  sampleDatasetState
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

const anchorDate = '2026-07-14'

function withoutCalendar(dataset) {
  return {
    clients: dataset.clients.map(({ createdAt, ...record }) => record),
    goals: dataset.goals.map(({ createdAt, ...record }) => record),
    sessions: dataset.sessions.map(({ createdAt, date, ...record }) => record)
  }
}

describe('fictional longitudinal sample dataset', () => {
  it('is deterministic for an anchor and shifts only calendar fields for another anchor', () => {
    const first = buildSampleDataset({ anchorDate })
    expect(buildSampleDataset({ anchorDate })).toEqual(first)

    const shifted = buildSampleDataset({ anchorDate: '2026-08-14' })
    expect(withoutCalendar(shifted)).toEqual(withoutCalendar(first))
    expect(shifted.sessions.at(-1).date).not.toBe(first.sessions.at(-1).date)
  })

  it('validates its anchor date', () => {
    expect(() => buildSampleDataset({})).toThrow('anchor date')
    expect(() => buildSampleDataset({ anchorDate: '07/14/2026' })).toThrow('anchor date')
  })

  it('has stable counts, unique IDs, de-identified codes, and complete provenance', () => {
    const data = buildSampleDataset({ anchorDate })
    expect(data.clients).toHaveLength(4)
    expect(data.goals).toHaveLength(6)
    expect(data.sessions).toHaveLength(30)

    const records = [...data.clients, ...data.goals, ...data.sessions]
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length)
    expect(records.every((record) => isSampleRecord(record))).toBe(true)
    expect(records.every((record) => record.sampleDataset === SAMPLE_DATASET_ID)).toBe(true)
    expect(data.clients.every((client) => /^\S{1,5}$/.test(client.code))).toBe(true)
    expect(data.sessions.every((session) => session.date <= anchorDate)).toBe(true)
  })

  it('uses valid references, enums, and built-in observation tags', () => {
    const data = buildSampleDataset({ anchorDate })
    const clients = new Map(data.clients.map((client) => [client.id, client]))
    const goals = new Map(data.goals.map((goal) => [goal.id, goal]))
    const domains = new Set(DOMAINS.map((domain) => domain.id))

    for (const goal of data.goals) {
      expect(clients.has(goal.clientId)).toBe(true)
      expect(domains.has(goal.domain)).toBe(true)
      expect(CUE_LEVELS).toContain(goal.targetCriterion.cueLevel)
    }
    for (const session of data.sessions) {
      expect(clients.has(session.clientId)).toBe(true)
      expect(SESSION_SETTINGS).toContain(session.setting)
      for (const gd of session.goalData) {
        expect(goals.get(gd.goalId)?.clientId).toBe(session.clientId)
        expect(CUE_LEVELS).toContain(gd.cueLevel)
        expect(gd.cueTypes.every((cue) => CUE_TYPES.includes(cue))).toBe(true)
        expect(gd.observations.every((id) => observationTag(id))).toBe(true)
        if (gd.trials) {
          expect(Number.isInteger(gd.trials.correct)).toBe(true)
          expect(Number.isInteger(gd.trials.total)).toBe(true)
          expect(gd.trials.total).toBeGreaterThan(0)
          expect(gd.trials.correct).toBeGreaterThanOrEqual(0)
          expect(gd.trials.correct).toBeLessThanOrEqual(gd.trials.total)
        }
      }
    }
  })

  it('builds valid linked groups with distinct per-client notes', () => {
    const data = buildSampleDataset({ anchorDate })
    const groups = new Map()
    for (const session of data.sessions.filter((record) => record.groupId)) {
      const members = groups.get(session.groupId) ?? []
      members.push(session)
      groups.set(session.groupId, members)
    }
    expect(groups.size).toBe(5)
    for (const members of groups.values()) {
      expect(members.length).toBeGreaterThanOrEqual(2)
      expect(members.length).toBeLessThanOrEqual(4)
      expect(new Set(members.map((member) => member.date)).size).toBe(1)
      expect(new Set(members.map((member) => member.durationMin)).size).toBe(1)
      expect(members.every((member) => member.setting === 'group')).toBe(true)
      expect(new Set(members.map((member) => member.soap.O)).size).toBe(members.length)
    }
    expect(data.sessions.filter((session) => !session.groupId).every((s) => s.setting !== 'group')).toBe(true)
  })

  it('generates every O section through the production generator and assembles clean notes', () => {
    const data = buildSampleDataset({ anchorDate })
    const clients = new Map(data.clients.map((client) => [client.id, client]))
    for (const session of data.sessions) {
      const client = clients.get(session.clientId)
      const goals = data.goals.filter((goal) => goal.clientId === client.id)
      expect(session.soap.O).toBe(
        generateO(client.code, goals, session.goalData, session.observations, session.standout)
      )
      const note = assembleNote(client, session)
      expect(note).not.toMatch(/\b(?:null|undefined)\b/)
    }
  })

  it('shows a noisy M14 trajectory that ultimately meets the /r/ criterion', () => {
    const data = buildSampleDataset({ anchorDate })
    const goals = data.goals.filter((goal) => goal.clientId === SAMPLE_CLIENT_IDS.m14)
    const sessions = data.sessions.filter((session) => session.clientId === SAMPLE_CLIENT_IDS.m14)
    const rGoal = goals.find((goal) => goal.shortLabel.includes('vocalic'))
    const points = goalPoints(rGoal.id, sessions)
    expect(points.some((point, index) => index > 0 && point.pct < points[index - 1].pct)).toBe(true)
    expect(goalCriterionStatus(rGoal, sessions)).toMatchObject({ streak: 3, met: true })
  })

  it('keeps P3 below criterion while high accuracy still needs moderate cues', () => {
    const data = buildSampleDataset({ anchorDate })
    const goal = data.goals.find((record) => record.clientId === SAMPLE_CLIENT_IDS.p3)
    const sessions = data.sessions.filter((session) => session.clientId === SAMPLE_CLIENT_IDS.p3)
    const highWithModerate = goalPoints(goal.id, sessions).filter(
      (point) => point.pct >= 80 && point.cueLevel === 'moderate'
    )
    expect(highWithModerate.length).toBeGreaterThanOrEqual(2)
    expect(goalCriterionStatus(goal, sessions)).toMatchObject({ streak: 2, met: false, nearing: true })
  })

  it('gives K7 different trajectories across its two goals and includes one draft overall', () => {
    const data = buildSampleDataset({ anchorDate })
    const goals = data.goals.filter((goal) => goal.clientId === SAMPLE_CLIENT_IDS.k7)
    const sessions = data.sessions.filter((session) => session.clientId === SAMPLE_CLIENT_IDS.k7)
    const statuses = goals.map((goal) => goalCriterionStatus(goal, sessions))
    expect(statuses.some((status) => status.met)).toBe(true)
    expect(statuses.some((status) => !status.met)).toBe(true)
    expect(data.sessions.filter((session) => session.status === 'draft')).toHaveLength(1)
  })

  it('reports absent, partial, and complete installation states', () => {
    const data = buildSampleDataset({ anchorDate })
    expect(sampleDatasetState()).toBe('absent')
    expect(sampleDatasetState({ clients: data.clients.slice(0, 1) })).toBe('partial')
    expect(sampleDatasetState(data)).toBe('complete')
  })

  it('contains no identifying-field keys', () => {
    const data = buildSampleDataset({ anchorDate })
    const forbidden = new Set(['name', 'fullName', 'dob', 'birthDate', 'school', 'teacher'])
    function inspect(value) {
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key)).toBe(false)
        inspect(child)
      }
    }
    inspect(data)
  })
})
