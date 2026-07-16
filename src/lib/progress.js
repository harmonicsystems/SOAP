// Progress math shared by the caseload badges, session A-suggestions,
// progress charts, and the copyable progress summary.
import { accuracyPct, shortLabelFor } from './ogen.js'
import { fmtDate } from './text.js'
import { CUE_LEVELS } from './constants.js'

// All sessions containing trial data for a goal, sorted by date then creation.
export function goalPoints(goalId, sessionList) {
  return (sessionList ?? [])
    .map((s) => ({ session: s, gd: (s.goalData ?? []).find((g) => g.goalId === goalId) }))
    .filter((x) => x.gd?.trials?.total)
    .sort(
      (a, b) =>
        a.session.date.localeCompare(b.session.date) ||
        (a.session.createdAt ?? 0) - (b.session.createdAt ?? 0)
    )
    .map(({ session, gd }) => ({
      sessionId: session.id,
      date: session.date,
      pct: accuracyPct(gd.trials.correct, gd.trials.total),
      cueLevel: gd.cueLevel
    }))
}

function cueMeetsTarget(actual, target) {
  if (!target) return true
  const actualIndex = CUE_LEVELS.indexOf(actual)
  const targetIndex = CUE_LEVELS.indexOf(target)
  return actualIndex >= 0 && targetIndex >= 0 && actualIndex <= targetIndex
}

export function streakFromPoints(points, targetPct, targetCueLevel = null) {
  let k = 0
  for (
    let i = points.length - 1;
    i >= 0 && points[i].pct >= targetPct && cueMeetsTarget(points[i].cueLevel, targetCueLevel);
    i--
  ) {
    k++
  }
  return k
}

// {streak, required, met, nearing} for a goal given all of a client's sessions.
export function goalCriterionStatus(goal, sessionList) {
  const target = goal.targetCriterion?.accuracyPct
  const required = goal.targetCriterion?.consecutiveSessions ?? 1
  const cue = goal.targetCriterion?.cueLevel
  if (target == null) return { streak: 0, required, met: false, nearing: false }
  const streak = streakFromPoints(goalPoints(goal.id, sessionList), target, cue)
  const met = streak >= required
  const nearing = !met && streak >= Math.max(1, Math.ceil(required / 2))
  return { streak, required, met, nearing }
}

// One plain-text paragraph per goal, for progress reports / IEP input (spec §5.6).
export function progressSummary(goal, sessionList) {
  const pts = goalPoints(goal.id, sessionList)
  const target = goal.targetCriterion?.accuracyPct
  const required = goal.targetCriterion?.consecutiveSessions ?? 1
  const cue = goal.targetCriterion?.cueLevel
  const label = shortLabelFor(goal)
  const lines = [`Goal (${label}): ${goal.text}`]
  if (goal.status && goal.status !== 'active') {
    lines.push(`Status: ${goal.status === 'met' ? 'Met' : 'Discontinued'}.`)
  }
  if (goal.baseline) lines.push(`Baseline: ${goal.baseline}.`)
  if (!pts.length) {
    lines.push('No trial data collected yet.')
    return lines.join(' ')
  }
  const pcts = pts.map((p) => p.pct)
  const min = Math.min(...pcts)
  const max = Math.max(...pcts)
  const last = pts[pts.length - 1]
  const latestCue =
    last.cueLevel === 'independent' ? 'independently' : `with ${last.cueLevel} cues`
  lines.push(
    `Across ${pts.length} data point${pts.length === 1 ? '' : 's'} from ${fmtDate(pts[0].date)} to ${fmtDate(last.date)}, accuracy ranged from ${min}% to ${max}%, most recently ${last.pct}% ${latestCue}.`
  )
  if (target != null) {
    const streak = streakFromPoints(pts, target, cue)
    const targetCue =
      cue === 'independent' ? ' independently' : cue ? ` given ${cue} cues` : ''
    const status =
      streak >= required
        ? 'Criterion met.'
        : streak > 0
          ? `Approaching criterion (${streak} of ${required} consecutive sessions at target).`
          : 'Criterion not yet met.'
    lines.push(
      `Target: ${target}% accuracy${targetCue} across ${required} consecutive sessions. ${status}`
    )
  }
  return lines.join(' ')
}
