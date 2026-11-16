import type { PublicEventData } from '@/components/home/types'

export function externalUrl(url: string, params = '') {
  try {
    const target = new URL(url)
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) return null
    new URLSearchParams(params.replace(/^\?/, '')).forEach((value, key) => target.searchParams.set(key, value))
    return target.href
  } catch { return null }
}
export interface IngestedRow {
  use_source_images?: boolean
  id: string; title: string; starts_at: string; ends_at?: string | null; place: string; address: string; city: string; category: string
  latitude: number | null; longitude: number | null; price_from: number | null; currency: string | null
  cover_url: string | null; source_url: string; source_name: string; partner_params: string; description: string
}
export function asExternalEvent(row: IngestedRow): PublicEventData | null {
  const url = externalUrl(row.source_url, row.partner_params)
  if (!row.id || !row.title || !row.source_name || !url || !Number.isFinite(Date.parse(row.starts_at))) return null
  return {
    id: `ingested:${row.id}`, title: row.title, event_datetime: row.starts_at,
    address_text: [row.place, row.address].filter(Boolean).join(' · '), category: row.category,
    cover_photo_url: sourceImageUrl(row.cover_url, row.use_source_images), description: row.description, min_age: 0, max_age: 120, gender_filter: 'any',
    max_participants: 0, participant_count: 0, distance_km: null, organizer: null, event_type: 'public',
    location_lat: row.latitude, location_lng: row.longitude,
    external: { sourceName: row.source_name, url, priceFrom: row.price_from, currency: row.currency },
  }
}

export function sourceImageUrl(url: string | null | undefined, enabled?: boolean) {
  return enabled === true && url ? externalUrl(url) : null
}

export function missingImagesColumn(error: { code?: string; message?: string } | null) {
  return Boolean(error && ['PGRST204', '42703'].includes(error.code ?? '') && error.message?.includes('use_source_images'))
}

export function distanceFrom(event: PublicEventData, lat: number, lng: number) {
  if (event.location_lat == null || event.location_lng == null) return null
  const rad = Math.PI / 180
  const a = Math.sin((event.location_lat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(event.location_lat * rad) * Math.sin((event.location_lng - lng) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}
