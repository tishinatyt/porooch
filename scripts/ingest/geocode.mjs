import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { request } from './http.mjs'
import { normalizeEventTitle } from '../../src/lib/eventTitle.ts'

const keyText = value => normalizeEventTitle(value).normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu, '')
function addressFor(venue) {
  return (venue.address ?? '').split(',').map(part => part.trim()).filter(part => part && ![keyText(venue.city), keyText('Україна')].includes(keyText(part))).join(', ')
}
export function venueKey(venue) {
  const address = addressFor(venue).replace(/^(?:вулиця|вул\.?|улица|ул\.?)\s+/iu, '')
  return createHash('sha256').update(`${keyText(venue.city)}|${keyText(address || venue.place)}`).digest('hex')
}
export function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
}
export function venueQueries(venue) {
  const address = addressFor(venue)
  if (!venue.city || (!venue.place && !address)) return []
  const primary = [venue.place, address, venue.city, 'Україна'].filter(Boolean).join(', ')
  const fallback = address ? [address, venue.city, 'Україна'].join(', ') : null
  return [...new Set([primary, fallback].filter(Boolean))]
}

export function createVenueGeocoder({ db, transport = request, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), cacheFile = '.cache/venue-geocodes.json', endpoint = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search', intervalMs = 15000, maxRequests = Number(process.env.GEOCODE_MAX_REQUESTS || 200) } = {}) {
  const url = new URL(endpoint)
  const publicService = url.hostname === 'nominatim.openstreetmap.org'
  const interval = Math.max(publicService ? 15000 : 1000, intervalMs)
  const budget = Number.isInteger(maxRequests) && maxRequests >= 0 ? maxRequests : 200
  const memory = new Map(); let queue = Promise.resolve(), loaded, last = -Infinity, dbAvailable = !!db, stopped = false, requests = 0
  let disk = {}
  async function load() {
    if (!cacheFile) return
    try { const value = JSON.parse(await fs.readFile(cacheFile, 'utf8')); if (value && typeof value === 'object' && !Array.isArray(value)) disk = value } catch { /* Fresh cache or unavailable filesystem. */ }
  }
  function usable(record) {
    return record && ((record.status === 'found' && validCoordinates(record.latitude, record.longitude)) || record.status === 'not_found' || (record.status === 'error' && Date.parse(record.retry_after) > now()))
  }
  async function read(key) {
    if (usable(disk[key])) return disk[key]
    if (!dbAvailable) return null
    try {
      const result = await db.from('venue_geocode_cache').select('*').eq('cache_key', key).maybeSingle()
      if (result.error) { dbAvailable = false; return null }
      return usable(result.data) ? result.data : null
    } catch { dbAvailable = false; return null }
  }
  async function store(record) {
    disk[record.cache_key] = record
    if (dbAvailable) {
      try { const result = await db.from('venue_geocode_cache').upsert(record, { onConflict: 'cache_key' }); if (result.error) dbAvailable = false } catch { dbAvailable = false }
    }
    if (cacheFile) {
      try {
        await fs.mkdir(path.dirname(cacheFile), { recursive: true })
        await fs.writeFile(`${cacheFile}.tmp`, JSON.stringify(disk), { mode: 0o600 })
        await fs.rename(`${cacheFile}.tmp`, cacheFile)
      } catch { /* In-memory cache still guarantees one lookup per venue this run. */ }
    }
  }
  async function existingCoordinates(venue) {
    if (!db || !venue.city || (!venue.address && !venue.place)) return null
    try {
      let query = db.from('ingested_events').select('latitude,longitude').eq('city', venue.city)
      query = venue.address ? query.eq('address', venue.address) : query.eq('place', venue.place)
      const result = await query.not('latitude', 'is', null).not('longitude', 'is', null).limit(1).maybeSingle()
      return !result.error && result.data && validCoordinates(result.data.latitude, result.data.longitude) ? { latitude: result.data.latitude, longitude: result.data.longitude } : null
    } catch { return null }
  }
  async function lookup(venue) {
    if (validCoordinates(venue.latitude, venue.longitude)) return { latitude: venue.latitude, longitude: venue.longitude }
    loaded ??= load(); await loaded
    const key = venueKey(venue), cached = await read(key)
    if (cached) return cached.status === 'found' ? { latitude: cached.latitude, longitude: cached.longitude } : null
    const existing = await existingCoordinates(venue)
    if (existing) {
      await store({ cache_key: key, place: venue.place ?? '', address: venue.address ?? '', city: venue.city, query: venueQueries(venue)[0] ?? '', ...existing, status: 'found', provider: 'stored-event', updated_at: new Date(now()).toISOString(), retry_after: null })
      return existing
    }
    const queries = venueQueries(venue)
    if (!queries.length || stopped || requests >= budget) return null
    let result = null, usedQuery = queries[0], status = 'not_found'
    try {
      for (const query of queries) {
        if (requests >= budget) { status = 'error'; break }
        const wait = last + interval - now(); if (wait > 0) await sleep(wait)
        const target = new URL(url); target.searchParams.set('q', query); target.searchParams.set('format', 'jsonv2'); target.searchParams.set('countrycodes', 'ua'); target.searchParams.set('addressdetails', '1'); target.searchParams.set('limit', '3'); target.searchParams.set('accept-language', 'uk')
        usedQuery = query; requests++
        let response
        try { response = await transport(target.href) } finally { last = now() }
        if ([403, 429].includes(response.status)) { stopped = true; throw Error('geocoder_blocked') }
        if (response.status !== 200) throw Error('geocoder_unavailable')
        const values = JSON.parse(response.text)
        if (!Array.isArray(values)) throw Error('geocoder_invalid')
        const match = values.find(item => item.lat != null && item.lon != null && String(item.lat).trim() && String(item.lon).trim() && validCoordinates(Number(item.lat), Number(item.lon)) && (!item.address?.country_code || item.address.country_code.toLowerCase() === 'ua') && !['city', 'town', 'village', 'municipality', 'county', 'state', 'country', 'postcode', 'administrative'].includes(item.addresstype) && item.type !== 'administrative')
        if (match) { result = { latitude: Number(match.lat), longitude: Number(match.lon) }; status = 'found'; break }
      }
    } catch { status = 'error' }
    // Cache misses permanently; transient service errors can be retried after an hour.
    await store({ cache_key: key, place: venue.place ?? '', address: venue.address ?? '', city: venue.city, query: usedQuery, latitude: result?.latitude ?? null, longitude: result?.longitude ?? null, status, provider: url.origin, updated_at: new Date(now()).toISOString(), retry_after: status === 'error' ? new Date(now() + 3600000).toISOString() : null })
    return result
  }
  return venue => {
    const key = venueKey(venue)
    if (validCoordinates(venue.latitude, venue.longitude)) { const known = Promise.resolve({ latitude: venue.latitude, longitude: venue.longitude }); memory.set(key, known); return known }
    if (memory.has(key)) return memory.get(key)
    const job = queue.then(() => lookup(venue)); memory.set(key, job); queue = job.catch(() => {}); return job
  }
}
