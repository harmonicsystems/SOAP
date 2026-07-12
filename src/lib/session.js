// Shared session-record builder. One shape for individual AND group sessions
// (a group member is a normal per-client session carrying a groupId), so both
// paths stay in lockstep as the model evolves.
import { todayISO } from './text.js'

export function newSessionRecord(
  clientId,
  activeGoals = [],
  { date, durationMin = 30, setting = 'individual', groupId = null } = {}
) {
  return {
    id: crypto.randomUUID(),
    clientId,
    groupId, // null for individual sessions; a shared uuid links group members
    date: date ?? todayISO(),
    durationMin,
    setting,
    soap: { S: '', O: '', A: '', P: '' },
    oEdited: false,
    observations: '',
    standout: '',
    goalData: activeGoals.map((g) => ({
      goalId: g.id,
      trials: null,
      cueLevel: g.targetCriterion?.cueLevel ?? 'minimal',
      cueTypes: [],
      observations: [],
      activity: '',
      notes: ''
    })),
    status: 'draft',
    createdAt: Date.now()
  }
}
