// Deterministic fictional January–April caseload for the public demo. Compact
// authored profiles expand into ordinary Client/Goal/Session payloads. No
// randomness, persistence, network access, diagnoses, names, or school data.
import { generateO } from './ogen.js'

export const SAMPLE_DATASET_ID = 'winter-trimester-v2'
const prefix = `demo-${SAMPLE_DATASET_ID}`

const goal = (
  label,
  target,
  arc,
  status = 'active',
  startWeek = 0,
  endWeek = 12,
  criterion = null
) => ({ label, target, arc, status, startWeek, endWeek, criterion })

// Student-level outcome classes intentionally include flat and lower recent
// performance. They are fixture-design labels, not clinical classifications.
const PROFILES = [
  {
    code: 'AV', domain: 'articulation-phonology', group: null, outcome: 'clear',
    goals: [
      goal('vocalic /r/ in sentences', 'produce vocalic /r/ in structured sentences', 'clear', 'met'),
      goal('/r/ in connected speech', 'produce /r/ during a structured speaking sample', 'modest')
    ]
  },
  { code: 'BEX', domain: 'articulation-phonology', group: 'A', outcome: 'cue-dependent', goals: [goal('/s/ and /z/ in sentences', 'produce /s/ and /z/ in structured sentences', 'cue')] },
  {
    code: 'CY', domain: 'articulation-phonology', group: 'A', outcome: 'mixed',
    goals: [
      goal('initial /l/ in phrases', 'produce initial /l/ in structured phrases', 'modest'),
      goal('final consonants in speech', 'produce final consonants in connected speech', 'plateau')
    ]
  },
  { code: 'DOR', domain: 'articulation-phonology', group: 'A', outcome: 'lower-recent', goals: [goal('/sh/ in sentences', 'produce /sh/ in structured sentences', 'lower')] },
  {
    code: 'ELM', domain: 'articulation-phonology', group: 'B', outcome: 'mixed',
    goals: [
      goal('velars in structured words', 'produce velar sounds in structured words', 'clear', 'active', 0, 12, { accuracyPct: 90, consecutiveSessions: 3, cueLevel: 'minimal' }),
      goal('velars in connected speech', 'produce velar sounds during a connected-speech sample', 'plateau', 'discontinued', 0, 10)
    ]
  },
  { code: 'FEN', domain: 'articulation-phonology', group: 'B', outcome: 'modest', goals: [goal('multisyllabic words', 'produce multisyllabic words with accurate sound sequencing', 'modest')] },
  {
    code: 'GRA', domain: 'articulation-phonology', group: 'B', outcome: 'lower-recent',
    goals: [
      goal('/r/ blends in phrases', 'produce /r/ blends in structured phrases', 'lower'),
      goal('speech-sound error identifications and repairs', 'identify and repair speech-sound errors during structured speaking', 'plateau')
    ]
  },
  { code: 'HUX', domain: 'articulation-phonology', group: 'B', outcome: 'clear', goals: [goal('/th/ in sentences', 'produce /th/ in structured sentences', 'clear', 'met')] },
  {
    code: 'IVQ', domain: 'expressive-language', group: 'C', outcome: 'mixed',
    goals: [
      goal('sentences with regular past-tense verbs', 'use regular past-tense verbs in structured sentences', 'modest', 'active', 7, 12),
      goal('complete grammatical sentences', 'form complete sentences during picture description', 'plateau', 'discontinued', 0, 5)
    ]
  },
  { code: 'JET', domain: 'expressive-language', group: 'C', outcome: 'lower-recent', goals: [goal('narrative retells with ordered key events', 'retell a short narrative with key events in sequence', 'lower')] },
  { code: 'KAL', domain: 'expressive-language', group: 'C', outcome: 'modest', goals: [goal('specific vocabulary in explanations', 'use specific vocabulary during structured explanations', 'supported')] },
  {
    code: 'LUM', domain: 'expressive-language', group: 'D', outcome: 'mixed',
    goals: [
      goal('complete grammatical sentences', 'produce complete grammatical sentences during description', 'modest'),
      goal('narrative retells with key story elements', 'include key story elements in a short narrative retell', 'plateau')
    ]
  },
  { code: 'MEP', domain: 'expressive-language', group: 'D', outcome: 'plateau', goals: [goal('category-and-feature relationship explanations', 'explain category and feature relationships using complete sentences', 'plateau')] },
  { code: 'NIX', domain: 'receptive-language', group: 'D', outcome: 'cue-dependent', goals: [goal('accurate responses to multistep directions', 'follow multistep directions containing temporal and spatial concepts', 'cue')] },
  {
    code: 'ORQ', domain: 'receptive-language', group: 'E', outcome: 'modest',
    goals: [
      goal('accurate responses to spatial-concept directions', 'follow directions containing spatial concepts', 'modest'),
      goal('accurate responses to temporal-concept directions', 'follow directions containing before and after concepts', 'modest')
    ]
  },
  { code: 'PAV', domain: 'receptive-language', group: 'E', outcome: 'plateau', goals: [goal('accurate inference responses', 'answer inference questions from short spoken passages', 'plateau')] },
  { code: 'QET', domain: 'receptive-language', group: 'E', outcome: 'clear', goals: [goal('accurate responses about auditory details', 'answer questions about key details from spoken directions', 'clear', 'met')] },
  {
    code: 'RUS', domain: 'social-pragmatic', group: 'F', outcome: 'plateau',
    goals: [
      goal('contingent responses', 'provide contingent responses during structured peer interaction', 'plateau'),
      goal('shared-topic conversational turns', 'maintain a shared topic across conversational turns', 'plateau')
    ]
  },
  { code: 'SIV', domain: 'social-pragmatic', group: 'F', outcome: 'clear', goals: [goal('communication repairs', 'use a taught repair strategy after a communication breakdown', 'clear', 'met')] },
  { code: 'TOL', domain: 'social-pragmatic', group: 'F', outcome: 'clear', goals: [goal('appropriate peer-interaction entries', 'enter an ongoing structured peer interaction appropriately', 'clear', 'met')] },
  {
    code: 'UMB', domain: 'social-pragmatic', group: 'F', outcome: 'modest',
    goals: [
      goal('accurate peer-perspective identifications', 'identify a peer perspective during structured scenarios', 'approaching'),
      goal('clarifying questions', 'ask a relevant clarifying question during shared tasks', 'emerging')
    ]
  },
  { code: 'VEK', domain: 'fluency', group: 'G', outcome: 'modest', goals: [goal('speech samples using a selected fluency strategy', 'use a selected fluency strategy during structured speaking', 'late-independent')] },
  { code: 'WIR', domain: 'fluency', group: 'G', outcome: 'plateau', goals: [goal('accurate identifications of strategy use', 'identify use of a selected fluency strategy in structured samples', 'plateau')] },
  { code: 'XAN', domain: 'voice', group: null, outcome: 'plateau', goals: [goal('speech samples using the agreed voice strategy', 'use an agreed voice strategy during structured speaking tasks', 'plateau')] },
  {
    code: 'ZEP', domain: 'other', group: null, outcome: 'modest',
    goals: [
      goal('clarification requests', 'request clarification using an available communication modality', 'modest'),
      goal('relevant contributions during structured exchanges', 'share one relevant piece of information during a structured exchange', 'modest')
    ]
  }
]

