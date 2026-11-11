import type { PublicEventData } from './types'
import { findCity, cityLabel, type UkrainianCity } from '../../lib/cities.ts'

/** Exactly two labelled examples per city. These never create production memberships or chats. */
export function getCityDemoEvents(city: UkrainianCity, now = new Date()): PublicEventData[] {
  return (['personal', 'public'] as const).map((type, index) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() + index + 1)
    date.setUTCHours(15, 0, 0, 0)
    return {
      id: `demo-city-${city.id}-${type}`,
      title: type === 'personal' ? `Кава та знайомство · ${city.name}` : `Відкрита прогулянка містом · ${city.name}`,
      description: `Тестова ${type === 'personal' ? 'особиста' : 'публічна'} подія для міста ${cityLabel(city)}. Це приклад оформлення: дата, місце та кількість місць умовні. Реальна зустріч не запланована. Створіть власну подію, щоб запросити учасників і відкрити чат.`,
      category: type === 'personal' ? 'communication' : 'walk',
      address_text: `${cityLabel(city)} · умовне місце в центрі`,
      event_datetime: date.toISOString(),
      created_at: '2026-10-24T12:00:00Z',
      min_age: 18, max_age: 99, gender_filter: 'any',
      cover_photo_url: null,
      max_participants: type === 'personal' ? 4 : 20,
      participant_count: 0, participants: [], distance_km: null,
      organizer: { id: '', name: 'ПОРУЧ · тестовий приклад', avatar_url: null, google_verified: false },
      event_type: type, join_mode: type === 'personal' ? 'approval' : 'open', is_public: true,
      location_lat: city.lat + index * 0.001, location_lng: city.lng + index * 0.001,
      isDemo: true,
    }
  })
}
export function getDemoEvent(id: string | undefined, now = new Date()) {
  const match = /^demo-city-(UA\d{17})-(personal|public)$/.exec(id ?? '')
  if (!match) return null
  const city = findCity(match[1])
  return city ? getCityDemoEvents(city, now).find(event => event.id === id) ?? null : null
}
