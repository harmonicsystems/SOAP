// Deterministic, entirely fictional longitudinal caseload used to demonstrate
// the real encrypted app. No randomness and no runtime fetches: a fixed anchor
// date always produces the same ordinary Client/Goal/Session payloads.
import { generateO } from './ogen.js'

export const SAMPLE_DATASET_ID = 'longitudinal-v1'

const prefix = `sample-${SAMPLE_DATASET_ID}`

export const SAMPLE_CLIENT_IDS = Object.freeze({
  m14: `${prefix}-client-m14`,
  k7: `${prefix}-client-k7`,
  p3: `${prefix}-client-p3`,
  t9: `${prefix}-client-t9`
})

export const SAMPLE_GROUP_IDS = Object.freeze({
  week2: `${prefix}-group-week2`,
  week4: `${prefix}-group-week4`,
  week6: `${prefix}-group-week6`,
  week8: `${prefix}-group-week8`,
  recent: `${prefix}-group-recent`
})

const GOAL_IDS = Object.freeze({
  m14r: `${prefix}-goal-m14-r`,
  m14clusters: `${prefix}-goal-m14-clusters`,
  k7sentences: `${prefix}-goal-k7-sentences`,
  k7narrative: `${prefix}-goal-k7-narrative`,
  p3directions: `${prefix}-goal-p3-directions`,
  t9topic: `${prefix}-goal-t9-topic`
})

const SESSION_COUNTS = Object.freeze({ m14: 9, k7: 8, p3: 7, t9: 6 })

const canonicalIds = Object.freeze({
  clients: Object.values(SAMPLE_CLIENT_IDS),
  goals: Object.values(GOAL_IDS),
  sessions: Object.entries(SESSION_COUNTS).flatMap(([code, count]) =>
    Array.from({ length: count }, (_, i) => `${prefix}-session-${code}-${String(i + 1).padStart(2, '0')}`)
  )
})

function marker() {
  return { sample: true, sampleDataset: SAMPLE_DATASET_ID }
}

export function sampleProvenance(record) {
  return isSampleRecord(record)
    ? { sample: true, sampleDataset: SAMPLE_DATASET_ID }
    : {}
}

export function isSampleRecord(record) {
  return record?.sample === true && record?.sampleDataset === SAMPLE_DATASET_ID
}

export function sampleDatasetState({ clients = [], goals = [], sessions = [] } = {}) {
  const tables = { clients, goals, sessions }
  const present = Object.values(tables).flat().filter((record) => isSampleRecord(record))
  if (!present.length) return 'absent'
  const complete = Object.entries(canonicalIds).every(([table, ids]) => {
    const have = new Set(tables[table].filter((record) => isSampleRecord(record)).map((r) => r.id))
    return ids.every((id) => have.has(id))
  })
  return complete ? 'complete' : 'partial'
}

function shiftISO(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  return date.toISOString().slice(0, 10)
}

function timestampFor(iso, minute = 0) {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day, 12, minute)
}

function goalData(goalId, data) {
  return {
    goalId,
    trials:
      data.correct == null || data.total == null
        ? null
        : { correct: data.correct, total: data.total },
    cueLevel: data.cueLevel,
    cueTypes: data.cueTypes ?? [],
    observations: data.observations ?? [],
    activity: data.activity ?? '',
    notes: data.notes ?? ''
  }
}

const CLIENTS = [
  ['m14', 'M14', 'Fictional sample client: compare early and recent articulation sessions.'],
  ['k7', 'K7', 'Fictional sample client: two language goals with different trajectories.'],
  ['p3', 'P3', 'Fictional sample client: accuracy improves before cue dependence resolves.'],
  ['t9', 'T9', 'Fictional sample client: performance varies across social contexts.']
]

