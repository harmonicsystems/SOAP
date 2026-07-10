// O-section auto-generation (spec §6): one sentence per goal from trial data.

export function accuracyPct(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

export function shortLabelFor(goal) {
  if (goal.shortLabel?.trim()) return goal.shortLabel.trim()
  const words = goal.text.replace(/^Will\s+/i, '').split(/\s+/).slice(0, 6).join(' ')
  return words.replace(/[.,;:]$/, '')
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

export function generateO(clientCode, goalList, goalData, observations = '') {
  const byId = new Map(goalList.map((g) => [g.id, g]))
  const sentences = (goalData ?? [])
    .map((gd) => {
      const goal = byId.get(gd.goalId)
      return goal ? goalSentence(clientCode, goal, gd) : null
    })
    .filter(Boolean)
  const obs = (observations ?? '').trim()
  return [sentences.join(' '), obs].filter(Boolean).join(' ')
}
