export const CUE_LEVELS = ['independent', 'minimal', 'moderate', 'maximal']

export const CUE_TYPES = ['verbal', 'visual', 'tactile', 'phonemic', 'gestural', 'model']

export const SESSION_SETTINGS = ['individual', 'group', 'push-in', 'teletherapy']

// A group session is 2–MAX linked per-client sessions entered on one screen.
// School groups are typically 2–3; 4 leaves headroom for the occasional larger
// group. A group of 1 is just an individual session.
export const MIN_GROUP_SIZE = 2
export const MAX_GROUP_SIZE = 4

export const DOMAINS = [
  { id: 'receptive-language', label: 'Receptive language' },
  { id: 'expressive-language', label: 'Expressive language' },
  { id: 'articulation-phonology', label: 'Articulation / phonology' },
  { id: 'social-pragmatic', label: 'Social-pragmatic' },
  { id: 'fluency', label: 'Fluency' },
  { id: 'voice', label: 'Voice' },
  { id: 'other', label: 'Other' }
]

export function domainLabel(id) {
  return DOMAINS.find((d) => d.id === id)?.label ?? id
}

// Next step toward independence, used by the P-section "fade cues" suggestion.
export function nextCueLevel(level) {
  const order = ['maximal', 'moderate', 'minimal', 'independent']
  const i = order.indexOf(level)
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null
}

// Quick-tap observation tags for the goal card (§2 authenticity capture).
// `chip` is the short button label; `clause` is a third-person predicate that
// reads grammatically after "{ClientCode} " so tapped observations assemble
// into a natural O-section sentence. Behavioral/observational — distinct from
// the evaluative cue-level and cue-type controls.
export const OBSERVATION_TAGS = [
  { id: 'self-correct', chip: 'self-corrected', clause: 'self-corrected errors independently' },
  { id: 'model', chip: 'needed model', clause: 'required repeated models' },
  { id: 'generalized', chip: 'generalized', clause: 'generalized the target to spontaneous speech' },
  { id: 'initiated', chip: 'initiated', clause: 'initiated responses independently' },
  { id: 'visual', chip: 'used visuals', clause: 'responded well to visual supports' },
  { id: 'redirection', chip: 'needed redirection', clause: 'required frequent redirection to task' },
  { id: 'transitions', chip: 'distractible', clause: 'was distractible after transitions' },
  { id: 'fatigue', chip: 'fatigued late', clause: 'showed fatigue toward the end of the session' },
  { id: 'environment', chip: 'environment', clause: 'was distracted by the environment' },
  { id: 'carryover', chip: 'carryover', clause: 'demonstrated carryover reported from the classroom' }
]

const OBS_BY_ID = new Map(OBSERVATION_TAGS.map((t) => [t.id, t]))

export function observationTag(id) {
  return OBS_BY_ID.get(id) ?? null
}

// Resolve a tag id against built-ins AND the clinician's custom tags —
// including archived ones, so notes from old sessions always render their
// clauses even after a tag is retired.
export function resolveObsTag(id, customTags = []) {
  return OBS_BY_ID.get(id) ?? customTags.find((t) => t.id === id) ?? null
}

// Chips shown on a goal card: built-ins minus any the clinician hid, plus
// active custom tags — plus any hidden/archived tag still selected in this
// session, so a reopened draft can still un-toggle it.
export function visibleObsTags(settings, selectedIds = []) {
  const custom = settings?.customObsTags ?? []
  const hidden = new Set(settings?.hiddenObsTags ?? [])
  const selected = new Set(selectedIds)
  const out = OBSERVATION_TAGS.filter((t) => !hidden.has(t.id) || selected.has(t.id))
  for (const t of custom) {
    if (!t.archived || selected.has(t.id)) out.push(t)
  }
  return out
}