const GROUP_MEMBERS = {
  A: ['BEX', 'CY', 'DOR'],
  B: ['ELM', 'FEN', 'GRA', 'HUX'],
  C: ['IVQ', 'JET', 'KAL'],
  D: ['LUM', 'MEP', 'NIX'],
  E: ['ORQ', 'PAV', 'QET'],
  F: ['RUS', 'SIV', 'TOL', 'UMB'],
  G: ['VEK', 'WIR']
}

// Week 6 is the one planned service gap. Additional deterministic absences
// vary by group; individual schedules retain all 12 possible service weeks.
const INDIVIDUAL_WEEKS = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]
const GROUP_WEEKS = {
  A: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 12],
  B: [0, 1, 2, 3, 5, 7, 8, 9, 10, 12],
  C: [0, 1, 3, 4, 5, 7, 8, 9, 10, 11, 12],
  D: [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12],
  E: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12],
  F: [0, 1, 2, 4, 5, 7, 8, 10, 11, 12],
  G: [0, 2, 3, 4, 5, 7, 8, 9, 11, 12]
}
const GROUP_DAY = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 1, G: 3 }
const INDIVIDUAL_DAY = { AV: 2, XAN: 3, ZEP: 4 }
const GROUP_DURATIONS = { A: [30, 35, 30], B: [30, 30, 35], C: [35, 30, 30], D: [30, 35, 35], E: [30, 35, 30], F: [35, 30, 35], G: [30, 35, 30] }
const INDIVIDUAL_DURATIONS = { AV: [25, 30, 25], XAN: [30, 25, 30], ZEP: [25, 35, 30] }
const TOTALS = [16, 18, 20, 15, 17, 19, 16, 20, 18, 17, 20, 22]

