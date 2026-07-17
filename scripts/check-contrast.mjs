// Build gate: every palette shipped in global.css must meet WCAG AA contrast
// on the token pairs the UI actually renders. Runs alongside the bundle-size
// gate so a palette tweak can never silently ship illegible text.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/styles/global.css'),
  'utf8'
)

// Parse hex tokens out of :root (default) and each :root[data-palette='…'] block.
function tokensFrom(block) {
  const out = {}
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2]
  return out
}
const rootMatch = css.match(/:root\s*{([^}]+)}/)
const base = tokensFrom(rootMatch[1])
const palettes = { default: base }
for (const m of css.matchAll(/:root\[data-palette='([a-z]+)'\]\s*{([^}]+)}/g)) {
  palettes[m[1]] = { ...base, ...tokensFrom(m[2]) }
}

// A palette the regex fails to parse must fail loudly, not silently pass.
const EXPECTED = ['default', 'studio', 'clinic', 'evening']
const parsed = Object.keys(palettes)
if (EXPECTED.some((name) => !parsed.includes(name)) || parsed.length !== EXPECTED.length) {
  console.error(`✗ palette parse mismatch: expected [${EXPECTED}], found [${parsed}]`)
  process.exit(1)
}
// Every palette override must define the same token set as the default —
// a token missing from one palette silently inherits a wrong-ground value.
for (const [name, tokens] of Object.entries(palettes)) {
  if (name === 'default') continue
  for (const key of Object.keys(base)) {
    if (key === 'radius') continue
    if (!(key in tokens)) {
      console.error(`✗ ${name}: token --${key} not overridden (inherits default)`)
      process.exit(1)
    }
  }
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground, background, minimum, where it renders]
const PAIRS = [
  ['ink', 'bg', 4.5, 'body text'],
  ['ink', 'surface', 4.5, 'card text'],
  ['muted', 'bg', 4.5, 'secondary text'],
  ['muted', 'surface', 4.5, 'secondary text on cards'],
  ['muted', 'warn-soft', 4.5, 'demo banner subtext'],
  ['accent', 'bg', 4.5, 'links'],
  ['accent', 'surface', 4.5, 'links on cards'],
  ['accent-ink', 'accent', 4.5, 'primary buttons'],
  ['accent-ink', 'accent-hover', 4.5, 'primary buttons (hover)'],
  ['ink', 'accent-soft', 4.5, 'highlighted panels'],
  ['ink', 'warn-soft', 4.5, 'warning banners'],
  ['good', 'good-soft', 4.5, 'good tags'],
  ['good', 'surface', 4.5, 'chart target labels'],
  ['bad', 'bad-soft', 4.5, 'error tags'],
  ['bad', 'bg', 4.5, 'error text'],
  ['bad', 'surface', 4.5, 'error text on cards'],
  ['warn', 'warn-soft', 4.5, 'warn tags'],
  ['accent', 'accent-soft', 4.5, 'links inside highlighted panels'],
  ['good-ink', 'good', 4.5, 'correct tap-button hover'],
  ['bad-ink', 'bad', 4.5, 'danger buttons, incorrect tap hover'],
  ['bad-ink', 'bad-hover', 4.5, 'danger buttons (hover)'],
  ['toast-ink', 'toast-bg', 4.5, 'toasts + PWA update prompt'],
  // Hairlines are decorative (AA's 3:1 applies to meaningful graphics, not
  // dividers); this floor only guards against a border going invisible.
  ['line', 'bg', 1.15, 'hairline borders (decorative)'],
]

let failed = 0
for (const [name, tokens] of Object.entries(palettes)) {
  for (const [fg, bg, min, where] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      console.error(`✗ ${name}: missing token --${tokens[fg] ? bg : fg}`)
      failed++
      continue
    }
    const r = ratio(tokens[fg], tokens[bg])
    if (r < min) {
      console.error(
        `✗ ${name}: --${fg} on --${bg} = ${r.toFixed(2)} (needs ${min}) — ${where}`
      )
      failed++
    }
  }
}

const count = Object.keys(palettes).length
if (failed) {
  console.error(`\nContrast gate FAILED: ${failed} pair(s) below WCAG AA across ${count} palettes.`)
  process.exit(1)
}
console.log(`Contrast gate: ${count} palettes × ${PAIRS.length} pairs — all pass WCAG AA.`)
