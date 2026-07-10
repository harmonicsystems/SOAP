// Hash-based routing only — GitHub Pages has no SPA rewrites (spec §1).
import { readable } from 'svelte/store'

const ROUTES = [
  ['', 'lock'],
  ['clients', 'clients'],
  ['client/:id', 'client'],
  ['client/:id/progress', 'progress'],
  ['session/:id', 'session'],
  ['session/:id/note', 'note'],
  ['settings', 'settings']
]

function parse() {
  const hash = location.hash.replace(/^#\/?/, '')
  const segs = hash.split('/').filter(Boolean)
  for (const [pattern, name] of ROUTES) {
    const parts = pattern.split('/').filter(Boolean)
    if (parts.length !== segs.length) continue
    const params = {}
    let ok = true
    parts.forEach((part, i) => {
      if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(segs[i])
      else if (part !== segs[i]) ok = false
    })
    if (ok) return { name, params }
  }
  return { name: 'notfound', params: {} }
}

export const route = readable(parse(), (set) => {
  const onChange = () => {
    set(parse())
    // hash navigation keeps the old scroll position; each screen starts at top
    scrollTo(0, 0)
  }
  addEventListener('hashchange', onChange)
  return () => removeEventListener('hashchange', onChange)
})

export function navigate(path) {
  location.hash = '#/' + path
}

// Replaces the current history entry instead of pushing — used for automatic
// redirects (e.g., '#/' → '#/clients' after unlock) so the Back button is
// never trapped in a redirect loop.
export function redirect(path) {
  location.replace('#/' + path)
}
