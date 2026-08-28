import { useNavigate } from 'react-router-dom'
import EventMedia from '@/components/EventMedia'
import { Icon } from '@/components/icons'
import ParticipantAvatars from '@/components/home/ParticipantAvatars'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'

const CATEGORY_LABEL: Record<string, string> = { cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт', music: 'Музика', food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше' }
const GENDER_LABEL: Record<string, string> = { any: 'Для всіх', male: 'Хлопці', female: 'Дівчата' }

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MetaRow({ icon, children }: { icon: 'pin' | 'clock'; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2 text-xs leading-4 text-brand-ink-muted lg:text-[13px]"><span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg bg-brand-surface-muted text-brand-accent"><Icon name={icon} className="h-3.5 w-3.5"/></span><span className="truncate">{children}</span></div>
}

export function PersonalEventCard({ event, management = false }: { event: PersonalEventData; management?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  const visibleUsers = participantUsers.length > 0 ? participantUsers : event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : []
  const participantCount = event.participant_count ?? event.participants.length

  return (
    <article className="h-full rounded-2xl border border-[#e5defe] bg-gradient-to-br from-white to-[#f7f4ff] p-3.5 shadow-card transition hover:border-[#d5cafd] hover:shadow-card-hover sm:p-4">
      <div className="mb-2.5 flex items-center gap-2.5 sm:mb-3 sm:gap-3">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-brand-accent-soft text-sm font-extrabold text-brand-accent shadow-sm sm:h-11 sm:w-11">
          {event.organizer?.avatar_url ? <img src={event.organizer.avatar_url} alt={event.organizer.name} className="h-full w-full object-cover" /> : event.organizer?.name?.charAt(0).toUpperCase() ?? 'О'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-brand-ink lg:text-[15px]">{event.organizer?.name ?? 'Організатор'}{event.organizer?.age ? `, ${event.organizer.age}` : ''}</p>
          <p className="mt-0.5 text-[10px] font-medium text-brand-ink-muted">Запрошує на особисту зустріч</p>
        </div>
        <span className="rounded-full border border-brand-accent/10 bg-brand-accent-soft px-2.5 py-1 text-[10px] font-extrabold text-brand-accent">Особиста</span>
      </div>

      <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="block w-full text-left">
        <h3 className="mb-2 text-[17px] font-extrabold leading-[1.2] tracking-[-0.025em] text-brand-ink sm:mb-2.5 sm:text-[18px] lg:text-[19px]">{event.title}</h3>
        <div className="space-y-1 sm:space-y-1.5"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km != null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>
      </button>

      <div className="mt-2.5 flex flex-wrap gap-1 sm:mt-3 sm:gap-1.5">
        <span className="rounded-lg border border-[#ebe7f6] bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-soft sm:px-2.5 sm:py-1.5">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        <span className="rounded-lg border border-[#ebe7f6] bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-soft sm:px-2.5 sm:py-1.5">{event.min_age}–{event.max_age} · {GENDER_LABEL[event.gender_filter] ?? event.gender_filter}</span>
        <span className="rounded-lg border border-brand-accent/10 bg-brand-accent-soft px-2 py-1 text-[10px] font-extrabold text-brand-accent sm:px-2.5 sm:py-1.5">{event.join_mode === 'approval' ? 'За запитом' : 'Вільний вступ'}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#e7e1fa] pt-2.5 sm:mt-3.5 sm:pt-3">
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
    <article className={`group h-full overflow-hidden rounded-2xl border bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-border-strong hover:shadow-card-hover ${isNew ? 'border-brand-accent/50 ring-2 ring-brand-accent/10' : 'border-brand-border'}`}>
      <button type="button" onClick={openEvent} aria-label={`Відкрити подію «${event.title}»`} className="relative block h-32 w-full overflow-hidden bg-brand-surface-muted text-left sm:h-36 xl:h-40">
        <EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} className="h-full w-full" imageClassName="transition duration-300 group-hover:scale-[1.025]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/25 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-lg border border-white/30 bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-brand-accent shadow-sm backdrop-blur">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        {isNew && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-brand-accent shadow-sm">НОВА</span>}
      </button>

      <div className="flex min-w-0 flex-col p-4 sm:px-[18px] sm:pb-[18px]">
        <button type="button" onClick={openEvent} className="text-left"><h3 className="line-clamp-2 text-[18px] font-extrabold leading-[1.2] tracking-[-0.025em] text-brand-ink sm:text-[19px] lg:text-xl">{event.title}</h3></button>
        <div className="mt-3 space-y-1.5"><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}{event.distance_km !== null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</MetaRow></div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-brand-border pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <ParticipantAvatars users={participantUsers} totalCount={event.participant_count} />
            <p className="truncate text-[11px] font-bold text-brand-ink-soft">{event.participant_count}/{event.max_participants} учасників</p>
          </div>
          <button type="button" onClick={openEvent} className="h-11 min-w-[92px] flex-shrink-0 rounded-xl bg-brand-accent px-4 text-xs font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">Деталі</button>
        </div>
      </div>
    </article>
  )
}
