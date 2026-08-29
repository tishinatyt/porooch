import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Icon, type IconName } from '@/components/icons'
import BrandLogo from '@/components/BrandLogo'
import { useUnreadMessages } from '@/contexts/UnreadMessagesContext'

const primaryItems: { to: string; label: string; icon: IconName; primary?: boolean; unread?: boolean }[] = [
  { to: '/', label: 'Головна', icon: 'home' },
  { to: '/create', label: 'Додати подію', icon: 'plus', primary: true },
  { to: '/chats', label: 'Повідомлення', icon: 'message', unread: true },
]

const profileItem = { to: '/profile', label: 'Профіль', icon: 'user' as IconName }

export default function AppSidebar() {
  const { profile } = useAuth()
  const { unreadCount } = useUnreadMessages()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-brand-border bg-white px-3 py-5 lg:flex xl:w-60">
      <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-3" aria-label="porooch — головна">
        <BrandLogo wordmarkClassName="text-xl" />
      </NavLink>

      <nav className="space-y-1" aria-label="Головна навігація">
        {primaryItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
              item.primary
                ? 'my-2 bg-brand-accent text-white shadow-[0_4px_12px_rgba(104,70,255,0.18)] hover:bg-brand-accent-hover'
                : isActive ? 'bg-brand-accent-soft text-brand-accent' : 'text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
            {item.unread && unreadCount > 0 && (
              <span
                className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1.5 text-[10px] font-extrabold leading-none text-white"
                aria-label={`${unreadCount} непрочитані повідомлення`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
        <NavLink to="/my-events" className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${isActive ? 'bg-brand-accent-soft text-brand-accent' : 'text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink'}`}><Icon name="calendar" className="h-4.5 w-4.5"/>Мої події</NavLink>
        <NavLink to={profileItem.to} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${isActive ? 'bg-brand-accent-soft text-brand-accent' : 'text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink'}`}><Icon name={profileItem.icon} className="h-4.5 w-4.5"/>{profileItem.label}</NavLink>
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-brand-border px-2 pt-4">
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-brand-accent-soft">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm font-bold text-brand-accent">
              {profile?.name?.charAt(0).toUpperCase() ?? 'L'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-brand-ink">{profile?.name ?? 'Користувач'}</p>
          <p className="truncate text-xs text-brand-ink-muted">{profile?.city || 'Україна'}</p>
        </div>
      </div>
    </aside>
  )
}
