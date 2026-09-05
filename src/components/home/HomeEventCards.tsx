import { useNavigate } from 'react-router-dom'
import EventMedia from '@/components/EventMedia'
import { Icon } from '@/components/icons'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'
import ProfileAvatar from '@/components/ProfileAvatar'
import { getEventAccessLabel } from '@/lib/eventAccess'

const CATEGORY_LABEL: Record<string, string> = { cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт', music: 'Музика', food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше' }
const GENDER_LABEL: Record<string, string> = { any: 'Для всіх', male: 'Хлопці', female: 'Дівчата' }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MetaRow({ icon, children }: { icon: 'pin' | 'clock'; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium leading-4 text-brand-ink-muted sm:text-xs"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg bg-[#f4f3f7] text-brand-ink-muted"><Icon name={icon} className="h-3.5 w-3.5"/></span><span className="truncate">{children}</span></div>
}

export function PersonalEventCard({ event, management = false }: { event: PersonalEventData; management?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  const visibleUsers = participantUsers.length > 0 ? participantUsers : event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : []
  const participantCount = event.participant_count ?? event.participants.length

  return (
    <article className="home-event-card h-full rounded-[20px] border border-[#d8d0e7] bg-white p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:border-[#c7b9df] sm:p-4">
      <div className="mb-3 flex items-center gap-2.5 sm:gap-3">
        {event.organizer ? <ProfileAvatar profile={{ id: event.organizer.id, name: event.organizer.name, age: event.organizer.age, avatar_url: event.organizer.avatar_url }} className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-brand-accent-soft text-sm font-extrabold text-brand-accent shadow-[0_2px_8px_rgba(62,44,105,0.14)]" /> : <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-brand-accent-soft text-sm font-extrabold text-brand-accent shadow-[0_2px_8px_rgba(62,44,105,0.14)]">О</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-brand-ink sm:text-[15px]">{event.organizer?.name ?? 'Організатор'}{event.organizer?.age ? `, ${event.organizer.age}` : ''}</p>
          <p className="mt-0.5 text-[10px] font-medium text-brand-ink-muted">Запрошує на особисту зустріч</p>
        </div>
        <span className="rounded-full border border-[#e5dff1] bg-[#f7f4fb] px-2.5 py-1 text-[10px] font-bold text-brand-ink-soft">Особиста</span>
      </div>

      <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="block w-full text-left">
        <h3 className="mb-2.5 text-[18px] font-extrabold leading-[1.18] tracking-[-0.03em] text-brand-ink sm:text-[19px] lg:text-xl">{event.title}</h3>
        <div className="space-y-1.5"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km != null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-lg border border-[#ebe7f0] bg-[#faf9fc] px-2.5 py-1 text-[10px] font-semibold text-brand-ink-soft">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        <span className="rounded-lg border border-[#ebe7f0] bg-[#faf9fc] px-2.5 py-1 text-[10px] font-semibold text-brand-ink-soft">{event.min_age}–{event.max_age} · {GENDER_LABEL[event.gender_filter] ?? event.gender_filter}</span>
        <span className="rounded-lg border border-[#e2dcf3] bg-[#f6f3ff] px-2.5 py-1 text-[10px] font-bold text-brand-accent">{getEventAccessLabel(event)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#ece8f2] pt-3">
        <div className="flex min-w-0 items-center gap-2"><ParticipantAvatars users={visibleUsers} totalCount={participantCount}/><span className="truncate text-[11px] font-semibold text-brand-ink-muted">{participantCount}/{event.max_participants} учасників</span></div>
        <div className="flex gap-1.5">
          {management && <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="h-10 rounded-xl border border-brand-border px-3 text-[11px] font-bold text-brand-ink-soft transition hover:border-brand-accent hover:text-brand-accent">Деталі</button>}
          <button type="button" onClick={() => navigate(management && event.participationStatus === 'joined' ? `/event/${event.eventId}/chat` : `/event/${event.eventId}`)} className="h-10 rounded-xl bg-brand-accent px-3.5 text-[11px] font-bold text-white transition hover:bg-brand-accent-hover">{management && event.participationStatus === 'joined' ? 'Чат' : event.participationStatus === 'pending' ? 'Очікує' : 'Деталі'}</button>
        </div>
      </div>
    </article>
  )
}

export function PublicEventCard({ event, isNew = false }: { event: PublicEventData; isNew?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants ?? (event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : [])
  const openEvent = () => navigate(`/event/${event.id}`)

  return (
    <article className={`home-event-card group h-full overflow-hidden rounded-[20px] border bg-white transition-[transform,box-shadow,border-color] duration-200 hover:border-[#c9bedb] ${isNew ? 'border-brand-accent/50 ring-2 ring-brand-accent/10' : 'border-[#d9d2e4]'}`}>
      <button type="button" onClick={openEvent} aria-label={`Відкрити подію «${event.title}»`} className="relative block h-32 w-full overflow-hidden bg-brand-surface-muted text-left sm:h-36 xl:h-40">
        <EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} className="h-full w-full" imageClassName="transition duration-300 group-hover:scale-[1.025]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-[10px] border border-white/50 bg-white/92 px-2.5 py-1 text-[10px] font-extrabold text-brand-accent shadow-sm">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        {isNew && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-brand-accent shadow-sm">НОВА</span>}
      </button>

      <div className="flex min-w-0 flex-col p-3.5 sm:p-4">
        <button type="button" onClick={openEvent} className="text-left"><h3 className="line-clamp-2 text-[19px] font-extrabold leading-[1.18] tracking-[-0.03em] text-brand-ink sm:text-xl lg:text-[21px]">{event.title}</h3></button>
        <div className="mt-2.5 space-y-1.5"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km !== null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ece9f0] pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars users={participantUsers} totalCount={event.participant_count} />
            <div className="min-w-0"><p className="truncate text-[11px] font-bold text-brand-ink-soft">{event.participant_count}/{event.max_participants} учасників</p><p className="mt-0.5 truncate text-[10px] font-semibold text-brand-accent">{getEventAccessLabel(event)}</p></div>
          </div>
          <button type="button" onClick={openEvent} className="h-10 min-w-[88px] flex-shrink-0 rounded-xl bg-brand-accent px-4 text-xs font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Деталі</button>
        </div>
      </div>
    </article>
  )
}
