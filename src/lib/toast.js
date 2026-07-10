import { writable } from 'svelte/store'

// Transient toast: {message, action?: {label, fn}} or null. Single slot.
export const toastState = writable(null)

// The PWA "Update available" prompt lives in its OWN persistent slot so a
// transient toast (e.g. "Backup exported") can never overwrite and destroy it
// — onNeedRefresh only fires once per page lifetime.
export const updateReady = writable(null) // {reload: fn} or null

let timer = null

export const toast = {
  show(message, action = null, ms = 2500) {
    clearTimeout(timer)
    toastState.set({ message, action })
    if (ms) timer = setTimeout(() => toastState.set(null), ms)
  },
  hide() {
    clearTimeout(timer)
    toastState.set(null)
  }
}
