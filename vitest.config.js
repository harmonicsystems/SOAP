import { defineConfig } from 'vitest/config'

// Standalone vitest config: tests exercise the pure lib layer (crypto, backup,
// templates, note assembly, repo) in a plain node environment — no Svelte/PWA
// plugins needed, which keeps the test run fast and dependency-free.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.js']
  }
})
