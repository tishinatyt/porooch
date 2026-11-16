import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseSourceImport, sourceUrlKey } from '../src/lib/sourceImport.ts'
import { canAutoPublish } from '../src/lib/autoPublish.ts'
import { mergePublishedCities, findCity, UKRAINIAN_CITIES } from '../src/lib/cities.ts'
import { targetCities } from '../scripts/ingest/collect-karabas.mjs'
import { runIngest } from '../scripts/ingest/run.mjs'
import { registerAdapter } from '../scripts/ingest/adapters.mjs'

test('catalogue includes all requested cities, only positive discover results and one menu page per path', () => {
  const catalogue = JSON.parse(fs.readFileSync('docs/sources/karabas-sources.json', 'utf8'))
  const rows = parseSourceImport(JSON.stringify(catalogue))
  assert.equal(rows.length, 107)
  assert.ok(rows.every(row => row.valid_events! > 0 && !row.skip))
  assert.deepEqual([...new Set(rows.map(row => row.city))].sort(), [...targetCities].sort())
  assert.equal(new Set(rows.map(row => new URL(row.url).origin + new URL(row.url).pathname)).size, rows.length)
})
test('import preview normalizes URL aliases, skips existing and repeated URLs, and rejects malformed input', () => {
  const row = { city: 'Київ', section: 'Концерти', url: 'https://kyiv.karabas.com/concerts/?utm_source=test', default_category: 'music' }
  const rows = parseSourceImport(JSON.stringify([row, { ...row, url: 'https://lviv.karabas.com/concerts/' }, row]), ['https://kyiv.karabas.com/concerts'])
  assert.deepEqual(rows.map(row => row.skip), [true, false, true])
  assert.equal(sourceUrlKey('https://KYIV.karabas.com:443/concerts/?b=2&a=1&gclid=x#top'), 'https://kyiv.karabas.com/concerts?a=1&b=2')
  for (const invalid of ['{}', 'null', '[]', JSON.stringify([{ ...row, url: 'javascript:alert(1)' }]), JSON.stringify([{ ...row, default_category: '__proto__' }])]) assert.throws(() => parseSourceImport(invalid))
})
test('auto publication validates future date, title, venue, status, source flag and deduplication', () => {
  const event = { title: 'Концерт', place: 'Театр', address: '', starts_at: '2099-01-01T18:00Z', event_status: 'EventScheduled' }
  assert.equal(canAutoPublish(event, true, false), true)
  assert.equal(canAutoPublish(event, false, false), false)
  assert.equal(canAutoPublish(event, true, true), false)
  for (const override of [{ title: '' }, { title: 'AB' }, { title: '😀😀' }, { place: '', address: '' }, { starts_at: '2000-01-01T18:00Z' }, { starts_at: 'invalid' }, { event_status: 'EventCancelled' }, { event_status: 'EventPostponed' }]) assert.equal(canAutoPublish({ ...event, ...override }, true, false), false)
})
test('known city centres remain authoritative, while published new cities can be selected without inventing coordinates', () => {
  const cities = mergePublishedCities([{ name: 'Київ', latitude: 0, longitude: 0 }, { name: 'Ніжин', latitude: 51.04, longitude: 31.88 }, { name: 'Без центру', latitude: null, longitude: null }])
  assert.equal(cities.length, UKRAINIAN_CITIES.length + 2)
  assert.equal(cities.find(city => city.name === 'Київ')?.lat, findCity('Київ')!.lat)
  assert.equal(cities.find(city => city.name === 'Ніжин')?.centerAvailable, true)
  assert.equal(cities.find(city => city.name === 'Без центру')?.centerAvailable, false)
  for (const name of targetCities) { const city = findCity(name)!; assert.ok(city.lat > 44 && city.lat < 53 && city.lng > 22 && city.lng < 41) }
})

test('100+ sources use batched facts before optional geocoding and produce an end-of-run summary', async () => {
  const sources = Array.from({ length: 105 }, (_, id) => ({ id: String(id), type: 'scale-fixture', auto_publish: id % 2 === 0 }))
  const writes: any[] = [], logs: string[] = [], calls: string[] = []
  registerAdapter('scale-fixture', async source => [{ title: 'Концерт', place: 'Зала', starts_at: '2099-01-01T18:00Z', external_id: source.id, fingerprint: source.id, dedup_hash: source.id, latitude: null, longitude: null }])
  const db = { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, range: async (first: number, last: number) => ({ data: sources.slice(first, last + 1), error: null }) }; return q }, rpc: async (name: string, args: any) => {
    calls.push(name)
    if (name === 'poruch_ingest_claim') return { data: 'token', error: null }
    if (name === 'poruch_ingest_batch') { writes.push(args); return { data: args.p_items.map(item => ({ result: 'inserted', external_id: item.external_id })), error: null } }
    return { data: null, error: null }
  } }
  let lookups = 0
  const original = console.log; console.log = value => logs.push(value)
  try {
    const summary = await runIngest(db, undefined, { geocode: async () => { assert.equal(writes.length, 105); lookups++; return null } })
    assert.equal(summary.processed, 105); assert.equal(summary.events, 105); assert.equal(summary.failed, 0); assert.equal(lookups, 105)
    assert.equal(writes[0].p_items[0].auto_publish_eligible, true)
    assert.equal(writes[1].p_items[0].auto_publish_eligible, false)
    assert.ok(logs.at(-1)!.includes('"summary"'))
  } finally { console.log = original }
})
test('timed-out and failed sources do not block later sources or leave background inserts', async () => {
  registerAdapter('timeout-fixture', async source => { if (source.id === 'slow') await new Promise(resolve => setTimeout(resolve, 40)); if (source.id === 'bad') throw Error('failed'); return [{ title: 'Концерт', place: 'Зала', starts_at: '2099-01-01T18:00Z', external_id: source.id, dedup_hash: source.id, latitude: 50, longitude: 30 }] })
  const sources = ['slow','bad','ok'].map(id => ({ id, type: 'timeout-fixture' })), saved: string[] = []
  const db = { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: sources, error: null }) }; return q }, rpc: async (name: string, args: any) => { if (name === 'poruch_ingest_claim') return { data: 'token', error: null }; if (name === 'poruch_ingest_batch') { saved.push(args.p_source); return { data: [{ result: 'inserted' }], error: null } } return { data: null, error: null } } }
  const original = console.log; console.log = () => {}
  try { const summary = await runIngest(db, undefined, { sourceTimeoutMs: 10 }); await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(summary.failed, 2); assert.deepEqual(saved, ['ok']) } finally { console.log = original }
})
test('scaling SQL keeps admin checks, disables auto on imports, validates auto approval and filters published cities', () => {
  const sql = fs.readFileSync('supabase/migrations/20261116130000_event_source_scaling.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('docs/sql/event-source-scaling.sql', 'utf8'))
  assert.match(sql, /poruch_private.is_admin\(\)/)
  assert.match(sql, /char_length\(btrim\(item.title\)\)>=3/)
  assert.match(sql, /item.starts_at>now\(\)/)
  assert.match(sql, /if auto_enabled.*not duplicate/)
  assert.match(sql, /where s.enabled and e.status='approved'/)
  assert.match(sql, /create trigger poruch_source_url_unique/)
  assert.doesNotMatch(sql, /tow_leads|svoya_/)
})
