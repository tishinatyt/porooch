import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { OrganizerInfo, ParticipantInfo, PersonalEventData } from '@/components/home/types'

function toSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function useMyEvents() {
  const { supaUser } = useAuth()
  const [events, setEvents] = useState<PersonalEventData[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supaUser) return
    setLoading(true)

    // Includes organized/joined events and pending approval requests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberships, error: membershipError } = await (supabase as any)
      .from('event_participants')
      .select('event_id, role, status')
      .eq('user_id', supaUser.id)
      .in('status', ['joined', 'pending'])

    if (membershipError) console.error('[useMyEvents] memberships error:', membershipError)
    if (!memberships?.length) {
      setEvents([])
      setLoading(false)
      return
    }

    const membershipByEvent = new Map<string, { role: 'organizer' | 'participant'; status: 'joined' | 'pending' }>(
      (memberships as { event_id: string; role: 'organizer' | 'participant'; status: 'joined' | 'pending' }[])
        .map((membership) => [membership.event_id, { role: membership.role, status: membership.status }]),
    )
    const eventIds = [...membershipByEvent.keys()]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [eventsResult, participantsResult] = await Promise.all([
      (supabase as any)
        .from('events')
        .select(`
          id, title, category, address_text, event_datetime, created_at,
          min_age, max_age, gender_filter, cover_photo_url, max_participants, is_public, join_mode,
          organizer:users!events_organizer_id_fkey(id, name, avatar_url, google_verified)
        `)
        .in('id', eventIds)
        .order('event_datetime', { ascending: true }),
      (supabase as any)
        .from('event_participants')
        .select('event_id, user_id, user:users!event_participants_user_id_fkey(id, name, avatar_url)')
        .in('event_id', eventIds)
        .eq('status', 'joined'),
    ])

    if (eventsResult.error) console.error('[useMyEvents] events error:', eventsResult.error)
    if (participantsResult.error) console.error('[useMyEvents] participants error:', participantsResult.error)

    const participantsByEvent = new Map<string, ParticipantInfo[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (participantsResult.data ?? []) as any[]) {
      const list = participantsByEvent.get(row.event_id) ?? []
      list.push({ user_id: row.user_id, user: toSingle(row.user) })
      participantsByEvent.set(row.event_id, list)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = ((eventsResult.data ?? []) as any[]).map((event): PersonalEventData => {
      const membership = membershipByEvent.get(event.id)!
      return {
        eventId: event.id,
        role: membership.role,
        participationStatus: membership.status,
        title: event.title,
        category: event.category,
        address_text: event.address_text,
        event_datetime: event.event_datetime,
        created_at: event.created_at,
        min_age: event.min_age,
        max_age: event.max_age,
        gender_filter: event.gender_filter,
        cover_photo_url: event.cover_photo_url,
        max_participants: event.max_participants,
        is_public: event.is_public,
        join_mode: event.join_mode,
        organizer: toSingle(event.organizer) as OrganizerInfo | null,
        participants: participantsByEvent.get(event.id) ?? [],
      }
    })

    setEvents(mapped)
    setLoading(false)
  }, [supaUser])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!supaUser) return
    const channel = supabase
      .channel(`my-events:${supaUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, () => { void reload() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void reload() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [reload, supaUser])

  return { events, loading, reload }
}