const ARCS = {
  clear: [45, 52, 58, 63, 68, 73, 78, 82, 84, 86, 88],
  modest: [50, 54, 51, 58, 57, 61, 59, 64, 62, 67, 66],
  supported: [48, 53, 50, 57, 55, 60, 58, 63, 61, 65, 67],
  approaching: [48, 54, 57, 62, 66, 69, 73, 76, 75, 82, 84],
  emerging: [35, 39, 37, 42, 41, 45, 44, 48, 46, 50, 51],
  'late-independent': [52, 55, 54, 56, 55, 58, 60, 61, 64, 66, 68],
  plateau: [58, 61, 56, 60, 59, 62, 57, 60, 61, 58, 60],
  lower: [65, 68, 63, 61, 60, 58, 56, 55, 57, 53, 54],
  cue: [48, 55, 60, 66, 70, 74, 78, 82, 84, 85, 87]
}

const ACTIVITIES = {
  'articulation-phonology': ['picture naming', 'sentence practice', 'structured description', 'peer speaking game'],
  'expressive-language': ['picture description', 'narrative retell', 'category task', 'shared explanation task'],
  'receptive-language': ['direction-following task', 'listening passage', 'concept activity', 'barrier game'],
  'social-pragmatic': ['peer discussion', 'cooperative game', 'structured scenario', 'shared planning task'],
  fluency: ['structured reading', 'sentence generation', 'brief presentation', 'peer discussion'],
  voice: ['structured reading', 'sentence practice', 'brief presentation', 'self-monitoring task'],
  other: ['choice-making task', 'shared activity', 'information exchange', 'functional communication task']
}

const ASSESSMENT = {
  clear: [
    'Current performance remained below criterion and benefited from direct support.',
    'Accuracy increased while cueing was reduced across recent samples.',
    'Recent data met the stated accuracy and cue criteria.'
  ],
  modest: [
    'Performance was variable and remained below criterion.',
    'Recent samples showed modest change with continued variability.',
    'Some improvement was observed, while the full criterion remained unmet.'
  ],
  plateau: [
    'Current performance was comparable to other early samples.',
    'Data remained variable without a clear upward trend.',
    'Recent performance remained comparable to earlier samples; criterion was not met.'
  ],
  'lower-recent': [
    'Current performance was variable across tasks.',
    'Recent measured accuracy was lower than several earlier samples.',
    'Late-term samples remained below the early-term range; no cause was inferred.'
  ],
  mixed: [
    'The two measured targets showed different response patterns.',
    'One target changed modestly while the other remained variable.',
    'The goals ended the term with different measured outcomes.'
  ],
  'cue-dependent': [
    'Accuracy increased with substantial support.',
    'Accuracy continued to improve while moderate cueing remained necessary.',
    'Accuracy was high in recent samples, but cueing remained above the target criterion.'
  ]
}

const PLAN = {
  clear: [
    'Continue the current target and collect additional supported samples.',
    'Continue the target while testing reduced support across structured tasks.',
    'Collect periodic maintenance samples for the met target.'
  ],
  modest: 'Continue the current target and collect additional data across varied structured tasks.',
  plateau: 'Continue data collection and review task and support selection using clinician judgment.',
  'lower-recent': 'Continue data collection and review task demands and supports without attributing a cause.',
  mixed: 'Continue both measured targets at their current support levels and review the patterns separately.',
  'cue-dependent': 'Continue the target while systematically testing whether cues can be reduced.'
}

const STANDOUT = {
  clear: ['Used a visual reminder before responding', 'Paused to check one response', 'Corrected one response after a brief pause'],
  modest: ['Stayed with the task after an incorrect response', 'Requested one repetition', 'Used the provided visual organizer'],
  plateau: ['Performance varied across repeated items', 'Used the same support across easier and harder items', 'Completed the task with the planned supports'],
  'lower-recent': ['Requested a repetition during the final activity', 'Needed the planned model before several responses', 'Completed the activity despite variable responses'],
  mixed: ['Responded differently across the two target activities', 'Used a visual support for one target but not the other', 'Asked to review one direction before continuing'],
  'cue-dependent': ['Reached high accuracy after a verbal model', 'Waited for the visual cue before several responses', 'Completed the final items with moderate support']
}

