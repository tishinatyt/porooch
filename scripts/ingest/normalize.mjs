import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { normalizeEventTitle } from '../../src/lib/eventTitle.ts'
import { findCity } from '../../src/lib/cities.ts'

const hash = value => createHash('sha256').update(value).digest('hex')
export const normalizedKey = value => normalizeEventTitle(String(value ?? '')).normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu, '')
export function dedupHash(event) {
  return hash([normalizedKey(event.title), event.starts_at, normalizedKey(event.place || event.address), normalizedKey(event.city)].join('|'))
}
export function httpUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null
  try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
export function kyivDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?)?$/.test(value)) return null
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(+calendar) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) return null
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) { const date = new Date(value); return Number.isFinite(+date) ? date.toISOString() : null }
  const target = value.length === 10 ? `${value}T00:00:00` : value.length === 16 ? `${value}:00` : value
  const wall = Date.parse(`${target}Z`)
  if (!Number.isFinite(wall)) return null
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  let guess = wall
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(guess).map(p => [p.type, p.value]))
    const observed = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
    const correction = wall - observed
    if (!correction) return new Date(guess).toISOString()
    guess += correction
  }
  return null // Nonexistent local time during the spring DST transition.
}
const string = (value, max = 300) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
const list = value => Array.isArray(value) ? value : value ? [value] : []
const typeName = value => String(value).split(/[/#]/).at(-1)

export function parseSchemaEvents(html, source, stats = {}) {
  const dom = new JSDOM(html), nodes = [], byId = new Map(), seen = new Set()
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 30 || nodes.length > 20000) return
    seen.add(value)
    if (Array.isArray(value)) { value.forEach(item => walk(item, depth + 1)); return }
    nodes.push(value); if (typeof value['@id'] === 'string' && Object.keys(value).length > 1) byId.set(value['@id'], value)
    Object.values(value).forEach(item => walk(item, depth + 1))
  }
  for (const script of dom.window.document.querySelectorAll('script[type]')) {
    if (script.type.toLowerCase().split(';')[0].trim() !== 'application/ld+json') continue
    try { walk(JSON.parse(script.textContent)) } catch { /* One broken block must not hide other valid blocks. */ }
  }
  const resolve = value => value && typeof value === 'object' && value['@id'] ? byId.get(value['@id']) ?? value : value
  stats.markupCount = nodes.filter(node => list(node['@type']).map(typeName).some(type => /Event$/.test(type))).length
  const events = [], keys = new Set()
  for (const node of nodes) {
    const types = list(node['@type']).map(typeName)
    if (!types.some(type => /Event$/.test(type))) continue
    const location = resolve(list(node.location)[0]) ?? {}, address = resolve(location.address) ?? {}
    const country = typeof address.addressCountry === 'object' ? address.addressCountry.name : address.addressCountry
    if (country && !['ua', 'ukraine', 'україна', 'украина'].includes(String(country).toLowerCase())) continue
    const title = normalizeEventTitle(node.name).slice(0, 300), starts_at = kyivDate(node.startDate), ends_at = kyivDate(node.endDate)
    const locality = string(address.addressLocality || source.city, 120)
    const city = findCity(locality)?.name ?? locality
    const place = string(location.name), addressText = typeof address === 'string' ? string(address) : string([address.streetAddress, address.addressLocality].filter(Boolean).join(', '))
    if (!title || !starts_at || !city || (ends_at && ends_at < starts_at)) continue
    const source_url = httpUrl(node.url || node['@id'] || source.url, source.url)
    if (!source_url) continue
    const offers = list(node.offers).map(resolve).flatMap(offer => list(offer.offers).length ? list(offer.offers) : [offer])
    const prices = offers.map(offer => ({ price: Number(offer.lowPrice ?? offer.price), currency: string(offer.priceCurrency, 3).toUpperCase() })).filter(p => Number.isFinite(p.price) && p.price >= 0 && p.currency)
    const currency = prices.find(p => p.currency === 'UAH')?.currency ?? prices[0]?.currency ?? null
    const price_from = currency ? Math.min(...prices.filter(p => p.currency === currency).map(p => p.price)) : null
    const cover_url = list(node.image).map(resolve).map(image => httpUrl(image && typeof image === 'object' ? image.url || image.contentUrl || image['@id'] : image, source.url)).find(Boolean) ?? null
    const geo = resolve(location.geo) ?? {}, lat = Number(geo.latitude), lng = Number(geo.longitude)
    const holder = dom.window.document.createElement('div'); holder.innerHTML = typeof node.description === 'string' ? node.description : ''
    const description = string(holder.textContent, 200)
    const event_status = typeName(node.eventStatus || 'EventScheduled')
    const identifier = typeof node.identifier === 'object' ? node.identifier?.value : node.identifier
    const stableId = node['@id'] || (typeof identifier === 'number' ? String(identifier) : identifier)
    const event = {
      external_id: string(stableId || source_url, 1000), title, starts_at, ends_at,
      place, address: addressText, city, category: types.map(type => ({ MusicEvent: 'music', TheaterEvent: 'theatre', ScreeningEvent: 'cinema', SportsEvent: 'sport', FoodEvent: 'food', ExhibitionEvent: 'art' })[type]).find(Boolean) || source.default_category || 'other',
      latitude: geo.latitude != null && Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
      longitude: geo.longitude != null && Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
      price_from, currency, source_url, cover_url, description, event_status,
    }
    // Without a stable source id, use URL + name + venue (not date) so postponements update the same record.
    if (!stableId) event.external_id = hash([source_url, normalizedKey(title), normalizedKey(place || addressText)].join('|'))
    event.dedup_hash = dedupHash(event)
    event.fingerprint = hash(JSON.stringify(event))
    event.raw_data = { schema_types: types, name: title, startDate: string(node.startDate), endDate: string(node.endDate), previousStartDate: string(node.previousStartDate), eventStatus: event_status, description, location: { name: place, address: addressText, city, latitude: event.latitude, longitude: event.longitude }, offers: { price_from, currency }, url: source_url, image: cover_url }
    if (!keys.has(event.external_id)) { keys.add(event.external_id); events.push(event) }
  }
  dom.window.close()
  return events
}
