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
  return <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-brand-ink-muted"><Icon name={icon} className="h-3.5 w-3.5 flex-shrink-0"/><span className="truncate">{children}</span></div>
}

export function PersonalEventCard({ event, management = false }: { event: PersonalEventData; management?: boolean }) {
  const navigate = useNavigate()
  const participantUsers = event.participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  const visibleUsers = participantUsers.length > 0 ? participantUsers : event.organizer ? [{ id: event.organizer.id, name: event.organizer.name, avatar_url: event.organizer.avatar_url }] : []
  const participantCount = event.participant_count ?? event.participants.length

  return (
    <article className="rounded-2xl border border-[#e9e3ff] bg-[#f8f6ff] p-3.5 shadow-card transition hover:border-[#dcd3ff]">
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-white text-xs font-bold text-brand-accent">
          {event.organizer?.avatar_url ? <img src={event.organizer.avatar_url} alt={event.organizer.name} className="h-full w-full object-cover" /> : event.organizer?.name?.charAt(0).toUpperCase() ?? 'О'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-brand-ink">{event.organizer?.name ?? 'Організатор'}{event.organizer?.age ? `, ${event.organizer.age}` : ''}</p>
          <p className="text-[10px] text-brand-ink-muted">Запрошує вас на подію</p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-brand-accent">Ведучий</span>
      </div>

      <button type="button" onClick={() => navigate(`/event/${event.eventId}`)} className="block w-full text-left">
        <h3 className="mb-2 text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-brand-ink">{event.title}</h3>
        {event.description && <p className="mb-2 line-clamp-2 text-xs leading-5 text-brand-ink-soft">{event.description}</p>}
        <div className="space-y-1"><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}</MetaRow><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow></div>
      </button>

      <div className="mt-2.5 flex flex-wrap gap-1">
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-soft">{CATEGORY_LABEL[event.category] ?? event.category}</span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-soft">{event.min_age}–{event.max_age} років</span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-brand-ink-soft">{GENDER_LABEL[event.gender_filter] ?? event.gender_filter}</span>
        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-brand-accent">{event.join_mode === 'approval' ? 'За підтвердженням' : 'Одразу'}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e7e1fa] pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5"><ParticipantAvatars users={visibleUsers} totalCount={participantCount}/><span className="truncate text-[10px] text-brand-ink-muted">{participantCount}/{event.max_participants} учасників{event.distance_km != null ? ` · ${event.distance_km.toFixed(1)} км` : ''}</span></div>
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
    <article className={`group flex min-h-[154px] overflow-hidden rounded-2xl border bg-white shadow-card transition hover:border-brand-border-strong ${isNew ? 'border-brand-accent/50 ring-2 ring-brand-accent/10' : 'border-brand-border'}`}>
      <button type="button" onClick={openEvent} className="relative block w-[118px] flex-shrink-0 overflow-hidden bg-brand-surface-muted text-left sm:w-[168px]">
        <EventMedia category={event.category} coverUrl={event.cover_photo_url} alt={event.cover_photo_url ? event.title : ''} className="h-full min-h-40 w-full" imageClassName="transition duration-300 group-hover:scale-[1.02]" />
        {isNew && <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-brand-accent shadow-sm">НОВА</span>}
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:px-3.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <span className="rounded-md bg-brand-accent-soft px-2 py-1 text-[10px] font-bold text-brand-accent">{CATEGORY_LABEL[event.category] ?? event.category}</span>
          <button type="button" disabled title={event.isDemo ? 'Недоступно для демонстраційної події' : 'Збереження з’явиться незабаром'} className="-mr-1 -mt-1 cursor-not-allowed rounded-md p-1 text-brand-ink-muted opacity-55" aria-label="Зберегти подію"><Icon name="bookmark" className="h-4 w-4"/></button>
        </div>
        <button type="button" onClick={openEvent} className="text-left"><h3 className="line-clamp-2 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-brand-ink">{event.title}</h3></button>
        <div className="mt-1.5 space-y-0.5"><MetaRow icon="pin">{event.address_text || 'Місце не вказано'}</MetaRow><MetaRow icon="clock">{formatDateTime(event.event_datetime)}</MetaRow></div>

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <ParticipantAvatars users={participantUsers} totalCount={event.participant_count} />
            <div className="min-w-0"><p className="truncate text-[10px] font-bold text-brand-ink">{event.participant_count} учасників</p>{event.distance_km !== null && <p className="truncate text-[9px] text-brand-ink-muted">{event.distance_km.toFixed(1)} км від вас</p>}</div>
          </div>
          <button type="button" onClick={openEvent} className="h-10 flex-shrink-0 rounded-xl bg-brand-accent px-3 text-[11px] font-bold text-white transition hover:bg-brand-accent-hover">Деталі</button>
        </div>
      </div>
    </article>
  )
}
