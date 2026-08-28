import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/porooch/' : '/'

  return {
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'porooch',
        short_name: 'porooch',
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
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['demo-avatars/**', 'icons/*.png'],
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
