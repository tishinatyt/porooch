import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(() => {
  const base = '/'
  const buildId = process.env.PWA_BUILD_ID ?? `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(buildId)) throw new Error('Invalid PWA_BUILD_ID')
  const runtimeFile = `pwa-runtime-${buildId}.js`

  return {
  base,
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    {
      name: 'poruch-pwa-version',
      apply: 'build',
      transformIndexHtml() { return [{ tag: 'meta', attrs: { name: 'poruch-build', content: buildId }, injectTo: 'head' as const }] },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildId }) })
        this.emitFile({ type: 'asset', fileName: runtimeFile, source: readFileSync(resolve(__dirname, 'pwa/runtime.js'), 'utf8').replaceAll('__PORUCH_BUILD_ID__', buildId) })
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Poruch',
        short_name: 'Poruch',
        description: 'Події та люди поруч',
        lang: 'uk',
        theme_color: '#6846FF',
        background_color: '#F7F7FA',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        id: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        globIgnores: ['demo-avatars/**'],
        importScripts: [runtimeFile],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      }
    })
  ],
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('leaflet')) return 'leaflet'
          if (id.includes('@supabase')) return 'supabase'
        }
      }
    }
  }
  }
})
