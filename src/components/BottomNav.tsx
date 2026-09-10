import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/components/icons'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'
import { useMyEventsContext } from '@/contexts/MyEventsContext'

const tabs: { to: string; label: string; icon: IconName; primary?: boolean; badge?: 'messages' | 'events' }[] = [
  { to: '/', label: 'Головна', icon: 'home' },
  { to: '/my-events', label: 'Мої події', icon: 'calendar', badge: 'events' },
  { to: '/create', label: 'Додати', icon: 'plus', primary: true },
  { to: '/chats', label: 'Чати', icon: 'message', badge: 'messages' },
  { to: '/profile', label: 'Профіль', icon: 'user' },
]

export default function BottomNav() {
  const { unreadCount } = useUnreadMessages()
  const { events: myEvents, loading: myEventsLoading, pendingRequestCount } = useMyEventsContext()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-brand-border bg-white/95 pb-safe shadow-[0_-8px_30px_rgba(23,23,28,0.06)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            aria-label={tab.label}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-brand-accent' : 'text-brand-ink-muted'
              }`
            }
          >
            <span className={tab.primary ? '-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-brand-accent text-white shadow-[0_8px_24px_rgba(104,70,255,0.24)]' : 'relative grid h-6 w-6 place-items-center'}>
              <Icon name={tab.icon} className={tab.primary ? 'h-6 w-6' : 'h-5 w-5'} />
              {tab.badge === 'messages' && unreadCount > 0 && <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[8px] font-extrabold leading-none text-white" aria-label={`${unreadCount} непрочитані повідомлення`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
              {tab.badge === 'events' && !myEventsLoading && myEvents.length > 0 && <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[8px] font-extrabold leading-none text-white" aria-label={`${myEvents.length} подій у розділі Мої події`}>{myEvents.length > 99 ? '99+' : myEvents.length}</span>}
              {tab.badge === 'events' && !myEventsLoading && pendingRequestCount > 0 && <span className="absolute -bottom-2 -right-2.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-1 text-[8px] font-extrabold leading-none text-amber-900" aria-label={`${pendingRequestCount} запитів на участь очікують розгляду`}>{pendingRequestCount > 99 ? '99+' : pendingRequestCount}</span>}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
