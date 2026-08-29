import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNav from '@/components/BottomNav'
import HomeScreen from '@/pages/HomeScreen'
import Profile from '@/pages/Profile'
import EventDetail from '@/pages/EventDetail'
import EventChat from '@/pages/EventChat'
import Chats from '@/pages/Chats'
import CreateEvent from '@/pages/CreateEvent'
import AppSidebar from '@/components/AppSidebar'
import MyEvents from '@/pages/MyEvents'
import { UnreadMessagesProvider } from '@/contexts/UnreadMessagesContext'
import { ProfilePreviewProvider } from '@/contexts/ProfilePreviewContext'
import PublicProfile from '@/pages/PublicProfile'

// Routes with their own full-screen bottom CTA — BottomNav would cover them
const HIDE_NAV_PATTERNS = [/^\/event\//]

function AppLayout() {
  const { pathname } = useLocation()
  const isCreateEvent = pathname === '/create'
  const hideNav = isCreateEvent || HIDE_NAV_PATTERNS.some((re) => re.test(pathname))
  const isEventDetail = /^\/event\/[^/]+$/.test(pathname)
  const isEventChat = /^\/event\/[^/]+\/chat$/.test(pathname)
  const showDesktopShell = !hideNav || isEventDetail || isEventChat || isCreateEvent

  return (
    <>
      {showDesktopShell && <AppSidebar />}
      <main className={showDesktopShell ? 'lg:pl-56 xl:pl-60' : ''}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/event/:id/chat" element={<EventChat />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/my-events" element={<MyEvents />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <AuthProvider>
        <ProtectedRoute>
          <UnreadMessagesProvider>
            <ProfilePreviewProvider>
              <AppLayout />
            </ProfilePreviewProvider>
          </UnreadMessagesProvider>
        </ProtectedRoute>
      </AuthProvider>
    </BrowserRouter>
  )
}
