import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getCurrentPosition } from '@/lib/geo'
import TopBar from '@/components/TopBar'
import { PersonalEventCard, PublicEventCard } from '@/components/home/HomeEventCards'
import { CategoryChips } from '@/components/home/HomeControls'
import HomeCarousel from '@/components/home/HomeCarousel'
import HomeBackgroundDecorations from '@/components/home/HomeBackgroundDecorations'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'
import { DEMO_EVENTS_ENABLED, DEMO_PERSONAL_EVENTS, DEMO_PUBLIC_EVENTS, PUBLIC_CATEGORIES } from '@/components/home/demoEvents'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  cinema: 'Кіно', theatre: 'Театр', bar: 'Бар', sport: 'Спорт',
  music: 'Музика', food: 'Їжа', games: 'Ігри', walk: 'Прогулянка',
  art: 'Мистецтво', communication: 'Спілкування', other: 'Інше',
}

const TABS = [
  { key: 'all',     label: 'Усі' },
  { key: 'cinema',  label: 'Кіно' },
  { key: 'theatre', label: 'Театр' },
  { key: 'bar',     label: 'Бар' },
  { key: 'sport',   label: 'Спорт' },
  { key: 'music',   label: 'Музика' },
  { key: 'other',   label: 'Інше' },
]

const PAGE_SIZE = 10

