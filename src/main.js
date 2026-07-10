import { mount } from 'svelte'
import App from './App.svelte'
import './styles/global.css'
import { registerSW } from 'virtual:pwa-register'
import { updateReady } from './lib/toast.js'

// registerType 'prompt': show a persistent prompt instead of auto-reloading —
// never interrupt a live session (spec §8). Uses its own store slot so
// transient toasts cannot destroy it.
const updateSW = registerSW({
  onNeedRefresh() {
    updateReady.set({ reload: () => updateSW(true) })
  }
})

mount(App, { target: document.getElementById('app') })
