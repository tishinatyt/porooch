export interface EventAccess {
  is_public?: boolean
  join_mode?: 'open' | 'approval'
}

export function getEventAccessLabel(event: EventAccess) {
  if (event.is_public === false) return 'За запрошенням'
  if (event.join_mode === 'approval') return 'За підтвердженням'
  return 'Вільний вхід'
}