const RADIUS_OPTIONS = [
  { value: 1,  label: '1 км' },
  { value: 3,  label: '3 км' },
  { value: 5,  label: '5 км' },
  { value: 10, label: '10 км' },
  { value: 50, label: 'Вся Чернігівщина' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(event: Pick<PublicEventData, 'title' | 'category' | 'address_text' | 'organizer'>, query: string) {
  const normalized = query.trim().toLocaleLowerCase('uk-UA')
  if (!normalized) return true
  const category = CATEGORY_LABEL[event.category] ?? event.category
  return [event.title, category, event.address_text, event.organizer?.name ?? '']
    .some((value) => value.toLocaleLowerCase('uk-UA').includes(normalized))
}

function isEligible(event: PublicEventData, age: number | undefined, gender: string | undefined) {
  const ageMatches = !age || age < 1 || (age >= event.min_age && age <= event.max_age)
  const genderMatches = !gender || gender === 'any' || event.gender_filter === 'any' || event.gender_filter === gender
  return ageMatches && genderMatches
}

function sortDiscovery(left: PublicEventData, right: PublicEventData) {
  if (left.distance_km !== null && right.distance_km !== null && left.distance_km !== right.distance_km) {
    return left.distance_km - right.distance_km
  }
  if (left.distance_km !== null && right.distance_km === null) return -1
  if (left.distance_km === null && right.distance_km !== null) return 1
  return new Date(left.event_datetime).getTime() - new Date(right.event_datetime).getTime()
}

function asPersonalEvent(event: PublicEventData): PersonalEventData {
  return {
    eventId: event.id,
    title: event.title,
    category: event.category,
    address_text: event.address_text,
    event_datetime: event.event_datetime,
    created_at: event.created_at ?? event.event_datetime,
    min_age: event.min_age,
    max_age: event.max_age,
    gender_filter: event.gender_filter,
    cover_photo_url: event.cover_photo_url,
    max_participants: event.max_participants,
    organizer: event.organizer,
    participants: (event.participants ?? []).map((person) => ({ user_id: person.id, user: person })),
    participant_count: event.participant_count,
    distance_km: event.distance_km,
    join_mode: event.join_mode,
    is_public: event.is_public,
    description: event.description,
    isDemo: event.isDemo,
  }
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { supaUser, profile } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [publicPage, setPublicPage] = useState(1)
  const [radiusKm, setRadiusKm] = useState(5)

  const [allDiscoveryEvents, setAllDiscoveryEvents] = useState<PublicEventData[]>([])
  const [excludedEventIds, setExcludedEventIds] = useState<Set<string>>(new Set())

  const [loadingDiscovery, setLoadingDiscovery] = useState(true)
  const [discoveryError, setDiscoveryError] = useState(false)
  const [newEventId, setNewEventId] = useState<string | null>(null)

  const fetchDiscoveryEvents = useCallback(async () => {
    if (!supaUser) return
    setLoadingDiscovery(true)
    setDiscoveryError(false)

    const geo = await getCurrentPosition()
    const [nearbyResult, participationResult] = await Promise.all([
      supabase.rpc('events_nearby', { user_lat: geo.lat, user_lng: geo.lng, radius_km: 100 }),
      supabase.from('event_participants').select('event_id, status, role').eq('user_id', supaUser.id).in('status', ['joined', 'pending']),
    ])

    if (nearbyResult.error) {
      console.error('[fetchDiscoveryEvents] nearby error:', {
        code: nearbyResult.error.code,
        message: nearbyResult.error.message,
        details: nearbyResult.error.details,
        hint: nearbyResult.error.hint,
      })
      setAllDiscoveryEvents([])
      setExcludedEventIds(new Set())
      setDiscoveryError(true)
      setLoadingDiscovery(false)
      return
    }
    if (participationResult.error) {
      console.error('[fetchDiscoveryEvents] participation error:', {
        code: participationResult.error.code,
        message: participationResult.error.message,
        details: participationResult.error.details,
        hint: participationResult.error.hint,
      })
    }

    const nearbyRows = (nearbyResult.data ?? []) as Record<string, unknown>[]
    const ids = nearbyRows.map((row) => row.id as string)
    const typeById = new Map<string, { event_type: 'personal' | 'public'; join_mode: 'open' | 'approval'; is_public: boolean }>()

    if (ids.length > 0) {
      const { data: typeRows, error: typeError } = await supabase
        .from('events')
        .select('id, event_type, join_mode, is_public')
        .in('id', ids)
      if (typeError) {
        console.error('[fetchDiscoveryEvents] event type error:', {
          code: typeError.code,
          message: typeError.message,
          details: typeError.details,
          hint: typeError.hint,
        })
        setAllDiscoveryEvents([])
        setExcludedEventIds(new Set())
        setDiscoveryError(true)
        setLoadingDiscovery(false)
        return
      }
      for (const row of typeRows ?? []) {
        typeById.set(row.id, {
          event_type: (row.event_type ?? 'public') as 'personal' | 'public',
          join_mode: (row.join_mode ?? 'open') as 'open' | 'approval',
          is_public: row.is_public ?? true,
        })
      }
    }

    const excludedIds = new Set((participationResult.data ?? []).filter((row) => row.role === 'participant').map((row) => row.event_id))
    setExcludedEventIds(excludedIds)

    const events: PublicEventData[] = nearbyRows.map((row) => {
      const e = row as Record<string, unknown>
      const metadata = typeById.get(e.id as string)
      return {
        id: e.id,
        title: e.title,
        category: e.category,
        address_text: e.address_text,
        event_datetime: e.event_datetime,
        created_at: e.created_at,
        min_age: e.min_age,
        max_age: e.max_age,
        gender_filter: e.gender_filter,
        cover_photo_url: e.cover_photo_url,
        max_participants: e.max_participants,
        participant_count: e.participant_count ?? 0,
        distance_km: e.distance_km ?? null,
        organizer: (e.organizer ?? null) as PublicEventData['organizer'],
        event_type: metadata?.event_type ?? 'public',
        join_mode: metadata?.join_mode ?? 'open',
        is_public: metadata?.is_public ?? (e.is_public as boolean | undefined) ?? true,
      } as PublicEventData
    })
    events.sort(sortDiscovery)
    setAllDiscoveryEvents(events)
    setLoadingDiscovery(false)
  }, [supaUser])

  useEffect(() => { void fetchDiscoveryEvents() }, [fetchDiscoveryEvents])

  // Re-fetch authoritative discovery data for inserts, edits/cancellation, and deletes.

  useEffect(() => {
    const channel = supabase
      .channel('events-discovery-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const insertedId = (payload.new as { id?: string }).id
            if (insertedId) {
              setNewEventId(insertedId)
              setTimeout(() => setNewEventId(null), 3000)
            }
          }
          void fetchDiscoveryEvents()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchDiscoveryEvents])

  // ── Realtime: participant count changes ───────────────────────────────────

  useEffect(() => {
    const participantsChannel = supabase
      .channel('event-participants-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_participants' },
        () => { void fetchDiscoveryEvents() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_participants' },
        () => {
          void fetchDiscoveryEvents()
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_participants' },
        () => {
          void fetchDiscoveryEvents()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(participantsChannel) }
  }, [fetchDiscoveryEvents])

  // ── Derived / filtered lists ───────────────────────────────────────────────

  const eligibleDiscovery = allDiscoveryEvents
    .filter((event) => !excludedEventIds.has(event.id))
    .filter((event) => isEligible(event, profile?.age, profile?.gender))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery))

  const realPersonalEvents = eligibleDiscovery
    .filter((event) => event.event_type === 'personal')

  const realPersonalIds = new Set(realPersonalEvents.map((event) => event.id))
  const personalDemoLimit = realPersonalEvents.length >= 3 ? 0 : 4 - realPersonalEvents.length
  const personalDemoFallbacks = (DEMO_EVENTS_ENABLED ? DEMO_PERSONAL_EVENTS : [])
    .filter((event) => !realPersonalIds.has(event.id))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery))
    .slice(0, personalDemoLimit)
  const personalEvents = [...realPersonalEvents, ...personalDemoFallbacks].map(asPersonalEvent)

  const realPublic = eligibleDiscovery
    .filter((event) => event.event_type === 'public')
    .filter((e) => selectedCategory === 'all' || e.category === selectedCategory)

  const categoriesWithRealEvents = new Set(realPublic.map((event) => event.category))
  const demoFallbacks = (DEMO_EVENTS_ENABLED ? DEMO_PUBLIC_EVENTS : []).filter((event) =>
    (selectedCategory === 'all' ? PUBLIC_CATEGORIES.includes(event.category as typeof PUBLIC_CATEGORIES[number]) : event.category === selectedCategory)
    && !categoriesWithRealEvents.has(event.category)
    && (event.distance_km === null || event.distance_km <= radiusKm)
    && matchesSearch(event, searchQuery)
  )
  const filteredPublic = [...realPublic, ...demoFallbacks]

  const shownPublic = filteredPublic.slice(0, publicPage * PAGE_SIZE)
  const hasMorePublic = filteredPublic.length > publicPage * PAGE_SIZE

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-home-bg pb-24 text-brand-ink lg:flex lg:h-screen lg:min-h-0 lg:flex-col lg:pb-0">
      <HomeBackgroundDecorations />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        radiusKm={radiusKm}
        onRadiusChange={(value) => { setRadiusKm(value); setPublicPage(1) }}
        radiusOptions={RADIUS_OPTIONS}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 sm:py-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-7 lg:py-6 xl:px-10">
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 sm:gap-7 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(280px,0.4fr)_minmax(0,0.6fr)] lg:items-stretch lg:gap-6 xl:grid-cols-[minmax(340px,0.4fr)_minmax(0,0.6fr)] xl:gap-7">
          <section className="min-w-0 rounded-[22px] border border-[#c9bfdd] bg-home-tape-lavender p-2 pb-1.5 shadow-[0_8px_28px_rgba(64,45,112,0.07)] sm:p-3 sm:pb-1.5 lg:flex lg:min-h-0 lg:flex-col">
            {loadingDiscovery && <HomeCarousel id="personal-events-loading" label="Завантаження особистих зустрічей" className="lg:space-y-3">{[1, 2, 3].map((item) => <div role="listitem" key={item} className="h-56 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</HomeCarousel>}
            {!loadingDiscovery && personalEvents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center lg:flex-1"><p className="text-sm font-bold text-brand-ink">{discoveryError ? 'Не вдалося завантажити події.' : 'Поки немає особистих подій поруч.'}</p>{!discoveryError && <Link to="/create" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-brand-accent px-4 text-xs font-bold text-white transition hover:bg-brand-accent-hover">Створити подію</Link>}</div>
            )}
            {!loadingDiscovery && personalEvents.length > 0 && <HomeCarousel id="personal-events-carousel" label="Особисті зустрічі поруч" className="gap-3.5 lg:space-y-3.5">{personalEvents.map((event) => <div role="listitem" key={event.eventId} className="w-[88%] flex-none snap-start [scroll-snap-stop:always] min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PersonalEventCard event={event} /></div>)}</HomeCarousel>}

            <div className="mt-1 flex flex-none items-center gap-1.5 border-t border-[#ddd5ed] pt-1.5">
              <h1 className="text-sm font-extrabold tracking-[-0.02em] text-brand-ink">Особисті зустрічі</h1>
              {!loadingDiscovery && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-ink-muted" aria-label={`${personalEvents.length} особистих зустрічей`}>{personalEvents.length}</span>}
            </div>
          </section>

          <section className="min-w-0 rounded-[22px] border border-[#dbc9c0] bg-home-tape-peach p-2 pb-1.5 shadow-[0_8px_28px_rgba(92,61,43,0.06)] sm:p-3 sm:pb-1.5 lg:flex lg:min-h-0 lg:flex-col">
            {loadingDiscovery && <HomeCarousel id="public-events-loading" label="Завантаження публічних подій" className="lg:space-y-3">{[1, 2, 3, 4].map((item) => <div role="listitem" key={item} className="h-72 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</HomeCarousel>}
            {!loadingDiscovery && shownPublic.length === 0 && <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center lg:flex-1"><p className="text-sm font-bold text-brand-ink">{discoveryError ? 'Не вдалося завантажити події.' : 'Поки немає публічних подій поруч.'}</p>{!discoveryError && selectedCategory !== 'all' && <p className="mt-1.5 text-xs text-brand-ink-muted">Спробуйте іншу категорію або збільшіть радіус.</p>}</div>}
            {!loadingDiscovery && shownPublic.length > 0 && <HomeCarousel id="public-events-carousel" label="Публічні події поруч" className="gap-3.5 lg:space-y-3.5">{shownPublic.map((event) => <div role="listitem" key={event.id} className="w-[88%] flex-none snap-start [scroll-snap-stop:always] min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PublicEventCard event={event} isNew={event.id === newEventId} /></div>)}</HomeCarousel>}

            {hasMorePublic && <button type="button" onClick={() => setPublicPage((page) => page + 1)} className="mt-4 w-full rounded-xl border border-brand-border bg-white py-3 text-sm font-bold text-brand-ink-soft transition hover:border-brand-border-strong hover:bg-brand-surface-muted">Показати більше ({filteredPublic.length - shownPublic.length})</button>}
            <div className="mt-1 flex-none border-t border-[#e6ddd7] pt-1 xl:flex xl:items-center xl:gap-1.5">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold tracking-[-0.02em] text-brand-ink">Публічні події</h2>
                {!loadingDiscovery && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-ink-muted" aria-label={`${filteredPublic.length} публічних подій`}>{filteredPublic.length}</span>}
              </div>
              <div className="mt-0.5 min-w-0 xl:mt-0 xl:flex-1 [&>div]:pb-0 [&_button]:min-h-7 [&_button]:rounded-lg [&_button]:px-2 [&_button]:text-[10px]"><CategoryChips items={TABS} selected={selectedCategory} onSelect={(key) => { setSelectedCategory(key); setPublicPage(1) }} /></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
