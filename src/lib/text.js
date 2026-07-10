// Small text helpers shared across screens.

export function todayISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Append a phrase-bank chip to a textarea value: sentence-case it, ensure
// terminal punctuation, separate from existing text with one space.
export function appendPhrase(current, phrase) {
  let p = (phrase ?? '').trim()
  if (!p) return current
  p = p[0].toUpperCase() + p.slice(1)
  if (!/[.!?]$/.test(p)) p += '.'
  const base = (current ?? '').trimEnd()
  if (!base) return p
  return base + (/[.!?:]$/.test(base) ? ' ' : '. ') + p
}

export function daysAgoLabel(ts, now = Date.now()) {
  if (!ts) return 'never'
  const days = Math.floor((now - ts) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
