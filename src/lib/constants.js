export const CUE_LEVELS = ['independent', 'minimal', 'moderate', 'maximal']

export const CUE_TYPES = ['verbal', 'visual', 'tactile', 'phonemic', 'gestural', 'model']

export const SESSION_SETTINGS = ['individual', 'group', 'push-in', 'teletherapy']

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
