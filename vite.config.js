import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// base '/' — custom domain (soap.harmonic-systems.org) serves from the root.
export default defineConfig({
  base: '/',
  plugins: [
    svelte(),
    VitePWA({
      // 'prompt': never auto-reload — a live session must not be interrupted (spec §8).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'CNAME'],
      manifest: {
        name: 'SOAP Note Builder',
        short_name: 'SOAP Notes',
        description:
          'Local-first SOAP note builder for school-based SLPs. All data stays on this device, encrypted.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#3a5a78',
        background_color: '#f6f4f0',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html'
      }
    })
  ],
  build: {
    target: 'es2020',
    sourcemap: false
  }
})
