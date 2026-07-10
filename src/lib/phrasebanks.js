// Default SOAP phrase banks (spec §6). User edits are stored as an overlay in
// Settings (null = defaults); these defaults are never mutated so updates can
// ship new phrases safely.

export const DEFAULT_BANKS = {
  S: [
    'transitioned willingly to the session',
    'required encouragement to engage',
    'reported a good week',
    'appeared fatigued',
    'was talkative and eager to share',
    'appeared distracted at the start of the session',
    'participated actively throughout',
    'needed movement breaks to stay engaged',
    'teacher reported carryover in the classroom',
    'teacher reported concerns this week'
  ],
  // Non-trial observations appendable to the auto-generated O section.
  O: [
    'remained engaged throughout the session',
    'required frequent redirection to task',
    'benefited from visual supports',
    'responded well to modeling',
    'self-corrected with increased consistency',
    'accuracy decreased as task complexity increased',
    'worked cooperatively in the group setting'
  ],
  // Static A phrases; data-driven suggestions (improved from X% to Y%, etc.)
  // are generated live on the session screen by suggest.js.
  A: [
    'making steady progress toward goals',
    'performance was variable across tasks',
    'demonstrated increased independence compared with previous sessions',
    'continues to require cues for accuracy',
    'skill is emerging; accuracy improves with support',
    'difficulty generalizing skills to {context}'
  ],
  P: [
    'continue current goals',
    'increase linguistic complexity',
    'introduce {context} generalization',
    'probe {skill} next session',
    'recommend home practice: {activity}',
    'continue current cueing hierarchy',
    'consult with classroom teacher regarding carryover'
  ]
}

export function effectiveBank(settings, section) {
  const override = settings?.phraseBanks?.[section]
  return Array.isArray(override) ? override : DEFAULT_BANKS[section]
}
