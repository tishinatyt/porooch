import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/components/icons'

const tabs: { to: string; label: string; icon: IconName; primary?: boolean; hashOnly?: boolean }[] = [
  { to: '/', label: 'Головна', icon: 'home' },
  { to: '/#search', label: 'Пошук', icon: 'search', hashOnly: true },
  { to: '/create', label: 'Створити', icon: 'plus', primary: true },
  { to: '/chats', label: 'Чати', icon: 'message' },
  { to: '/profile', label: 'Профіль', icon: 'user' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-brand-border bg-white/95 pb-safe shadow-[0_-8px_30px_rgba(23,23,28,0.06)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/' || tab.to.startsWith('/#')}
            aria-label={tab.label}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-semibold transition-colors ${
                isActive && !tab.hashOnly ? 'text-brand-accent' : 'text-brand-ink-muted'
              }`
            }
          >
            <span className={tab.primary ? '-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-brand-accent text-white shadow-[0_8px_24px_rgba(104,70,255,0.24)]' : 'grid h-6 w-6 place-items-center'}>
              <Icon name={tab.icon} className={tab.primary ? 'h-6 w-6' : 'h-5 w-5'} />
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
