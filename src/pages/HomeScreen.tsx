import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getCurrentPosition } from '@/lib/geo'
import TopBar from '@/components/TopBar'
import { PersonalEventCard, PublicEventCard } from '@/components/home/HomeEventCards'
import { CategoryChips } from '@/components/home/HomeControls'
import type { PersonalEventData, PublicEventData } from '@/components/home/types'
import { DEMO_PERSONAL_EVENTS, DEMO_PUBLIC_EVENTS, PUBLIC_CATEGORIES } from '@/components/home/demoEvents'

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
  const [newEventId, setNewEventId] = useState<string | null>(null)

  const fetchDiscoveryEvents = useCallback(async () => {
    if (!supaUser) return
    setLoadingDiscovery(true)

    const geo = await getCurrentPosition()
    const [nearbyResult, participationResult] = await Promise.all([
      supabase.rpc('events_nearby', { user_lat: geo.lat, user_lng: geo.lng, radius_km: 100 }),
      supabase.from('event_participants').select('event_id, status').eq('user_id', supaUser.id).in('status', ['joined', 'pending']),
    ])

    if (nearbyResult.error) console.error('[fetchDiscoveryEvents] nearby error:', nearbyResult.error)
    if (participationResult.error) console.error('[fetchDiscoveryEvents] participation error:', participationResult.error)

    const nearbyRows = (nearbyResult.data ?? []) as Record<string, unknown>[]
    const ids = nearbyRows.map((row) => row.id as string)
    const typeById = new Map<string, { event_type: 'personal' | 'public'; join_mode: 'open' | 'approval' }>()

    if (ids.length > 0) {
      const { data: typeRows, error: typeError } = await supabase
        .from('events')
        .select('id, event_type, join_mode')
        .in('id', ids)
      if (typeError) console.error('[fetchDiscoveryEvents] event type error:', typeError)
      for (const row of typeRows ?? []) {
        typeById.set(row.id, {
          event_type: (row.event_type ?? 'public') as 'personal' | 'public',
          join_mode: (row.join_mode ?? 'open') as 'open' | 'approval',
        })
      }
    }

    const excludedIds = new Set((participationResult.data ?? []).map((row) => row.event_id))
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
    .filter((event) => event.organizer?.id !== supaUser?.id)
    .filter((event) => !excludedEventIds.has(event.id))
    .filter((event) => isEligible(event, profile?.age, profile?.gender))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery))

  const realPersonalEvents = eligibleDiscovery
    .filter((event) => event.event_type === 'personal')

  const realPersonalIds = new Set(realPersonalEvents.map((event) => event.id))
  const personalDemoLimit = realPersonalEvents.length >= 3 ? 0 : 4 - realPersonalEvents.length
  const personalDemoFallbacks = DEMO_PERSONAL_EVENTS
    .filter((event) => !realPersonalIds.has(event.id))
    .filter((event) => event.distance_km === null || event.distance_km <= radiusKm)
    .filter((event) => matchesSearch(event, searchQuery))
    .slice(0, personalDemoLimit)
  const personalEvents = [...realPersonalEvents, ...personalDemoFallbacks].map(asPersonalEvent)

  const realPublic = eligibleDiscovery
    .filter((event) => event.event_type === 'public')
    .filter((e) => selectedCategory === 'all' || e.category === selectedCategory)

  const categoriesWithRealEvents = new Set(realPublic.map((event) => event.category))
  const demoFallbacks = DEMO_PUBLIC_EVENTS.filter((event) =>
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
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-ink lg:pb-10">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        radiusKm={radiusKm}
        onRadiusChange={(value) => { setRadiusKm(value); setPublicPage(1) }}
        radiusOptions={RADIUS_OPTIONS}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-7 lg:py-6 xl:px-10">
        <div className="grid min-w-0 grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(280px,0.4fr)_minmax(0,0.6fr)] lg:gap-6 xl:grid-cols-[minmax(340px,0.4fr)_minmax(0,0.6fr)] xl:gap-7">
          <section className="min-w-0">
            <div className="mb-3.5 flex items-start justify-between gap-4">
              <div>
              <h1 className="text-lg font-extrabold tracking-[-0.02em] text-brand-ink">Особисті зустрічі</h1>
              <p className="mt-1 text-xs leading-5 text-brand-ink-muted">Зустрічі від людей поруч із вами</p>
              </div>
              {!loadingDiscovery && personalEvents.length > 0 && <span className="mt-0.5 text-xs font-bold tabular-nums text-brand-ink-muted" aria-label={`${personalEvents.length} особистих зустрічей`}>{personalEvents.length}</span>}
            </div>

            {loadingDiscovery && <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 lg:block lg:space-y-3 lg:overflow-visible lg:pb-0 lg:pr-0">{[1, 2, 3].map((item) => <div key={item} className="h-56 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</div>}
            {!loadingDiscovery && personalEvents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center"><p className="text-sm font-bold text-brand-ink">Поки немає особистих подій поруч.</p><Link to="/create" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-brand-accent px-4 text-xs font-bold text-white transition hover:bg-brand-accent-hover">Створити подію</Link></div>
            )}
            {!loadingDiscovery && personalEvents.length > 0 && <div role="list" aria-label="Особисті зустрічі поруч" className="scrollbar-hide flex snap-x snap-mandatory scroll-smooth items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 pr-4 [scroll-padding-inline:1px] [-webkit-overflow-scrolling:touch] lg:block lg:space-y-2.5 lg:overflow-visible lg:overscroll-auto lg:pb-0 lg:pr-0">{personalEvents.map((event) => <div role="listitem" key={event.eventId} className="w-[88%] flex-none snap-start min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PersonalEventCard event={event} /></div>)}</div>}

            <Link to="/create" className="mt-3 flex w-full items-center justify-center rounded-lg border border-brand-accent/20 bg-brand-accent-soft px-4 py-2.5 text-xs font-bold text-brand-accent transition hover:border-brand-accent/40 hover:bg-brand-accent/10">+ Створити особисту подію</Link>
          </section>

          <section className="min-w-0">
            <div className="mb-3.5 flex items-start justify-between gap-4">
              <div>
              <h2 className="text-lg font-extrabold tracking-[-0.02em] text-brand-ink">Публічні події</h2>
              <p className="mt-1 text-xs leading-5 text-brand-ink-muted">Відкриті події, до яких можна приєднатися</p>
              </div>
              {!loadingDiscovery && shownPublic.length > 0 && <span className="mt-0.5 text-xs font-bold tabular-nums text-brand-ink-muted" aria-label={`${filteredPublic.length} публічних подій`}>{filteredPublic.length}</span>}
            </div>

            <div className="mb-3"><CategoryChips items={TABS} selected={selectedCategory} onSelect={(key) => { setSelectedCategory(key); setPublicPage(1) }} /></div>
            {loadingDiscovery && <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 lg:block lg:space-y-3 lg:overflow-visible lg:pb-0 lg:pr-0">{[1, 2, 3, 4].map((item) => <div key={item} className="h-72 w-[88%] flex-none snap-start animate-pulse rounded-2xl border border-brand-border bg-white min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto" />)}</div>}
            {!loadingDiscovery && shownPublic.length === 0 && <div className="rounded-2xl border border-dashed border-brand-border-strong bg-white px-4 py-6 text-center"><p className="text-sm font-bold text-brand-ink">Поки немає публічних подій поруч.</p>{selectedCategory !== 'all' && <p className="mt-1.5 text-xs text-brand-ink-muted">Спробуйте іншу категорію або збільшіть радіус.</p>}</div>}
            {!loadingDiscovery && shownPublic.length > 0 && <div role="list" aria-label="Публічні події поруч" className="scrollbar-hide flex snap-x snap-mandatory scroll-smooth items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 pr-4 [scroll-padding-inline:1px] [-webkit-overflow-scrolling:touch] lg:block lg:space-y-2.5 lg:overflow-visible lg:overscroll-auto lg:pb-0 lg:pr-0">{shownPublic.map((event) => <div role="listitem" key={event.id} className="w-[88%] flex-none snap-start min-[420px]:w-[86%] sm:w-[46%] md:w-[44%] lg:w-auto"><PublicEventCard event={event} isNew={event.id === newEventId} /></div>)}</div>}

            {hasMorePublic && <button type="button" onClick={() => setPublicPage((page) => page + 1)} className="mt-4 w-full rounded-xl border border-brand-border bg-white py-3 text-sm font-bold text-brand-ink-soft transition hover:border-brand-border-strong hover:bg-brand-surface-muted">Показати більше ({filteredPublic.length - shownPublic.length})</button>}
          </section>
        </div>
      </div>
    </div>
  )
}
