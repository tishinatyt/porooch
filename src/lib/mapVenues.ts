import type { PublicEventData } from '@/components/home/types'
import { normalizeEventTitle } from './eventTitle'

export function hasMapCoordinates(event: PublicEventData) {
  return typeof event.location_lat === 'number' && Number.isFinite(event.location_lat) && Math.abs(event.location_lat) <= 90 && typeof event.location_lng === 'number' && Number.isFinite(event.location_lng) && Math.abs(event.location_lng) <= 180
}
export interface MapVenue {
  key: string; name: string; position: [number, number]; kind: 'external' | 'native' | 'mixed'; events: PublicEventData[]
}
export function groupMapVenues(events: PublicEventData[]): MapVenue[] {
  const groups = new Map<string, MapVenue>()
  const venues = new Map<string, MapVenue>()
  const normalized = (value: string) => normalizeEventTitle(value).toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu, '')
  for (const event of events.filter(hasMapCoordinates)) {
    const key = `${event.location_lat!.toFixed(5)}:${event.location_lng!.toFixed(5)}`
    const identity = event.external ? `${normalized(event.external.city ?? '')}:${normalized(event.external.venueAddress || event.external.venueName || event.address_text)}` : null
    let group = groups.get(key)
    const known = identity ? venues.get(identity) : null
    if (!group && known && Math.abs(known.position[0] - event.location_lat!) <= 0.001 && Math.abs(known.position[1] - event.location_lng!) <= 0.001) { group = known; groups.set(key, group) }
    if (!group) { group = { key, name: event.external?.venueName || event.address_text, position: [event.location_lat!, event.location_lng!], kind: event.external ? 'external' : 'native', events: [] }; groups.set(key, group) }
    if (identity) venues.set(identity, group)
    group.events.push(event)
    if (event.external?.venueName) group.name = event.external.venueName
    const external = group.events.filter(row => row.external).length
    group.kind = external === group.events.length ? 'external' : external === 0 ? 'native' : 'mixed'
  }
  const unique = [...new Set(groups.values())]
  for (const group of unique) group.events.sort((a, b) => a.event_datetime.localeCompare(b.event_datetime) || a.id.localeCompare(b.id))
  return unique
}
