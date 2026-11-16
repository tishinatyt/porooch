import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerPwaUpdates } from '@/lib/pwaUpdates'
import './index.css'
import App from './App'
import { initializeAnalytics } from '@/lib/analytics'

// Older builds cached authenticated Supabase GET responses. Remove that cache
// before rendering so sessions on shared devices cannot receive stale data.
if ('caches' in window) void window.caches.delete('supabase-cache')

initializeAnalytics()

if (import.meta.env.PROD) void registerPwaUpdates(__APP_BUILD_ID__, import.meta.env.BASE_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