export const SAMPLE_CLIENT_IDS = Object.freeze(
  Object.fromEntries(PROFILES.map((profile) => [profile.code.toLowerCase(), `${prefix}-client-${profile.code.toLowerCase()}`]))
)

const groupId = (group, week) => `${prefix}-group-${group.toLowerCase()}-${String(week).padStart(2, '0')}`
const sessionId = (code, week) => `${prefix}-session-${code.toLowerCase()}-${String(week).padStart(2, '0')}`

export const SAMPLE_GROUP_IDS = Object.freeze({ recent: groupId('F', 12) })
export const DEMO_GUIDE_TARGETS = Object.freeze({
  clientId: SAMPLE_CLIENT_IDS.cy,
  progressClientId: SAMPLE_CLIENT_IDS.mep,
  draftSessionId: sessionId('NIX', 12),
  noteSessionId: sessionId('AV', 12),
  groupId: SAMPLE_GROUP_IDS.recent
})

function marker() {
  return { sample: true, sampleDataset: SAMPLE_DATASET_ID }
}

export function isSampleRecord(record) {
  return record?.sample === true && record?.sampleDataset === SAMPLE_DATASET_ID
}

export function sampleProvenance(record) {
  return isSampleRecord(record) ? marker() : {}
}

function validISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function timestamp(iso, minute = 0) {
  return new Date(`${iso}T12:${String(minute).padStart(2, '0')}:00Z`).valueOf()
}

export function winterTerm(anchorDate) {
  if (!validISO(anchorDate)) throw new Error('A valid anchor date in YYYY-MM-DD format is required.')
  const anchorYear = Number(anchorDate.slice(0, 4))
  const completedThisYear = anchorDate >= `${anchorYear}-04-04`
  const year = completedThisYear ? anchorYear : anchorYear - 1
  const jan5 = `${year}-01-05`
  const day = new Date(`${jan5}T12:00:00Z`).getUTCDay()
  const monday = addDays(jan5, (8 - day) % 7)
  return { year, start: monday, end: addDays(monday, 12 * 7 + 4) }
}

function goalId(code, index) {
  return `${prefix}-goal-${code.toLowerCase()}-${index + 1}`
}

function serviceWeeksFor(profile) {
  return profile.group ? GROUP_WEEKS[profile.group] : INDIVIDUAL_WEEKS
}

function cueFor(arc, position, length) {
  if (arc === 'cue') return position < 2 ? 'maximal' : 'moderate'
  if (arc === 'clear') return position < 3 ? 'moderate' : 'minimal'
  if (arc === 'modest' || arc === 'approaching') return position < Math.ceil(length / 2) ? 'moderate' : 'minimal'
  if (arc === 'late-independent') {
    if (position >= length - 3) return 'independent'
    return position < 4 ? 'moderate' : 'minimal'
  }
  return 'moderate'
}

function cueTypes(domain, cueLevel, position, observations, standout) {
  if (cueLevel === 'independent') return []
  const types = [domain === 'articulation-phonology' ? 'verbal' : 'visual']
  types.push(domain === 'other' ? 'model' : position % 2 ? 'verbal' : 'visual')
  if (observations.includes('model') || /\bmodel\b/i.test(standout)) types.push('model')
  if (/\bvisual\b/i.test(standout)) types.push('visual')
  if (/\bverbal\b/i.test(standout)) types.push('verbal')
  return [...new Set(types)]
}

function observationFor(profile, spec, position, length) {
  if (profile.code === 'GRA' && spec.arc === 'plateau') {
    return position >= Math.ceil(length / 2) && position % 2 === 0 ? ['self-correct'] : []
  }
  if (spec.arc === 'clear' && position >= 6 && position % 2 === 0) return ['self-correct']
  if ((spec.arc === 'cue' || spec.arc === 'lower') && position % 3 === 0) return ['model']
  if (spec.arc === 'supported' && position % 2 === 0) return ['visual']
  return position % 3 === 0 ? ['visual'] : []
}

function phase(position, length) {
  if (position < Math.ceil(length / 3)) return 0
  if (position < Math.ceil((length * 2) / 3)) return 1
  return 2
}

