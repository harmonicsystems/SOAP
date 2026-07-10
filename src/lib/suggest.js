// Data-driven A/P suggestion chips (spec §6): the engine fills the numbers
// automatically from data the app already has.
import { accuracyPct, shortLabelFor } from './ogen.js'
import { goalPoints, streakFromPoints } from './progress.js'
import { nextCueLevel } from './constants.js'

// sessionList must already have the working session's live data substituted in.
export function aSuggestions(session, goalMap, sessionList) {
  const out = []
  for (const gd of session.goalData ?? []) {
    if (!gd.trials?.total) continue
    const goal = goalMap.get(gd.goalId)
    if (!goal) continue
    const label = shortLabelFor(goal)
    const today = accuracyPct(gd.trials.correct, gd.trials.total)

    const prior = goalPoints(
      gd.goalId,
      sessionList.filter((s) => s.id !== session.id && s.date <= session.date)
    )
    const prev = prior.length ? prior[prior.length - 1].pct : null
    if (prev != null) {
      if (today > prev) out.push(`${label}: improved from ${prev}% to ${today}%`)
      else if (today === prev) out.push(`${label}: consistent with previous session (${today}%)`)
      else out.push(`${label}: decreased from ${prev}% to ${today}% this session`)
    }
    if (gd.cueTypes?.length) {
      out.push(`${label}: emerging skill — benefits from ${gd.cueTypes.join(', ')} cues`)
    }
    const target = goal.targetCriterion?.accuracyPct
    const required = goal.targetCriterion?.consecutiveSessions ?? 1
    if (target != null) {
      const upTo = sessionList.filter((s) => s.date <= session.date)
      const streak = streakFromPoints(goalPoints(gd.goalId, upTo), target)
      if (streak >= required) {
        out.push(`${label}: met criterion (${streak} consecutive sessions at or above ${target}%)`)
      } else if (streak >= 1) {
        out.push(
          `${label}: approaching criterion (${streak} of ${required} consecutive sessions at target)`
        )
      }
    }
  }
  return out
}

export function pSuggestions(session, goalMap) {
  const out = []
  for (const gd of session.goalData ?? []) {
    if (!gd.trials?.total) continue
    const goal = goalMap.get(gd.goalId)
    if (!goal) continue
    const next = nextCueLevel(gd.cueLevel)
    if (next) out.push(`fade cues toward ${next} for ${shortLabelFor(goal)}`)
    if (gd.activity?.trim()) out.push(`recommend home practice: ${gd.activity.trim()}`)
  }
  return [...new Set(out)]
}