const GOALS = [
  {
    id: GOAL_IDS.m14r,
    client: 'm14',
    domain: 'articulation-phonology',
    text: 'Will produce vocalic /r/ in structured sentences with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'vocalic /r/ in sentences',
    baseline: '42% in structured words with moderate cues',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  },
  {
    id: GOAL_IDS.m14clusters,
    client: 'm14',
    domain: 'articulation-phonology',
    text: 'Will produce consonant clusters in connected speech with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'clusters in connected speech',
    baseline: '60% in structured phrases with moderate cues',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  },
  {
    id: GOAL_IDS.k7sentences,
    client: 'k7',
    domain: 'expressive-language',
    text: 'Will produce complete, grammatically accurate sentences during structured description with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'complete sentences',
    baseline: '45% with moderate models and visual supports',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  },
  {
    id: GOAL_IDS.k7narrative,
    client: 'k7',
    domain: 'expressive-language',
    text: 'Will retell a short narrative with key story elements in sequence with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'narrative sequence',
    baseline: '40% with maximal verbal and visual support',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  },
  {
    id: GOAL_IDS.p3directions,
    client: 'p3',
    domain: 'receptive-language',
    text: 'Will follow multistep directions containing temporal and spatial concepts with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'multistep directions',
    baseline: '50% with moderate repetition and visual supports',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  },
  {
    id: GOAL_IDS.t9topic,
    client: 't9',
    domain: 'social-pragmatic',
    text: 'Will maintain a shared topic and provide contingent responses during peer interaction with 80% accuracy given minimal cues across 3 consecutive sessions.',
    shortLabel: 'contingent peer responses',
    baseline: '50% during structured peer activities with moderate cues',
    targetCriterion: { accuracyPct: 80, consecutiveSessions: 3, cueLevel: 'minimal' }
  }
]

const GROUPS = {
  week2: { offset: -56, durationMin: 30 },
  week4: { offset: -42, durationMin: 30 },
  week6: { offset: -28, durationMin: 30 },
  week8: { offset: -14, durationMin: 30 },
  recent: { offset: -7, durationMin: 30 }
}