function pctFor(arc, position, length) {
  const source = ARCS[arc]
  const index = length <= 1 ? source.length - 1 : Math.round((position * (source.length - 1)) / (length - 1))
  return source[index]
}

function criterionFor(spec) {
  if (spec.criterion) return spec.criterion
  if (spec.arc === 'plateau' || spec.arc === 'lower') {
    return { accuracyPct: 75, consecutiveSessions: 2, cueLevel: 'minimal' }
  }
  return { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
}

function sessionSubject(setting, position) {
  const group = [
    'Participated in the scheduled group and completed the planned activities.',
    'Transitioned to the group and took part in each structured task.',
    'Participated in the peer activities with the planned supports.'
  ]
  const individual = [
    'Transitioned to the individual session and completed the planned activities.',
    'Participated throughout the individual session with the planned supports.',
    'Completed the structured individual activities.'
  ]
  const list = setting === 'group' ? group : individual
  return list[position % list.length]
}

function standoutFor(profile, position, length) {
  if (profile.code === 'GRA') {
    if (position < Math.ceil(length / 3)) return 'Used a visual reminder before checking a response'
    if (position < Math.ceil((length * 2) / 3)) return 'Paused to check one production before continuing'
    return 'Self-corrected one production before feedback'
  }
  if (profile.code === 'KAL') return 'Used the visual organizer before several explanations'
  if (profile.code === 'VEK' && position >= length - 3) return 'Selected and used the strategy independently in the final speaking sample'
  if (profile.code === 'ZEP') {
    if (position < Math.ceil(length / 3)) return 'Selected a picture response during the structured exchange'
    if (position < Math.ceil((length * 2) / 3)) return 'Combined a picture response with a gesture'
    return 'Used gesture and a spoken response across two activities'
  }
  const list = STANDOUT[profile.outcome]
  return list[(position + PROFILES.indexOf(profile)) % list.length]
}

function assessmentFor(profile, p, activeSpecs) {
  if (profile.outcome === 'mixed' && activeSpecs.length < 2) {
    const arc = activeSpecs[0]?.arc
    if (arc === 'plateau') return ASSESSMENT.plateau[p]
    if (arc === 'lower') return ASSESSMENT['lower-recent'][p]
    if (arc === 'clear') return ASSESSMENT.clear[p]
    return ASSESSMENT.modest[p]
  }
  return ASSESSMENT[profile.outcome][p]
}

function planFor(profile, p, activeSpecs) {
  if (profile.outcome === 'clear') {
    if (p < 2) return PLAN.clear[p]
    const hasMet = activeSpecs.some((spec) => spec.status === 'met')
    const hasActive = activeSpecs.some((spec) => spec.status === 'active')
    if (hasMet && hasActive) return 'Collect maintenance samples for the met target and continue the remaining active target.'
    return PLAN.clear[2]
  }
  if (profile.outcome === 'mixed' && activeSpecs.length < 2) {
    const arc = activeSpecs[0]?.arc
    if (arc === 'plateau') return PLAN.plateau
    if (arc === 'lower') return PLAN['lower-recent']
    return PLAN.modest
  }
  return PLAN[profile.outcome]
}

function durationFor(profile, serviceIndex) {
  const choices = profile.group ? GROUP_DURATIONS[profile.group] : INDIVIDUAL_DURATIONS[profile.code]
  return choices[serviceIndex % choices.length]
}

function activeWeeksFor(spec, serviceWeeks) {
  return serviceWeeks.filter((week) => week >= spec.startWeek && week <= spec.endWeek)
}

export function buildSampleDataset({ anchorDate } = {}) {
  const term = winterTerm(anchorDate)
  const clients = PROFILES.map((profile, index) => ({
    id: SAMPLE_CLIENT_IDS[profile.code.toLowerCase()],
    code: profile.code,
    notes: profile.group
      ? 'Fictional demo record. Seen in a recurring small group; review accuracy together with cue level and task context.'
      : 'Fictional demo record. Seen individually; review accuracy together with cue level and task context.',
    archived: false,
    demoOutcome: profile.outcome,
    createdAt: timestamp(term.start, index),
    ...marker()
  }))

  const goals = PROFILES.flatMap((profile, profileIndex) =>
    profile.goals.map((spec, index) => {
      const criterion = criterionFor(spec)
      return {
        id: goalId(profile.code, index),
        clientId: SAMPLE_CLIENT_IDS[profile.code.toLowerCase()],
        domain: profile.domain,
        text: `Will ${spec.target} with ${criterion.accuracyPct}% accuracy given ${criterion.cueLevel} cues across ${criterion.consecutiveSessions} consecutive sessions.`,
        shortLabel: spec.label,
        targetCriterion: criterion,
        baseline: `${ARCS[spec.arc][0]}% with ${spec.arc === 'cue' ? 'maximal' : 'moderate'} cues in structured tasks`,
        status: spec.status,
        demoArc: spec.arc,
        createdAt: timestamp(term.start, profileIndex + index),
        ...marker()
      }
    })
  )

  const goalMap = new Map(goals.map((record) => [record.id, record]))
  const sessions = []

  for (const [profileIndex, profile] of PROFILES.entries()) {
    const clientId = SAMPLE_CLIENT_IDS[profile.code.toLowerCase()]
    const serviceWeeks = serviceWeeksFor(profile)
    const clientGoals = profile.goals.map((spec, index) => ({ spec, goal: goalMap.get(goalId(profile.code, index)) }))
    for (const [serviceIndex, week] of serviceWeeks.entries()) {
      const dayOffset = profile.group ? GROUP_DAY[profile.group] : INDIVIDUAL_DAY[profile.code]
      const date = addDays(term.start, week * 7 + dayOffset)
      const setting = profile.group ? 'group' : 'individual'
      const activePairs = clientGoals.filter(({ spec }) => week >= spec.startWeek && week <= spec.endWeek)
      const p = phase(serviceIndex, serviceWeeks.length)
      const standout = standoutFor(profile, serviceIndex, serviceWeeks.length)
      const goalData = activePairs.map(({ spec, goal: record }, goalIndex) => {
        const activeWeeks = activeWeeksFor(spec, serviceWeeks)
        const position = activeWeeks.indexOf(week)
        const targetPct = pctFor(spec.arc, position, activeWeeks.length)
        const total = TOTALS[(serviceIndex + goalIndex + profileIndex) % TOTALS.length]
        const correct = Math.max(0, Math.min(total, Math.round((targetPct / 100) * total)))
        const cueLevel = cueFor(spec.arc, position, activeWeeks.length)
        const observations = observationFor(profile, spec, position, activeWeeks.length)
        return {
          goalId: record.id,
          trials: { correct, total },
          cueLevel,
          cueTypes: cueTypes(profile.domain, cueLevel, position, observations, standout),
          observations,
          activity: ACTIVITIES[profile.domain][(serviceIndex + goalIndex) % ACTIVITIES[profile.domain].length],
          notes: ''
        }
      })

      const activeSpecs = activePairs.map(({ spec }) => spec)
      const session = {
        id: sessionId(profile.code, week),
        clientId,
        ...(profile.group ? { groupId: groupId(profile.group, week) } : {}),
        date,
        durationMin: durationFor(profile, serviceIndex),
        setting,
        status: ['NIX', 'RUS', 'ZEP'].includes(profile.code) && week === 12 ? 'draft' : 'final',
        soap: {
          S: sessionSubject(setting, serviceIndex),
          O: '',
          A: assessmentFor(profile, p, activeSpecs),
          P: planFor(profile, p, activeSpecs)
        },
        oEdited: false,
        observations: '',
        standout,
        goalData,
        createdAt: timestamp(date, profileIndex),
        updatedAt: timestamp(date, profileIndex),
        ...marker()
      }
      session.soap.O = generateO(profile.code, goals.filter((record) => record.clientId === clientId), goalData, '', standout)
      sessions.push(session)
    }
  }

  return { clients, goals, sessions }
}

const groupMeetings = Object.values(GROUP_WEEKS).reduce((sum, weeks) => sum + weeks.length, 0)
const individualMeetings = Object.keys(INDIVIDUAL_DAY).length * INDIVIDUAL_WEEKS.length

export const DEMO_DATASET_SUMMARY = Object.freeze({
  clients: PROFILES.length,
  goals: PROFILES.reduce((sum, profile) => sum + profile.goals.length, 0),
  sessions: PROFILES.reduce((sum, profile) => sum + serviceWeeksFor(profile).length, 0),
  groups: Object.keys(GROUP_MEMBERS).length,
  meetings: groupMeetings + individualMeetings
})
