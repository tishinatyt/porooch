import { supabase } from '@/lib/supabase'

export type ParticipantStatus = 'pending' | 'joined' | 'left' | 'rejected'

export async function joinEventParticipation(eventId: string, userId: string, joinMode: 'open' | 'approval') {
  const status: Extract<ParticipantStatus, 'pending' | 'joined'> = joinMode === 'approval' ? 'pending' : 'joined'
  const { error } = await supabase
    .from('event_participants')
    .upsert(
      { event_id: eventId, user_id: userId, role: 'participant', status },
      { onConflict: 'event_id,user_id' },
    )

  return { error, status }
}
