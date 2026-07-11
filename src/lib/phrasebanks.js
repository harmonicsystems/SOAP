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

function normText(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Canonical key for per-phrase state (usage counts, domain tags): whitespace-
// collapsed, lowercased, and SCOPED BY SECTION — identical text living in two
// sections must never share or clobber each other's ranking state.
export function phraseKey(section, text) {
  return `${section}:${normText(text)}`
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Did this chip appear in the previous note? Slot-aware and boundary-safe:
// {slot} placeholders are cut out and every remaining literal segment must
// appear at word boundaries — so "recommend home practice: {activity}" is
// recognized after its slot was filled in, while "reported a good week" does
// NOT false-match against "reported a good weekend".
export function usedInPrevText(chipText, prevText) {
  const prev = normText(prevText)
  if (!prev) return false
  const segments = normText(chipText)
    .split(/\{[^}]*\}/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  if (!segments.length) return false
  return segments.every((seg) =>
    new RegExp(`(?<![a-z0-9])${escapeRegex(seg)}(?![a-z0-9])`).test(prev)
  )
}

// The session-screen bank: the editable base plus the clinician's own learned
// phrases (§1), deduped, ranked so the phrases they actually reach for float to
// the top. Authentic-by-construction because learned phrases are the
// clinician's words.
//
// Ranking, in precedence order (round 3):
//   1. freshness — phrases that appeared in THIS client's previous note for
//      this section sink to the bottom (rotation beats affinity: the whole
//      point is not writing the same note twice);
//   2. domain affinity — phrases tagged with a domain matching this session's
//      goals float above untagged (neutral), which float above mismatched;
//   3. usage — count desc, most-recent use desc;
//   4. stable base order.
//
// `usage` is a snapshot ({lowercasedText: {count, lastUsedAt}}); the caller
// freezes it (and `context`) at mount so live taps don't reshuffle chips
// mid-session — adaptation shows up next session, not under the finger.
// `context` = { domains: [domainIds of this session's goals],
//               prevText: previous session's text for this section }.
export function rankedBank(settings, section, usage = {}, context = {}) {
  const base = effectiveBank(settings, section) ?? []
  const learned = settings?.learned?.[section] ?? []
  const domains = context.domains ?? []
  const prevText = (context.prevText ?? '').toLowerCase()
  const phraseDomains = settings?.phraseDomains ?? {}
  // Dedup case-insensitively (matching savePhrase), first occurrence wins so
  // the base-bank casing is preferred over a learned duplicate. Usage and
  // domain tags are keyed the same way so they never split across casings.
  const seen = new Set()
  const list = []
  const add = (text, order, isLearned) => {
    const k = normText(text)
    if (seen.has(k)) return
    seen.add(k)
    list.push({ text, key: k, order, learned: isLearned })
  }
  base.forEach((text, i) => add(text, i, false))
  learned.forEach((text, i) => add(text, base.length + i, true))
  return list
    .map((e) => {
      // Section-scoped key first; plain-text key accepted as a legacy
      // fallback for state written before section scoping existed.
      const sKey = phraseKey(section, e.text)
      const tags = phraseDomains[sKey] ?? phraseDomains[e.key]
      // matched=2, untagged/neutral=1, tagged-but-mismatched=0
      const domainScore =
        domains.length && Array.isArray(tags) && tags.length
          ? tags.some((d) => domains.includes(d))
            ? 2
            : 0
          : 1
      // Slot-aware, boundary-safe: however the phrase got into last session's
      // note (chip or typed, slots filled or not), it counts as "used last time".
      const recentPenalty = usedInPrevText(e.text, prevText) ? 1 : 0
      return {
        ...e,
        domainScore,
        recentPenalty,
        u: usage[sKey] ?? usage[e.key] ?? { count: 0, lastUsedAt: 0 }
      }
    })
    .sort(
      (a, b) =>
        a.recentPenalty - b.recentPenalty ||
        b.domainScore - a.domainScore ||
        b.u.count - a.u.count ||
        b.u.lastUsedAt - a.u.lastUsedAt ||
        a.order - b.order
    )
    .map((e) => e.text)
}
