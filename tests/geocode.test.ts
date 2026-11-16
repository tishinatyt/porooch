import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createVenueGeocoder, venueKey, validCoordinates } from '../scripts/ingest/geocode.mjs'
import { runBackfill } from '../scripts/ingest/backfill.mjs'
import { USER_AGENT } from '../scripts/ingest/http.mjs'

const venue = { place: 'Міський палац культури', address: 'вул. Шевченка, 23, Чернігів', city: 'Чернігів', latitude: null, longitude: null }
const point = { latitude: 51.503, longitude: 31.29 }
const ok = (rows = [{ lat: String(point.latitude), lon: String(point.longitude), addresstype: 'building', address: { country_code: 'ua' } }]) => ({ status: 200, text: JSON.stringify(rows) })

test('geocoder requests place/address/city/Ukraine, falls back to address, and serializes concurrent requests within policy', async () => {
  let clock = 0; const calls: { url: URL; at: number }[] = []
  const geocode = createVenueGeocoder({ cacheFile: null, now: () => clock, sleep: async ms => { clock += ms }, transport: async url => { calls.push({ url: new URL(url), at: clock }); return calls.length === 1 ? ok([]) : ok() } })
  const [first, second] = await Promise.all([geocode(venue), geocode({ ...venue, place: 'Інша зала', address: 'вул. Миру, 1' })])
  assert.deepEqual(first, point); assert.deepEqual(second, point)
  assert.equal(calls[0].url.searchParams.get('q'), 'Міський палац культури, вул. Шевченка, 23, Чернігів, Україна')
  assert.equal(calls[1].url.searchParams.get('q'), 'вул. Шевченка, 23, Чернігів, Україна')
  assert.equal(calls[0].url.searchParams.get('countrycodes'), 'ua')
  assert.ok(calls.slice(1).every((call, i) => call.at - calls[i].at >= 15000))
  assert.equal(USER_AGENT, 'PoruchBot (+https://poruch.fun)')
})
test('one venue reuses a positive or negative result across names and concurrent events; known source coordinates need no request', async () => {
  let count = 0
  const geocode = createVenueGeocoder({ cacheFile: null, transport: async () => { count++; return ok() } })
  await Promise.all([geocode(venue), geocode({ ...venue, place: 'Палац культури', address: 'вулиця Шевченка, 23' })])
  assert.equal(count, 1)
  assert.equal(venueKey(venue), venueKey({ ...venue, place: 'Інша назва', address: 'вулиця Шевченка, 23' }))
  let clock = 0, misses = 0
  const absent = createVenueGeocoder({ cacheFile: null, now: () => clock, sleep: async ms => { clock += ms }, transport: async () => { misses++; return ok([]) } })
  assert.equal(await absent(venue), null); assert.equal(await absent(venue), null); assert.equal(misses, 2)
  count = 0
  const known = createVenueGeocoder({ cacheFile: null, transport: async () => { count++; return ok() } })
  assert.deepEqual(await known({ ...venue, ...point }), point)
  assert.deepEqual(await known(venue), point); assert.equal(count, 0)
})
test('missing SQL table falls back to persistent file cache across runs; database cache hits avoid HTTP', async () => {
  await fs.mkdir('qa-artifacts', { recursive: true })
  const dir = await fs.mkdtemp(path.resolve('qa-artifacts/geocode-test-')), file = path.join(dir, 'cache.json')
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { code: '42P01' } }) }) }) }) }
  let requests = 0
  const first = createVenueGeocoder({ db, cacheFile: file, transport: async () => { requests++; return ok() } })
  assert.deepEqual(await first(venue), point)
  const second = createVenueGeocoder({ db, cacheFile: file, transport: async () => { requests++; throw Error('must not fetch') } })
  assert.deepEqual(await second(venue), point); assert.equal(requests, 1)
  const cached = createVenueGeocoder({ cacheFile: null, db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: 'found', ...point } }) }) }) }) }, transport: async () => { throw Error('must not fetch') } })
  assert.deepEqual(await cached(venue), point)
})
test('city centroids and invalid/foreign results do not place an event on the map; 429 stops further requests', async () => {
  let clock = 0
  const geocode = createVenueGeocoder({ cacheFile: null, now: () => clock, sleep: async ms => { clock += ms }, transport: async () => ok([
    { lat: '51', lon: '31', addresstype: 'city' }, { lat: '', lon: '' }, { lat: '999', lon: '999' }, { lat: '51', lon: '31', address: { country_code: 'pl' } },
  ]) })
  assert.equal(await geocode(venue), null)
  let calls = 0
  const limited = createVenueGeocoder({ cacheFile: null, transport: async () => { calls++; return { status: 429, text: '' } } })
  assert.equal(await limited(venue), null)
  assert.equal(await limited({ ...venue, address: 'Інша адреса' }), null)
  assert.equal(calls, 1)
  assert.equal(validCoordinates(null, null), false)
})
test('backfill uses keyset paging while rows leave the missing-coordinate set, never crawls sources, preserves approval and skips changed rows', async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ ...venue, id: String(index + 1).padStart(3, '0'), fingerprint: 'original', status: 'approved' }))
  const tables: string[] = [], updates: any[] = []
  const db = { from: (table: string) => {
    tables.push(table); const filters: [string, any][] = []; let after = '', payload: any = null
    const q: any = {
      select: () => q, in: () => q, or: () => q, order: () => q, limit: () => q,
      gt: (_key: string, value: string) => { after = value; return q }, eq: (key: string, value: any) => { filters.push([key, value]); return q },
      update: (values: any) => { payload = values; return q },
      then: (resolve: any) => {
        let found = rows.filter(row => row.id > after && row.latitude == null)
        if (payload) {
          found = found.filter(row => filters.every(([key, value]) => row[key] === value))
          found.forEach(row => { Object.assign(row, payload); updates.push(payload) })
        } else found = found.slice(0, 100)
        return Promise.resolve({ data: found.map(row => ({ ...row })), error: null }).then(resolve)
      },
    }; return q
  } }
  const originalLog = console.log; console.log = () => {}
  try {
    const result = await runBackfill(db, { geocode: async row => { if (row.id === '002') rows[1].fingerprint = 'changed-concurrently'; return point } })
    assert.equal(result.scanned, 101); assert.equal(result.updated, 100); assert.equal(result.missing, 1)
    assert.ok(tables.every(table => table === 'ingested_events'))
    assert.ok(updates.every(values => Object.keys(values).sort().join(',') === 'latitude,longitude'))
    assert.ok(rows.every(row => row.status === 'approved'))
    assert.equal(rows[1].latitude, null)
  } finally { console.log = originalLog }
})
test('venue cache SQL copies match and expose no public or authenticated data', async () => {
  const sql = await fs.readFile('supabase/migrations/20261116120000_venue_geocode_cache.sql', 'utf8')
  assert.equal(sql, await fs.readFile('docs/sql/venue-geocode-cache.sql', 'utf8'))
  assert.match(sql, /enable row level security/)
  assert.match(sql, /grant select,insert,update.*to service_role/)
})

test('without the cache table, previously stored coordinates for the same venue are reused without geocoding', async () => {
  const db = { from: (table: string) => {
    const q: any = { select: () => q, eq: () => q, not: () => q, limit: () => q, maybeSingle: async () => table === 'venue_geocode_cache' ? { error: { code: '42P01' } } : { data: point, error: null } }
    return q
  } }
  const geocode = createVenueGeocoder({ db, cacheFile: null, maxRequests: 0, transport: async () => { throw Error('no HTTP requests allowed') } })
  assert.deepEqual(await geocode(venue), point)
})
