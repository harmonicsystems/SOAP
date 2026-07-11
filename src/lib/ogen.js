// O-section auto-generation (spec §6): one sentence per goal from trial data.
import { resolveObsTag } from './constants.js'

export function accuracyPct(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

export function shortLabelFor(goal) {
  if (goal.shortLabel?.trim()) return goal.shortLabel.trim()
  const words = goal.text.replace(/^Will\s+/i, '').split(/\s+/).slice(0, 6).join(' ')
  return words.replace(/[.,;:]$/, '')
}

// Join predicate clauses into one grammatical list: "a", "a and b",
// "a, b, and c" (Oxford comma).
function joinClauses(clauses) {
  if (clauses.length === 0) return ''
  if (clauses.length === 1) return clauses[0]
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`
}

// Second sentence per goal built from tapped observation tags (§2). Reads as
// "{ClientCode} self-corrected errors independently and showed fatigue…".
// customTags includes archived tags so old sessions keep rendering correctly.
export function observationSentence(clientCode, gd, customTags = []) {
  const clauses = (gd?.observations ?? [])
    .map((id) => resolveObsTag(id, customTags)?.clause)
    .filter(Boolean)
  if (!clauses.length) return null
  return `${clientCode} ${joinClauses(clauses)}.`
}

// Exact pattern (spec §6):
// "{ClientCode} produced {goal short label} with {accuracy}% accuracy
//  ({correct}/{total} trials) given {cueLevel} {cueTypes} cues during {activity}."
// Deviations only where the data is absent: 'independent' reads as
// "independently", and the "during {activity}" clause is omitted when blank.
export function goalSentence(clientCode, goal, gd) {
  if (!gd?.trials?.total) return null // goals with no trials are omitted
  const pct = accuracyPct(gd.trials.correct, gd.trials.total)
  const label = shortLabelFor(goal)
  let cues
  if (gd.cueLevel === 'independent') {
    cues = 'independently'
  } else {
    const types = (gd.cueTypes ?? []).join(', ')
    cues = `given ${gd.cueLevel}${types ? ` ${types}` : ''} cues`
  }
  const during = gd.activity?.trim() ? ` during ${gd.activity.trim()}` : ''
  return `${clientCode} produced ${label} with ${pct}% accuracy (${gd.trials.correct}/${gd.trials.total} trials) ${cues}${during}.`
}

// Order: per-goal trial sentence (+ its observation sentence), then chip
// observations, then the one-line "what stood out" note. A goal with tapped
// observations but no trials still contributes its observation sentence — the
// clinician recorded something real about it.
export function generateO(clientCode, goalList, goalData, observations = '', standout = '', customTags = []) {
  const byId = new Map(goalList.map((g) => [g.id, g]))
  const parts = []
  for (const gd of goalData ?? []) {
    const goal = byId.get(gd.goalId)
    if (!goal) continue
    const trial = goalSentence(clientCode, goal, gd)
    if (trial) parts.push(trial)
    const obs = observationSentence(clientCode, gd, customTags)
    if (obs) parts.push(obs)
  }
  const chipObs = (observations ?? '').trim()
  if (chipObs) parts.push(chipObs)
  let stood = (standout ?? '').trim()
  if (stood) {
    stood = stood[0].toUpperCase() + stood.slice(1) // it becomes its own sentence
    parts.push(/[.!?]$/.test(stood) ? stood : `${stood}.`)
  }
  return parts.join(' ')
}
