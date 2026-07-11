// Deterministic near-duplicate detection for the per-client anti-repetition
// nudge (round 3, §1). No AI: token-set Jaccard similarity, which is coarse
// but honest — it only ever asks the clinician, never rewrites anything.

export function tokenize(text) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[{}()[\].,;:!?"'—–-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

// Jaccard over token sets: 0 (disjoint) … 1 (same words, any order).
export function textSimilarity(a, b) {
  const ta = new Set(tokenize(a))
  const tb = new Set(tokenize(b))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  return inter / (ta.size + tb.size - inter)
}

// Nudge-worthy: the new text has enough substance to matter (≥5 tokens) and
// ≥75% token overlap with the previous note's section. 0.75 catches "changed
// one word" (a ~10-token sentence with one word swapped scores ~0.77) while
// genuinely different notes score well under 0.5. Short repeats ("continue
// current goals") are legitimate and never flagged.
export function isNearDuplicate(current, previous) {
  if (tokenize(current).length < 5) return false
  return textSimilarity(current, previous) >= 0.75
}
