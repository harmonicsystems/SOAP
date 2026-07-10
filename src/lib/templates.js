// Goal-template slot engine (spec §6). Deterministic text assembly — no AI.
// Slot syntax: {slotName}. Unfilled slots stay visible as {slotName} so the
// user can see what's missing.

export function extractSlots(text) {
  const seen = new Set()
  const out = []
  for (const m of text.matchAll(/\{([a-zA-Z][\w]*)\}/g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      out.push(m[1])
    }
  }
  return out
}

export function fillTemplate(text, values = {}) {
  return text.replace(/\{([a-zA-Z][\w]*)\}/g, (match, name) => {
    const v = values[name]
    return v === undefined || v === null || v === '' ? match : String(v)
  })
}

// "conceptType" → "concept type" for form labels.
export function slotLabel(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

// Slots auto-bound to the goal's target criterion fields in the builder.
export const CRITERION_SLOTS = ['accuracy', 'cueLevel', 'sessions']

const NUMBER_SLOTS = new Set([
  'steps',
  'fieldSize',
  'turns',
  'count',
  'opportunities',
  'attributeCount',
  'wordCount',
  'syllableCount',
  'sequenceLength',
  'percentOpportunities'
])

const SELECT_SLOTS = {
  position: ['initial', 'medial', 'final'],
  level: ['isolation', 'syllable', 'word', 'phrase', 'sentence', 'conversation'],
  presentation: ['orally', 'with visuals', 'orally with visuals'],
  whType: ['who', 'what', 'where', 'when', 'why', 'how', 'mixed wh-'],
  nonliteralType: ['idioms', 'sarcasm', 'inference', 'figurative language']
}

export function slotInputType(name) {
  if (NUMBER_SLOTS.has(name)) return { kind: 'number' }
  if (SELECT_SLOTS[name]) return { kind: 'select', options: SELECT_SLOTS[name] }
  return { kind: 'text' }
}
