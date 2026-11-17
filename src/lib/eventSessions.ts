import type { PublicEventData } from '@/components/home/types'
import { normalizeEventTitle } from './eventTitle'
const keyPart = (value: string) => normalizeEventTitle(value).normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu,'')
export function groupEventSessions(events: PublicEventData[], now = Date.now()): PublicEventData[] {
  const groups = new Map<string, PublicEventData[]>(), native: PublicEventData[] = []
  for (const event of events.flatMap(event => event.external?.sessions ?? [event])) {
    if (!event.external) { native.push(event); continue }
    if (!(Date.parse(event.event_datetime) > now) || ['EventCancelled','EventPostponed'].includes(event.external.status ?? '')) continue
    const venue = event.external.venueName || event.external.venueAddress || event.address_text
    const key = venue ? JSON.stringify([keyPart(event.title),keyPart(venue),keyPart(event.external.city ?? '')]) : event.id
    const rows = groups.get(key) ?? []; rows.push(event); groups.set(key,rows)
  }
  return [...native,...[...groups].map(([key,rows]) => {
    rows.sort((a,b)=>Date.parse(a.event_datetime)-Date.parse(b.event_datetime) || a.id.localeCompare(b.id))
    const unique = rows.filter((row,index)=>index===0 || Date.parse(row.event_datetime)!==Date.parse(rows[index-1].event_datetime))
    const first=unique[0], withCoordinates=unique.find(row=>row.location_lat!=null && row.location_lng!=null)
    return {...first,id:`ingested-group:${key}`,location_lat:first.location_lat ?? withCoordinates?.location_lat,location_lng:first.location_lng ?? withCoordinates?.location_lng,external:{...first.external!,sessions:unique}}
  })].sort((a,b)=>Date.parse(a.event_datetime)-Date.parse(b.event_datetime))
}
