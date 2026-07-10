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

// The editable base list for a section: the user's Settings override if they
// customized it, otherwise the shipped defaults. Used by the Settings editor.
export function effectiveBank(settings, section) {
  const override = settings?.phraseBanks?.[section]
  return Array.isArray(override) ? override : DEFAULT_BANKS[section]
}

// The session-screen bank: the editable base plus the clinician's own learned
// phrases (§1), deduped, ranked so the phrases they actually reach for float to
// the top. Ranking is by (use count desc, most-recent use desc, base order) —
// authentic-by-construction because learned phrases are the clinician's words.
//
// `usage` is a snapshot ({text: {count, lastUsedAt}}); the caller freezes it at
// mount so live taps don't reshuffle chips mid-session (adaptation shows up
// next session, not jarringly under the finger).
export function rankedBank(settings, section, usage = {}) {
  const base = effectiveBank(settings, section) ?? []
  const learned = settings?.learned?.[section] ?? []
  // Dedup case-insensitively (matching savePhrase), first occurrence wins so
  // the base-bank casing is preferred over a learned duplicate. Usage is keyed
  // the same way so counts for the same phrase never split across casings.
  const seen = new Set()
  const list = []
  const add = (text, order, isLearned) => {
    const k = text.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    list.push({ text, order, learned: isLearned })
  }
  base.forEach((text, i) => add(text, i, false))
  learned.forEach((text, i) => add(text, base.length + i, true))
  return list
    .map((e) => ({ ...e, u: usage[e.text.toLowerCase()] ?? { count: 0, lastUsedAt: 0 } }))
    .sort(
      (a, b) => b.u.count - a.u.count || b.u.lastUsedAt - a.u.lastUsedAt || a.order - b.order
    )
    .map((e) => e.text)
}