const SCENARIOS = {
  m14: [
    {
      offset: -70,
      S: 'Transitioned readily and participated throughout structured practice.',
      A: 'Vocalic /r/ was emerging in structured words; cluster accuracy was stronger with direct models.',
      P: 'Continue word-to-sentence practice with moderate verbal and visual cues.',
      standout: 'Used the mirror to adjust tongue placement after a visual reminder',
      data: [
        [GOAL_IDS.m14r, 8, 19, 'moderate', ['verbal', 'visual'], 'vocalic /r/ picture cards', ['visual']],
        [GOAL_IDS.m14clusters, 12, 20, 'moderate', ['verbal', 'model'], 'cluster picture cards', ['model']]
      ]
    },
    {
      offset: -63,
      S: 'Arrived ready to work and sustained attention with one brief reminder.',
      A: 'Accuracy increased for both targets while moderate cueing remained necessary.',
      P: 'Continue short phrases and introduce a small set of sentence frames.',
      standout: 'Produced two unpracticed /r/ words accurately after reviewing the visual cue',
      data: [
        [GOAL_IDS.m14r, 10, 20, 'moderate', ['verbal', 'visual'], 'target words in short phrases'],
        [GOAL_IDS.m14clusters, 13, 19, 'moderate', ['verbal', 'model'], 'cluster phrases']
      ]
    },
    {
      group: 'week2',
      S: 'Participated cooperatively in the group and waited for turns.',
      A: 'Sentence-level /r/ accuracy improved; clusters were more stable in rehearsed responses.',
      P: 'Continue sentence generation and cue for self-monitoring before each response.',
      standout: 'Paused before one response and checked tongue placement without being told',
      data: [
        [GOAL_IDS.m14r, 11, 19, 'moderate', ['verbal', 'visual'], 'peer sentence-generation game'],
        [GOAL_IDS.m14clusters, 14, 20, 'moderate', ['verbal'], 'peer description game', ['initiated']]
      ]
    },
    {
      offset: -49,
      S: 'Engaged with an unfamiliar task and requested clarification appropriately.',
      A: 'Accuracy decreased as sentence length and novelty increased; productions improved after visual review.',
      P: 'Return briefly to familiar sentence frames, then vary one element at a time.',
      standout: 'Persisted with the unfamiliar picture task despite several difficult productions',
      data: [
        [GOAL_IDS.m14r, 9, 19, 'moderate', ['verbal', 'visual'], 'unfamiliar picture description', ['visual']],
        [GOAL_IDS.m14clusters, 13, 18, 'minimal', ['verbal'], 'unfamiliar picture description']
      ]
    },
    {
      offset: -35,
      S: 'Transitioned willingly and responded well to the familiar routine.',
      A: 'Vocalic /r/ rebounded with familiar sentence frames, and both targets required less support.',
      P: 'Continue minimal cues and mix familiar with novel sentence prompts.',
      standout: 'Corrected one distorted /r/ after a pause without a clinician model',
      data: [
        [GOAL_IDS.m14r, 12, 19, 'minimal', ['visual'], 'familiar sentence frames', ['self-correct']],
        [GOAL_IDS.m14clusters, 15, 20, 'minimal', ['verbal'], 'structured sentence practice']
      ]
    },
    {
      group: 'week6',
      S: 'Participated consistently and responded positively to peer turns.',
      A: 'Both targets improved with minimal cues during mixed sentence practice.',
      P: 'Maintain minimal cueing and begin brief connected-speech probes.',
      standout: 'Used a quiet rehearsal before answering during the group activity',
      data: [
        [GOAL_IDS.m14r, 15, 21, 'minimal', ['verbal'], 'mixed sentence practice'],
        [GOAL_IDS.m14clusters, 16, 20, 'minimal', ['verbal'], 'collaborative barrier game']
      ]
    },
    {
      offset: -21,
      S: 'Arrived focused and completed the structured reading task independently.',
      A: 'Vocalic /r/ reached criterion accuracy for the first session; cluster performance varied in connected text.',
      P: 'Continue structured reading and monitor whether target accuracy holds across settings.',
      standout: 'Self-corrected an /r/ production in the reading passage before continuing',
      data: [
        [GOAL_IDS.m14r, 16, 20, 'minimal', ['visual'], 'structured reading passage', ['self-correct']],
        [GOAL_IDS.m14clusters, 15, 19, 'minimal', ['verbal'], 'structured reading passage']
      ]
    },
    {
      offset: -14,
      S: 'Maintained effort during picture description and accepted reduced cueing.',
      A: 'Vocalic /r/ remained above criterion and cluster accuracy recovered with minimal support.',
      P: 'Continue less predictable description tasks and fade visual reminders.',
      standout: 'Used the visual cue independently before beginning a longer response',
      data: [
        [GOAL_IDS.m14r, 15, 18, 'minimal', ['visual'], 'picture description', ['initiated']],
        [GOAL_IDS.m14clusters, 17, 20, 'minimal', ['verbal'], 'picture description']
      ]
    },
    {
      group: 'recent',
      S: 'Participated throughout the group and used peer wait time productively.',
      A: 'Vocalic /r/ met the accuracy-and-cue criterion across three sessions; clusters are approaching criterion.',
      P: 'Probe vocalic /r/ in less structured conversation and continue cluster carryover practice.',
      standout: 'Corrected a distorted /r/ in an unpracticed word without prompting',
      data: [
        [GOAL_IDS.m14r, 17, 20, 'minimal', ['visual'], 'mixed group description tasks', ['self-correct']],
        [GOAL_IDS.m14clusters, 17, 21, 'minimal', ['verbal'], 'mixed group description tasks', ['self-correct']]
      ]
    }
  ],
  k7: [
    {
      offset: -70,
      S: 'Required a brief warm-up, then participated in all language activities.',
      A: 'Complete sentences and narrative sequence both required frequent models and visual structure.',
      P: 'Continue sentence frames and explicitly teach a simple story-element organizer.',
      standout: 'Added a subject to a sentence after comparing it with the visual frame',
      data: [
        [GOAL_IDS.k7sentences, 9, 20, 'moderate', ['verbal', 'visual', 'model'], 'single-picture description', ['model']],
        [GOAL_IDS.k7narrative, 4, 10, 'maximal', ['verbal', 'visual', 'model'], 'three-part picture sequence', ['visual']]
      ]
    },
    {
      offset: -63,
      S: 'Transitioned readily and remained engaged with visual materials.',
      A: 'Sentence completeness improved slightly; narrative retells still depended on direct sequencing support.',
      P: 'Continue visual sentence frames and practice first-next-last organization.',
      standout: 'Used first and next accurately after pointing to the organizer',
      data: [
        [GOAL_IDS.k7sentences, 10, 20, 'moderate', ['verbal', 'visual'], 'single-picture description'],
        [GOAL_IDS.k7narrative, 5, 10, 'moderate', ['verbal', 'visual'], 'first-next-last retell', ['visual']]
      ]
    },
    {
      group: 'week2',
      S: 'Participated cooperatively and listened to peer responses.',
      A: 'Sentence formulation improved in the shared activity; narrative details remained limited without visual prompts.',
      P: 'Continue peer description tasks and prompt for one additional story element.',
      standout: 'Expanded a peer response by adding where the event occurred',
      data: [
        [GOAL_IDS.k7sentences, 12, 20, 'moderate', ['verbal', 'visual'], 'peer sentence-generation game', ['initiated']],
        [GOAL_IDS.k7narrative, 6, 10, 'moderate', ['verbal', 'visual'], 'shared picture-sequence retell', ['visual']]
      ]
    },
    {
      group: 'week4',
      S: 'Engaged in the group but needed redirection during longer peer turns.',
      A: 'Sentence accuracy continued to increase; narrative sequence was less consistent when attention shifted.',
      P: 'Use shorter narrative segments and maintain the visual organizer during peer turns.',
      standout: 'Returned to the correct story step after checking the organizer',
      data: [
        [GOAL_IDS.k7sentences, 13, 20, 'moderate', ['verbal'], 'collaborative scene description'],
        [GOAL_IDS.k7narrative, 5, 10, 'moderate', ['verbal', 'visual'], 'peer story retell', ['redirection', 'visual']]
      ]
    },
    {
      offset: -35,
      S: 'Arrived ready to work and used the visual routine independently.',
      A: 'Sentence formulation improved with minimal support, while narrative organization continued to require moderate visual cues.',
      P: 'Fade sentence frames and retain the story organizer for narrative tasks.',
      standout: 'Produced a complete sentence before the visual frame was presented',
      data: [
        [GOAL_IDS.k7sentences, 14, 20, 'minimal', ['visual'], 'themed picture description', ['initiated']],
        [GOAL_IDS.k7narrative, 7, 10, 'moderate', ['visual'], 'four-part picture sequence', ['visual']]
      ]
    },
    {
      group: 'week6',
      S: 'Participated actively and asked a peer one relevant question.',
      A: 'Complete sentences reached criterion accuracy with minimal cues; narrative content improved but remained cue-dependent.',
      P: 'Practice sentence carryover in conversation and continue visual narrative supports.',
      standout: 'Added a missing problem element to the group story without a direct prompt',
      data: [
        [GOAL_IDS.k7sentences, 16, 20, 'minimal', ['verbal'], 'collaborative barrier game'],
        [GOAL_IDS.k7narrative, 7, 10, 'minimal', ['visual'], 'collaborative story retell', ['initiated']]
      ]
    },
    {
      offset: -14,
      S: 'Sustained attention and completed both language tasks with minimal redirection.',
      A: 'Sentence accuracy remained above criterion; narrative sequencing reached criterion once with visual support.',
      P: 'Continue narrative retells with less predictable stories and fade organizer prompts gradually.',
      standout: 'Noticed and supplied a missing ending after reviewing the sequence',
      data: [
        [GOAL_IDS.k7sentences, 17, 20, 'minimal', ['verbal'], 'unfamiliar scene description'],
        [GOAL_IDS.k7narrative, 8, 10, 'minimal', ['visual'], 'unfamiliar short narrative', ['self-correct']]
      ]
    },
    {
      group: 'recent',
      S: 'Participated consistently and responded to peer ideas throughout the group.',
      A: 'Complete sentences met criterion with reduced support; narrative organization remained variable in a less structured task.',
      P: 'Shift sentence work toward conversation and continue targeting independent narrative organization.',
      standout: 'Produced several complete responses in peer conversation without the sentence frame',
      data: [
        [GOAL_IDS.k7sentences, 18, 21, 'independent', [], 'peer planning discussion', ['generalized']],
        [GOAL_IDS.k7narrative, 7, 10, 'minimal', ['visual'], 'less structured group retell', ['visual']]
      ]
    }
  ],
  p3: [
    {
      offset: -63,
      S: 'Transitioned willingly and attended to the structured direction task.',
      A: 'Multistep directions required repetition and visual support at baseline.',
      P: 'Continue two-step directions with explicit temporal concepts and visuals.',
      standout: 'Checked the visual sequence before beginning a two-step direction',
      data: [[GOAL_IDS.p3directions, 10, 20, 'moderate', ['verbal', 'visual'], 'two-step object directions', ['visual']]]
    },
    {
      group: 'week2',
      S: 'Participated cooperatively and watched peer demonstrations.',
      A: 'Accuracy improved with repeated directions and visual sequencing cues.',
      P: 'Continue temporal concepts and reduce repetitions when the visual is available.',
      standout: 'Completed an after-before direction after one visual review',
      data: [[GOAL_IDS.p3directions, 12, 20, 'moderate', ['verbal', 'visual'], 'group movement directions', ['visual']]]
    },
    {
      offset: -49,
      S: 'Arrived focused and requested one repetition appropriately.',
      A: 'Accuracy continued to improve, though moderate verbal support remained necessary.',
      P: 'Maintain concept variety and pause before offering repetition.',
      standout: 'Repeated the direction quietly before completing each step',
      data: [[GOAL_IDS.p3directions, 14, 20, 'moderate', ['verbal', 'visual'], 'classroom-material directions', ['initiated']]]
    },
    {
      offset: -35,
      S: 'Engaged throughout a familiar direction-following routine.',
      A: 'Accuracy exceeded target in a familiar task, but performance still required moderate cueing.',
      P: 'Keep the accuracy demand while fading repetition toward minimal support.',
      standout: 'Completed several three-step directions accurately after verbal repetition',
      data: [[GOAL_IDS.p3directions, 17, 20, 'moderate', ['verbal'], 'familiar three-step routine']]
    },
    {
      offset: -21,
      S: 'Participated readily and tolerated delayed cueing.',
      A: 'High accuracy was maintained, but cue dependence remained above the goal criterion.',
      P: 'Delay verbal support and encourage one independent rehearsal before acting.',
      standout: 'Waited through the cueing delay and initiated the first step independently',
      data: [[GOAL_IDS.p3directions, 18, 20, 'moderate', ['verbal'], 'temporal-concept directions', ['initiated']]]
    },
    {
      group: 'week8',
      S: 'Participated throughout the group and followed the visual routine.',
      A: 'Target accuracy was maintained as cueing decreased to minimal for the first session.',
      P: 'Continue minimal cues across varied group directions before considering criterion met.',
      standout: 'Completed a multistep peer direction after one brief visual cue',
      data: [[GOAL_IDS.p3directions, 16, 20, 'minimal', ['visual'], 'peer-directed barrier task', ['visual']]]
    },
    {
      group: 'recent',
      S: 'Remained engaged during a busy group activity with one brief redirection.',
      A: 'Accuracy remained above target with minimal cues for a second session; independence is emerging but criterion is not yet met.',
      P: 'Continue varied multistep directions with minimal cues and monitor the next consecutive data point.',
      standout: 'Asked for clarification before beginning rather than waiting for a repeated direction',
      data: [[GOAL_IDS.p3directions, 17, 21, 'minimal', ['visual'], 'mixed group directions', ['initiated']]]
    }
  ],
  t9: [
    {
      offset: -49,
      S: 'Engaged with the structured conversation map and completed all turns.',
      A: 'Contingent responses were emerging with moderate visual and verbal supports.',
      P: 'Continue structured turn-taking with a visible topic map.',
      standout: 'Asked one related follow-up question after checking the topic map',
      data: [[GOAL_IDS.t9topic, 8, 16, 'moderate', ['verbal', 'visual'], 'structured conversation map', ['visual']]]
    },
    {
      group: 'week4',
      S: 'Participated in the small group and responded positively to clear turn cues.',
      A: 'Contingent responses improved during a predictable peer game with moderate cues.',
      P: 'Continue predictable peer routines and fade explicit turn reminders.',
      standout: 'Responded directly to a peer comment before introducing a new idea',
      data: [[GOAL_IDS.t9topic, 12, 20, 'moderate', ['verbal', 'visual'], 'predictable peer question game', ['initiated']]]
    },
    {
      group: 'week6',
      S: 'Participated throughout but shifted topics during open-ended turns.',
      A: 'Performance decreased when the group activity became less structured.',
      P: 'Use a brief topic cue during open-ended discussion and practice two-turn exchanges.',
      standout: 'Returned to the shared topic after a peer restated the question',
      data: [[GOAL_IDS.t9topic, 9, 18, 'moderate', ['verbal', 'visual'], 'open-ended group discussion', ['visual']]]
    },
    {
      group: 'week8',
      S: 'Engaged consistently and used the group plan to track the shared topic.',
      A: 'Contingent responses improved with minimal visual cueing in a structured peer task.',
      P: 'Continue minimal visual cues and vary peer partners and topics.',
      standout: 'Maintained the topic across three peer turns with one visual reminder',
      data: [[GOAL_IDS.t9topic, 14, 20, 'minimal', ['visual'], 'structured peer planning task', ['initiated']]]
    },
    {
      group: 'recent',
      S: 'Participated willingly; environmental noise affected several peer exchanges.',
      A: 'Performance varied in the busier setting despite minimal cues, indicating continued need for contextual practice.',
      P: 'Practice brief peer exchanges across settings and keep visual support available as needed.',
      standout: 'Recovered the shared topic after noticing that a peer looked confused',
      data: [[GOAL_IDS.t9topic, 10, 18, 'minimal', ['visual'], 'less structured group planning', ['environment', 'self-correct']]]
    },
    {
      offset: 0,
      status: 'draft',
      S: 'Transitioned readily and began a new peer-interview activity.',
      A: '',
      P: '',
      standout: '',
      data: [[GOAL_IDS.t9topic, 5, 8, 'minimal', ['visual'], 'peer interview warm-up', []]]
    }
  ]
}

