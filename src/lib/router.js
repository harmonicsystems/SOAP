// Hash-based routing only — GitHub Pages has no SPA rewrites (spec §1).
import { readable } from 'svelte/store'

const APP_ROUTES = [
  ['clients', 'clients'],
  ['calendar', 'calendar'],
  ['client/:id', 'client'],
  ['client/:id/progress', 'progress'],
  ['session/:id', 'session'],
  ['session/:id/note', 'note'],
  ['group/:groupId', 'group'],
  ['settings', 'settings'],
  ['help', 'help']
]

const PUBLIC_ROUTES = [
  ['', 'welcome'],
  ['create', 'create'],
  ['unlock', 'unlock'],
  ['help', 'help']
]

const DEMO_ROUTES = [
  ['', 'demo-entry'],
  ['guide/:step', 'guide'],
  ...APP_ROUTES.filter(([pattern]) => pattern !== 'settings')
]

function matchSegments(segs, routes, mode) {
  for (const [pattern, name] of routes) {
    const parts = pattern.split('/').filter(Boolean)
    if (parts.length !== segs.length) continue
    const params = {}
    let ok = true
    parts.forEach((part, i) => {
      if (!ok) return
      if (part.startsWith(':')) {
        try {
          params[part.slice(1)] = decodeURIComponent(segs[i])
        } catch {
          ok = false
        }
      } else if (part !== segs[i]) ok = false
    })
    if (ok) return { mode, name, params }
  }
  return null
}

// Pure hash → {name, params} matcher (exported for testing without a DOM).
export function matchRoute(hash) {
  const path = (hash ?? '').replace(/^#\/?/, '')
  const segs = path.split('/').filter(Boolean)
  if (segs[0] === 'demo') {
    return (
      matchSegments(segs.slice(1), DEMO_ROUTES, 'demo') ?? {
        mode: 'demo',
        name: 'notfound',
        params: {}
      }
    )
  }
  return (
    matchSegments(segs, PUBLIC_ROUTES, 'public') ??
    matchSegments(segs, APP_ROUTES.filter(([pattern]) => pattern !== 'help'), 'private') ?? {
      mode: 'public',
      name: 'notfound',
      params: {}
    }
  )
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

function activeMode() {
  const mode = matchRoute(typeof location !== 'undefined' ? location.hash : '').mode
  return mode === 'demo' ? 'demo' : 'private'
}

export function hrefFor(path = '', mode = activeMode()) {
  const clean = String(path).replace(/^#\/?/, '').replace(/^\/+|\/+$/g, '')
  const prefix = mode === 'demo' ? 'demo/' : ''
  return `#/${prefix}${clean}`
}

export function navigate(path, mode = activeMode()) {
  location.hash = hrefFor(path, mode)
}

// Replaces the current history entry instead of pushing — used for automatic
// redirects (e.g., '#/' → '#/clients' after unlock) so the Back button is
// never trapped in a redirect loop.
export function redirect(path, mode = activeMode()) {
  location.replace(hrefFor(path, mode))
}
