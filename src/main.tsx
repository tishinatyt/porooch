import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Older builds cached authenticated Supabase GET responses. Remove that cache
// before rendering so sessions on shared devices cannot receive stale data.
if ('caches' in window) void window.caches.delete('supabase-cache')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
