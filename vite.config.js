import { defineConfig } from 'vite'
// Preact with its React-compatible layer: the app is written against React's
// API, but ships Preact (about a tenth of the size).
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// Content Security Policy, injected into index.html for production builds
// (GitHub Pages cannot send headers, so it ships as a meta tag). The dev
// server injects inline scripts this would block, so it is build-only.
// Forge Fast talks to no server at all: everything is 'self'.
function cspPlugin() {
  return {
    name: 'forge-fast-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ')
      return { html, tags: [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }] }
    },
  }
}

// Served from https://<user>.github.io/forge-fast/ on GitHub Pages.
const base = '/forge-fast/'

export default defineConfig({
  base,
  plugins: [
    preact(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
      },
      manifest: {
        name: 'Forge Fast — Fasting Timer',
        short_name: 'Forge Fast',
        description: 'Intermittent fasting timer with plans from 13:11 to OMAD, the body’s fasting stages, streaks and history.',
        theme_color: '#111315',
        background_color: '#111315',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        // Long-press the home-screen icon for these (Android; iOS ignores them).
        shortcuts: [
          { name: 'Start fast', short_name: 'Start', url: `${base}#/?do=start`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'End fast', short_name: 'End', url: `${base}#/?do=end`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'History', short_name: 'History', url: `${base}#/history`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
