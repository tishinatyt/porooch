import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function write(path, text) {
  fs.writeFileSync(path, text.replace(/\r\n/g, '\n'))
}

function replaceOnce(path, from, to) {
  const source = read(path)
  if (!source.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 100)}`)
  write(path, source.replace(from, to))
}

function replaceRegex(path, pattern, replacement) {
  const source = read(path)
  if (!pattern.test(source)) throw new Error(`Pattern not found in ${path}: ${pattern}`)
  pattern.lastIndex = 0
  write(path, source.replace(pattern, replacement))
}

write('src/lib/geo.ts', `// Chernihiv, Ukraine default coords
export const DEFAULT_LAT = 51.4930
export const DEFAULT_LNG = 31.2945

export interface Coords {
  lat: number
  lng: number
}

export function getDevicePosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60_000 }
    )
  })
}

export async function getCurrentPosition(fallback: Coords = { lat: DEFAULT_LAT, lng: DEFAULT_LNG }): Promise<Coords> {
  return await getDevicePosition() ?? fallback
}
`)

write('src/lib/eventParticipation.ts', `import { supabase } from '@/lib/supabase'

export type ParticipantStatus = 'pending' | 'joined' | 'left' | 'rejected'

export async function joinEventParticipation(eventId: string) {
  const { data, error } = await supabase.rpc('join_event', { p_event_id: eventId })
  const status = data === 'pending' || data === 'joined' ? data : null
  return { error, status }
}
`)

replaceOnce(
  'src/hooks/useEvent.ts',
  `  const [loading, setLoading] = useState(true)\n  const [error, setError] = useState<string | null>(null)`,
  `  const [loading, setLoading] = useState(true)\n  const [error, setError] = useState<string | null>(null)\n  const [participantCount, setParticipantCount] = useState(0)`,
)
replaceRegex(
  'src/hooks/useEvent.ts',
  /  const reloadParticipants = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[eventId\]\)/,
  `  const reloadParticipants = useCallback(async () => {
    if (!eventId) return
    const [participantsResult, countResult] = await Promise.all([
      supabase
        .from('event_participants')
        .select(\`
          id, event_id, user_id, role, joined_at, status,
          user:users!event_participants_user_id_fkey(
            id, name, age, gender, avatar_url, google_verified, city, bio, interests, created_at
          )
        \`)
        .eq('event_id', eventId),
      supabase.rpc('event_participant_count', { p_event_id: eventId }),
    ])

    if (participantsResult.error) console.error('Failed to refresh event participants', participantsResult.error)
    else setParticipants(normalizeParticipants((participantsResult.data ?? []) as unknown as Record<string, unknown>[]))

    if (countResult.error) console.error('Failed to refresh participant count', countResult.error)
    else setParticipantCount(Number(countResult.data ?? 0))
  }, [eventId])`,
)
replaceOnce(
  'src/hooks/useEvent.ts',
  `    const [eventResult, participantsResult, coordsResult] = await Promise.all([`,
  `    const [eventResult, participantsResult, coordsResult, participantCountResult] = await Promise.all([`,
)
replaceOnce(
  'src/hooks/useEvent.ts',
  `      (supabase.rpc('get_event_coords', { p_event_id: eventId }).single() as unknown) as Promise<{ data: { lat: number; lng: number } | null; error: unknown }>,\n    ])`,
  `      (supabase.rpc('get_event_coords', { p_event_id: eventId }).single() as unknown) as Promise<{ data: { lat: number; lng: number } | null; error: unknown }>,\n      supabase.rpc('event_participant_count', { p_event_id: eventId }),\n    ])`,
)
replaceOnce(
  'src/hooks/useEvent.ts',
  `    if (participantsResult.data) {\n      setParticipants(normalizeParticipants(participantsResult.data as unknown as Record<string, unknown>[]))\n    }\n\n    setLoading(false)`,
  `    if (participantsResult.data) {\n      setParticipants(normalizeParticipants(participantsResult.data as unknown as Record<string, unknown>[]))\n    }\n    if (participantCountResult.error) console.error('Failed to load participant count', participantCountResult.error)\n    else setParticipantCount(Number(participantCountResult.data ?? 0))\n\n    setLoading(false)`,
)
replaceRegex(
  'src/hooks/useEvent.ts',
  /  async function joinEvent\(userId: string\): Promise<\{ error: string \| null; status: 'pending' \| 'joined' \| null \}> \{[\s\S]*?\n  \}\n\n  async function reviewRequest/,
  `  async function joinEvent(): Promise<{ error: string | null; status: 'pending' | 'joined' | null }> {
    const { error: err, status: requestedStatus } = await joinEventParticipation(eventId)

    if (err) {
      console.error('Failed to join event', err)
      const message = err.message ?? ''
      const friendlyError = message.includes('event_full') ? 'Місць більше немає'
        : message.includes('event_unavailable') ? 'До цієї події вже не можна приєднатися'
        : message.includes('private_event') ? 'Ця подія доступна лише за запрошенням'
        : message.includes('request_rejected') ? 'Ваш попередній запит було відхилено'
        : 'Не вдалося приєднатися до події. Спробуйте ще раз'
      return { error: friendlyError, status: null }
    }
    await reloadParticipants()
    return { error: null, status: requestedStatus }
  }

  async function reviewRequest`,
)
replaceOnce(
  'src/hooks/useEvent.ts',
  `  return { event, participants, loading, error, joinEvent, reviewRequest, leaveEvent }`,
  `  return { event, participants, participantCount, loading, error, joinEvent, reviewRequest, leaveEvent }`,
)

replaceOnce('src/pages/EventDetail.tsx', `import { getCurrentPosition } from '@/lib/geo'`, `import { getDevicePosition } from '@/lib/geo'`)
replaceOnce(
  'src/pages/EventDetail.tsx',
  `  const { event: liveEvent, participants: liveParticipants, loading, error, joinEvent, reviewRequest, leaveEvent } = useEvent(demoEvent ? '' : id!)`,
  `  const { event: liveEvent, participants: liveParticipants, participantCount: liveParticipantCount, loading, error, joinEvent, reviewRequest, leaveEvent } = useEvent(demoEvent ? '' : id!)`,
)
replaceOnce(
  'src/pages/EventDetail.tsx',
  `  })) : liveParticipants\n  const [distanceKm, setDistanceKm] = useState<number | null>(null)`,
  `  })) : liveParticipants\n  const participantCount = demoEvent ? demoEvent.participant_count : liveParticipantCount\n  const [distanceKm, setDistanceKm] = useState<number | null>(null)`,
)
replaceRegex(
  'src/pages/EventDetail.tsx',
  /  useEffect\(\(\) => \{\n    if \(event\?\.location_lat == null \|\| event\.location_lng == null\) return\n    getCurrentPosition\(\)\.then\(\(position\) => \{[\s\S]*?\n    \}\)\n  \}, \[event\?\.location_lat, event\?\.location_lng\]\)/,
  `  useEffect(() => {
    let cancelled = false
    setDistanceKm(null)
    if (event?.location_lat == null || event.location_lng == null) return
    void getDevicePosition().then((position) => {
      if (cancelled || !position || event.location_lat == null || event.location_lng == null) return
      const distance = haversineKm(position.lat, position.lng, event.location_lat, event.location_lng)
      setDistanceKm(Math.round(distance * 10) / 10)
    })
    return () => { cancelled = true }
  }, [event?.location_lat, event?.location_lng])`,
)
replaceOnce('src/pages/EventDetail.tsx', `    const { error: joinEventError, status } = await joinEvent(supaUser.id)`, `    const { error: joinEventError, status } = await joinEvent()`)
replaceOnce(
  'src/pages/EventDetail.tsx',
  `  const isFull = activeParticipants.length >= event.max_participants\n  const formattedDate = formatEventDate(event.event_datetime)`,
  `  const isFull = participantCount >= event.max_participants\n  const eventStarted = new Date(event.event_datetime).getTime() <= Date.now()\n  const joinUnavailableLabel = event.status === 'cancelled' ? 'Подію скасовано'\n    : event.status === 'completed' ? 'Подія завершена'\n    : eventStarted ? 'Подія вже почалася'\n    : null\n  const formattedDate = formatEventDate(event.event_datetime)`,
)
replaceOnce(
  'src/pages/EventDetail.tsx',
  `    : <EventActionContent isOrganizer={isOrganizer} joined={joined} pending={pending} rejected={rejected} joinMode={event.join_mode} isFull={isFull} joining={joining} leaving={leaving} onJoin={handleJoin} onChat={() => navigate(\`/event/\${event.id}/chat\`)} onLeave={handleLeave} />`,
  `    : <EventActionContent isOrganizer={isOrganizer} joined={joined} pending={pending} rejected={rejected} joinMode={event.join_mode} isFull={isFull} joinUnavailableLabel={joinUnavailableLabel} joining={joining} leaving={leaving} onJoin={handleJoin} onChat={() => navigate(\`/event/\${event.id}/chat\`)} onLeave={handleLeave} />`,
)
replaceOnce(
  'src/pages/EventDetail.tsx',
  `          <ParticipantList participants={activeParticipants} capacity={event.max_participants} />`,
  `          <ParticipantList participants={activeParticipants} totalCount={participantCount} capacity={event.max_participants} />`,
)

replaceRegex(
  'src/components/event-detail/EventDetailSections.tsx',
  /export function ParticipantList\(\{ participants, capacity \}: \{ participants: EventParticipant\[\]; capacity: number \}\) \{[\s\S]*?\n\}\n\nexport function EventRequirements/,
  `export function ParticipantList({ participants, totalCount, capacity }: { participants: EventParticipant[]; totalCount: number; capacity: number }) {
  const users = participants.map((participant) => ({ id: participant.user_id, name: participant.user?.name, avatar_url: participant.user?.avatar_url ?? null }))
  return (
    <section className="rounded-xl bg-[#faf9fd] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-brand-ink">Учасники</h2>
        <span className="text-xs font-bold text-brand-accent">{totalCount}/{capacity}</span>
      </div>
      {totalCount > 0 ? (
        <div className="flex items-center justify-between gap-3">
          {users.length > 0 ? <ParticipantAvatars users={users} totalCount={totalCount} max={6} /> : <span className="text-xs text-brand-ink-muted">Список учасників доступний після приєднання</span>}
          <span className="text-xs text-brand-ink-muted">{totalCount} {totalCount === 1 ? 'учасник' : 'учасників'}</span>
        </div>
      ) : <p className="text-sm text-brand-ink-muted">Поки немає учасників</p>}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-brand-surface-muted"><div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: \`\${Math.min((totalCount / Math.max(capacity, 1)) * 100, 100)}%\` }} /></div>
    </section>
  )
}

export function EventRequirements`,
)
replaceOnce(
  'src/components/event-detail/EventDetailSections.tsx',
  `  isFull: boolean\n  joining: boolean`,
  `  isFull: boolean\n  joinUnavailableLabel: string | null\n  joining: boolean`,
)
replaceOnce(
  'src/components/event-detail/EventDetailSections.tsx',
  `export function EventActionContent({ isOrganizer, joined, pending, rejected, joinMode, isFull, joining, leaving, onJoin, onChat, onLeave }: EventActionContentProps)`,
  `export function EventActionContent({ isOrganizer, joined, pending, rejected, joinMode, isFull, joinUnavailableLabel, joining, leaving, onJoin, onChat, onLeave }: EventActionContentProps)`,
)
replaceOnce(
  'src/components/event-detail/EventDetailSections.tsx',
  `  } else if (isFull) {\n    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">Місць немає</button>`,
  `  } else if (joinUnavailableLabel) {\n    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">{joinUnavailableLabel}</button>\n  } else if (isFull) {\n    action = <button type="button" disabled className="h-14 w-full cursor-not-allowed rounded-2xl bg-brand-surface-muted px-5 text-sm font-extrabold text-brand-ink-muted">Місць немає</button>`,
)

replaceOnce(
  'src/pages/HomeScreen.tsx',
  `  { key: 'music',   label: 'Музика' },\n  { key: 'other',   label: 'Інше' },`,
  `  { key: 'music',   label: 'Музика' },\n  { key: 'food',    label: 'Їжа' },\n  { key: 'games',   label: 'Ігри' },\n  { key: 'walk',    label: 'Прогулянка' },\n  { key: 'art',     label: 'Мистецтво' },\n  { key: 'other',   label: 'Інше' },`,
)
replaceOnce(
  'src/pages/HomeScreen.tsx',
  `  const mapEvents = eligibleDiscovery.filter((event) =>\n    event.event_type === 'personal' || selectedCategory === 'all' || event.category === selectedCategory,\n  )`,
  `  const mapEvents = eligibleDiscovery.filter((event) =>\n    selectedCategory === 'all' || event.category === selectedCategory,\n  )`,
)

replaceOnce('src/components/home/DiscoveryMap.tsx', `  const hasFitBoundsRef = useRef(false)`, `  const lastBoundsKeyRef = useRef<string | null>(null)`)
replaceOnce('src/components/home/DiscoveryMap.tsx', `      hasFitBoundsRef.current = false`, `      lastBoundsKeyRef.current = null`)
replaceOnce('src/components/home/DiscoveryMap.tsx', `  }, [center.lat, center.lng])`, `  }, [])`)
replaceOnce(
  'src/components/home/DiscoveryMap.tsx',
  `      if (!hasFitBoundsRef.current && bounds.length > 0) {\n        if (bounds.length === 1) map.setView(bounds[0], 14)\n        else map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })\n        hasFitBoundsRef.current = true\n      }`,
  `      const boundsKey = visibleEvents\n        .map((event) => \`\${event.id}:\${event.location_lat}:\${event.location_lng}\`)\n        .sort()\n        .join('|')\n      if (lastBoundsKeyRef.current !== boundsKey) {\n        if (bounds.length === 1) map.setView(bounds[0], 14)\n        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })\n        else map.setView([center.lat, center.lng], 12)\n        lastBoundsKeyRef.current = boundsKey\n      }`,
)
replaceOnce('src/components/home/DiscoveryMap.tsx', `  }, [events, mapReady, navigate])`, `  }, [center.lat, center.lng, events, mapReady, navigate])`)

replaceOnce(
  'src/contexts/ProfilePreviewContext.tsx',
  `  const triggerRef = useRef<HTMLElement | null>(null)`,
  `  const triggerRef = useRef<HTMLElement | null>(null)\n  const requestIdRef = useRef(0)`,
)
replaceOnce(
  'src/contexts/ProfilePreviewContext.tsx',
  `  const close = useCallback(() => {\n    setProfile(null)\n    setLoading(false)\n    requestAnimationFrame(() => triggerRef.current?.focus())\n  }, [])`,
  `  const close = useCallback(() => {\n    requestIdRef.current += 1\n    setProfile(null)\n    setLoading(false)\n    requestAnimationFrame(() => triggerRef.current?.focus())\n  }, [])`,
)
replaceRegex(
  'src/contexts/ProfilePreviewContext.tsx',
  /  const openProfilePreview = useCallback\(\(preview: ProfilePreviewData, trigger\?: HTMLElement \| null\) => \{[\s\S]*?\n  \}, \[\]\)/,
  `  const openProfilePreview = useCallback((preview: ProfilePreviewData, trigger?: HTMLElement | null) => {
    const requestId = ++requestIdRef.current
    triggerRef.current = trigger ?? document.activeElement as HTMLElement | null
    setProfile(preview)
    if (!isUuid(preview.id)) return
    setLoading(true)
    void supabase.from('users').select(PUBLIC_PROFILE_FIELDS).eq('id', preview.id).maybeSingle().then(({ data, error }) => {
      if (requestIdRef.current !== requestId) return
      if (error) console.error('[ProfilePreview] Failed to load profile:', error)
      if (data) setProfile(data as ProfilePreviewData)
      setLoading(false)
    })
  }, [])`,
)

write('src/contexts/AuthContext.tsx', `import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthContextValue {
  session: Session | null
  supaUser: SupabaseUser | null
  profile: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<SupabaseUser>
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [supaUser, setSupaUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestRef = useRef(0)
  const activeUserIdRef = useRef<string | null>(null)

  async function fetchProfile(userId: string) {
    const requestId = ++profileRequestRef.current
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (requestId !== profileRequestRef.current || activeUserIdRef.current !== userId) return
    if (error) console.error('[Auth] Failed to load profile:', error)
    setProfile(data ?? null)
  }

  async function refreshProfile(userId?: string) {
    const profileUserId = userId ?? activeUserIdRef.current ?? supaUser?.id
    if (profileUserId) await fetchProfile(profileUserId)
  }

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return
      setSession(initialSession)
      setSupaUser(initialSession?.user ?? null)
      activeUserIdRef.current = initialSession?.user.id ?? null
      if (initialSession?.user) await fetchProfile(initialSession.user.id)
      if (mounted) setLoading(false)
    }).catch((error) => {
      console.error('[Auth] Failed to restore session:', error)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      profileRequestRef.current += 1
      setSession(nextSession)
      setSupaUser(nextSession?.user ?? null)
      activeUserIdRef.current = nextSession?.user.id ?? null
      if (nextSession?.user) void fetchProfile(nextSession.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      profileRequestRef.current += 1
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString() }
    })
    if (error) throw error
  }

  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (!data.user) throw new Error('Anonymous sign-in did not return a user')
    return data.user
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ session, supaUser, profile, loading, signInWithGoogle, signInAnonymously, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
`)

replaceOnce(
  'src/components/ProtectedRoute.tsx',
  `  const hasCompleteProfile = Boolean(profile?.name?.trim().length && profile.name.trim().length >= 2 && profile.avatar_url)`,
  `  const hasCompleteProfile = Boolean(profile?.name?.trim().length && profile.name.trim().length >= 2 && profile.avatar_url && profile.city?.trim())`,
)

replaceOnce(
  'src/pages/Profile.tsx',
  `    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }\n    if (ageNumber !== null`,
  `    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }\n    if (!cleanCity) { setError('Оберіть місто'); return }\n    if (ageNumber !== null`,
)
replaceOnce(
  'src/pages/Profile.tsx',
  `city: cleanCity || null, bio: cleanBio || null`,
  `city: cleanCity, bio: cleanBio || null`,
)

replaceOnce(
  'src/pages/Onboarding.tsx',
  `        avatar_url: avatarUrl,\n        google_verified: authUser.app_metadata.provider === 'google',`,
  `        avatar_url: avatarUrl,`,
)

replaceOnce(
  'src/pages/EventChat.tsx',
  `    await markChatRead(chat.id, loadedMessages.at(-1)?.created_at ?? new Date().toISOString())`,
  `    if (showLoading || nearBottomRef.current) {\n      await markChatRead(chat.id, loadedMessages.at(-1)?.created_at ?? new Date().toISOString())\n    }`,
)
replaceOnce(
  'src/pages/EventChat.tsx',
  `    if (!chat) { setLoading(false); return }`,
  `    if (!chat) { setSendError('Чат події ще не готовий. Спробуйте оновити сторінку.'); setLoading(false); return }`,
)
replaceRegex(
  'src/pages/EventChat.tsx',
  /        <div onScroll=\{\(scrollEvent\) => \{ const element = scrollEvent\.currentTarget; nearBottomRef\.current = element\.scrollHeight - element\.scrollTop - element\.clientHeight < 120; if \(nearBottomRef\.current\) setHasNewMessages\(false\) \}\} className=/,
  `        <div onScroll={(scrollEvent) => { const element = scrollEvent.currentTarget; const wasNearBottom = nearBottomRef.current; const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120; nearBottomRef.current = isNearBottom; if (isNearBottom) { setHasNewMessages(false); const newest = messages.at(-1); if (!wasNearBottom && chatId && newest) void markChatRead(chatId, newest.created_at) } }} className=`,
)
replaceOnce(
  'src/pages/EventChat.tsx',
  `<MessageComposer value={text} sending={sending} disabled={!hasAccess}`,
  `<MessageComposer value={text} sending={sending} disabled={!hasAccess || !chatId}`,
)

replaceOnce('src/pages/CreateEvent.tsx', `import { getCurrentPosition } from '@/lib/geo'`, `import { getDevicePosition } from '@/lib/geo'\nimport { getOblastCenterCoordinates } from '@/lib/cities'`)
replaceOnce('src/pages/CreateEvent.tsx', `  const { supaUser } = useAuth()`, `  const { supaUser, profile } = useAuth()`)
replaceRegex(
  'src/pages/CreateEvent.tsx',
  /  async function useCurrentLocation\(\) \{\n    setLocating\(true\)\n    const position = await getCurrentPosition\(\)\n    setForm\(\(current\) => \(\{ \.\.\.current, lat: position\.lat, lng: position\.lng \}\)\)\n    await reverseGeocode\(position\.lat, position\.lng\)\n    setLocating\(false\)\n  \}/,
  `  async function useCurrentLocation() {
    setLocating(true)
    setErrors((current) => ({ ...current, lat: undefined }))
    try {
      const position = await getDevicePosition()
      if (!position) {
        setErrors((current) => ({ ...current, lat: 'Не вдалося визначити ваше місцезнаходження. Дозвольте геолокацію або виберіть точку на карті.' }))
        return
      }
      setForm((current) => ({ ...current, lat: position.lat, lng: position.lng }))
      await reverseGeocode(position.lat, position.lng)
    } finally {
      setLocating(false)
    }
  }`,
)
replaceOnce('src/pages/CreateEvent.tsx', `      status: 'upcoming',\n    }`, `    }`)
replaceOnce('src/pages/CreateEvent.tsx', `        status: payload.status,\n`, ``)
replaceOnce(
  'src/pages/CreateEvent.tsx',
  `      : await supabase.from('events').insert(payload).select('id').single()`,
  `      : await supabase.from('events').insert({ ...payload, status: 'upcoming' }).select('id').single()`,
)
replaceOnce(
  'src/pages/CreateEvent.tsx',
  `<CreateEventMap lat={form.lat} lng={form.lng} onPick={handleMapPick} />`,
  `<CreateEventMap lat={form.lat} lng={form.lng} center={getOblastCenterCoordinates(profile?.city) ?? undefined} onPick={handleMapPick} />`,
)

replaceOnce(
  'src/components/CreateEventMap.tsx',
  `  lng: number | null\n  onPick: (lat: number, lng: number) => void`,
  `  lng: number | null\n  center?: { lat: number; lng: number }\n  onPick: (lat: number, lng: number) => void`,
)
replaceOnce(
  'src/components/CreateEventMap.tsx',
  `export default function CreateEventMap({ lat, lng, onPick }: Props)`,
  `export default function CreateEventMap({ lat, lng, center, onPick }: Props)`,
)
replaceOnce(
  'src/components/CreateEventMap.tsx',
  `        center: [lat ?? 51.4982, lng ?? 31.2893], zoom: 14,`,
  `        center: [lat ?? center?.lat ?? 51.4982, lng ?? center?.lng ?? 31.2893], zoom: 14,`,
)

console.log('Audit source fixes applied successfully')
