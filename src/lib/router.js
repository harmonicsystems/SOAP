// Hash-based routing only — GitHub Pages has no SPA rewrites (spec §1).
import { readable } from 'svelte/store'

const ROUTES = [
  ['', 'lock'],
  ['clients', 'clients'],
  ['client/:id', 'client'],
  ['client/:id/progress', 'progress'],
  ['session/:id', 'session'],
  ['session/:id/note', 'note'],
  ['group/:groupId', 'group'],
  ['settings', 'settings'],
  ['help', 'help']
]

// Pure hash → {name, params} matcher (exported for testing without a DOM).
export function matchRoute(hash) {
  const path = (hash ?? '').replace(/^#\/?/, '')
  const segs = path.split('/').filter(Boolean)
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

function parse() {
  // Guard so the module can be imported in a non-DOM context (tests).
  return matchRoute(typeof location !== 'undefined' ? location.hash : '')
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