function makeSession(clientKey, client, clientGoals, scenario, index, anchorDate) {
  const group = scenario.group ? GROUPS[scenario.group] : null
  const date = shiftISO(anchorDate, group?.offset ?? scenario.offset)
  const data = scenario.data.map(([goalId, correct, total, cueLevel, cueTypes, activity, observations]) =>
    goalData(goalId, { correct, total, cueLevel, cueTypes, activity, observations })
  )
  const standout = scenario.standout ?? ''
  const objective = generateO(client.code, clientGoals, data, '', standout)
  return {
    id: `${prefix}-session-${clientKey}-${String(index + 1).padStart(2, '0')}`,
    clientId: client.id,
    groupId: scenario.group ? SAMPLE_GROUP_IDS[scenario.group] : null,
    date,
    durationMin: group?.durationMin ?? scenario.durationMin ?? 30,
    setting: scenario.group ? 'group' : scenario.setting ?? 'individual',
    soap: { S: scenario.S, O: objective, A: scenario.A, P: scenario.P },
    oEdited: false,
    observations: '',
    standout,
    goalData: data,
    status: scenario.status ?? 'final',
    createdAt: timestampFor(date, index),
    ...marker()
  }
}

export function buildSampleDataset({ anchorDate }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate ?? '')) {
    throw new Error('Sample dataset requires an anchor date in YYYY-MM-DD format')
  }

  const createdDate = shiftISO(anchorDate, -84)
  const clients = CLIENTS.map(([key, code, notes], index) => ({
    id: SAMPLE_CLIENT_IDS[key],
    code,
    notes,
    archived: false,
    createdAt: timestampFor(createdDate, index),
    ...marker()
  }))

  const goals = GOALS.map((goal, index) => ({
    id: goal.id,
    clientId: SAMPLE_CLIENT_IDS[goal.client],
    domain: goal.domain,
    text: goal.text,
    shortLabel: goal.shortLabel,
    targetCriterion: goal.targetCriterion,
    baseline: goal.baseline,
    status: 'active',
    createdAt: timestampFor(createdDate, index + 10),
    ...marker()
  }))

  const sessions = []
  for (const [clientKey, scenarios] of Object.entries(SCENARIOS)) {
    const client = clients.find((record) => record.id === SAMPLE_CLIENT_IDS[clientKey])
    const clientGoals = goals.filter((goal) => goal.clientId === client.id)
    scenarios.forEach((scenario, index) => {
      sessions.push(makeSession(clientKey, client, clientGoals, scenario, index, anchorDate))
    })
  }

  return { clients, goals, sessions }
}
