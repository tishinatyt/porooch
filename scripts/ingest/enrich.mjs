import { parseSchemaEvents, normalizedKey } from './normalize.mjs'
export async function enrichVenue(row, crawler) {
  if (row.place?.trim() || row.address?.trim() || !row.source_url) return row
  try {
    const page = await crawler.get(row.source_url)
    if (!page.allowed) return row
    const found = parseSchemaEvents(page.text, { url: page.url, city: row.city, default_category: row.category }).find(event =>
      normalizedKey(event.title) === normalizedKey(row.title) && Date.parse(event.starts_at) === Date.parse(row.starts_at))
    if (!found) return row
    return { ...row, place: found.place || row.place, address: found.address || row.address,
      latitude: row.latitude ?? found.latitude, longitude: row.longitude ?? found.longitude,
      cover_url: row.cover_url || found.cover_url, price_from: row.price_from ?? found.price_from, currency: row.currency || found.currency }
  } catch { return row }
}
