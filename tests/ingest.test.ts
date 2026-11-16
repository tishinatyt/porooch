import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parseSchemaEvents, dedupHash, kyivDate } from '../scripts/ingest/normalize.mjs'
import { parseRobots } from '../scripts/ingest/robots.mjs'
import { createCrawler, publicAddress, USER_AGENT } from '../scripts/ingest/http.mjs'
import { discover } from '../scripts/ingest/discover.mjs'
import { runIngest } from '../scripts/ingest/run.mjs'

const source = { url: 'https://example.test/events', city: 'Чернігів', default_category: 'other' }
const fixture = fs.readFileSync('tests/fixtures/ingest-events.html', 'utf8')
function html(value: unknown) { return `<script type="application/ld+json">${JSON.stringify(value)}</script>` }

test('JSON-LD graph, references, arrays, nested Event subtypes, offers and facts normalize without network', () => {
  const events = parseSchemaEvents(fixture, source)
  assert.equal(events.length, 2)
  assert.equal(events[0].category, 'music'); assert.equal(events[0].price_from, 300)
  assert.equal(events[0].starts_at, '2099-05-01T16:00:00.000Z')
  assert.equal(events[0].cover_url, 'https://example.test/cover.jpg')
  assert.equal(events[0].place, 'Палац культури'); assert.equal(events[0].latitude, 51.49)
  assert.equal(events[1].category, 'cinema'); assert.equal(events[1].starts_at, '2099-01-02T16:00:00.000Z')
  assert.equal(events[1].event_status, 'EventRescheduled')
  assert.equal(events[0].description, 'Короткий факт про концерт.')
})
test('long descriptions are bounded even in raw JSON; hostile URLs and foreign events are excluded', () => {
  const event = { '@type': 'TheaterEvent', name: 'Подія', startDate: '2099-01-01T15:00Z', location: { name: 'Зала' }, url: '/one', image: 'javascript:alert(1)', description: 'x'.repeat(1000), performer: { biography: 'private long copy' } }
  const [row] = parseSchemaEvents(html(event), { ...source, city: 'Ніжин' })
  assert.equal(row.city, 'Ніжин'); assert.equal(row.cover_url, null)
  assert.equal(row.description.length, 200); assert.equal(row.raw_data.description.length, 200)
  assert.ok(!JSON.stringify(row).includes('private long copy'))
  assert.deepEqual(parseSchemaEvents(html({ ...event, url: 'javascript:alert(1)' }), source), [])
})
test('dedup ignores punctuation and source ids, while rescheduling keeps identity and changes fingerprint/hash', () => {
  const [a] = parseSchemaEvents(fixture, source)
  const b = { ...a, title: ' КОНЦЕРТ Весна ', source_url: 'https://another.test/one', external_id: 'second' }
  assert.equal(dedupHash(a), dedupHash(b))
  assert.notEqual(dedupHash(a), dedupHash({ ...a, starts_at: '2099-05-02T16:00:00.000Z' }))
  const original = { '@type': 'Event', name: 'Play', startDate: '2099-01-01T18:00Z', location: { name: 'Venue' }, url: '/play' }
  const [first] = parseSchemaEvents(html(original), source)
  const [moved] = parseSchemaEvents(html({ ...original, startDate: '2099-01-03T18:00Z', eventStatus: 'https://schema.org/EventCancelled' }), source)
  assert.equal(first.external_id, moved.external_id); assert.notEqual(first.fingerprint, moved.fingerprint)
})
test('Kyiv wall-clock parsing has seasonal offsets and rejects nonexistent dates/times', () => {
  assert.equal(kyivDate('2026-07-01T19:00'), '2026-07-01T16:00:00.000Z')
  assert.equal(kyivDate('2026-01-01T19:00'), '2026-01-01T17:00:00.000Z')
  assert.equal(kyivDate('2026-03-29T03:30'), null)
  assert.equal(kyivDate('2026-02-31T19:00Z'), null)
})
test('robots uses specific bot groups, combines ties, Allow wins equal length and supports wildcard/query/Unicode paths', () => {
  const policy = parseRobots('User-agent: *\nDisallow: /\nUser-agent: PoruchBot\nDisallow: /private\nAllow: /private/public\nDisallow: /*?secret=*\nCrawl-delay: 4\nUser-agent: PoruchBot\nDisallow: /кіно\nDisallow: /same\nAllow: /same\nDisallow: /end$')
  assert.equal(policy.allowed('https://example.test/events'), true)
  assert.equal(policy.allowed('https://example.test/private/one'), false)
  assert.equal(policy.allowed('https://example.test/private/public/one'), true)
  assert.equal(policy.allowed('https://example.test/list?secret=one'), false)
  assert.equal(policy.allowed('https://example.test/%D0%BA%D1%96%D0%BD%D0%BE'), false)
  assert.equal(policy.allowed('https://example.test/same'), true)
  assert.equal(policy.allowed('https://example.test/end'), false)
  assert.equal(policy.allowed('https://example.test/end/more'), true)
  assert.equal(policy.delayMs, 4000)
})
test('crawler never fetches disallowed pages, spaces all requests, and checks redirect destination robots', async () => {
  let clock = 0; const requests: { url: string; time: number }[] = []
  const crawler = createCrawler({ now: () => clock, sleep: async (ms: number) => { clock += ms }, transport: async (url: string) => {
    requests.push({ url, time: clock })
    if (url.endsWith('/robots.txt')) return { status: 200, text: 'User-agent: *\nDisallow: /private\nCrawl-delay: 3' }
    if (url.endsWith('/redirect')) return { status: 302, location: 'https://other.test/private' }
    return { status: 200, text: fixture }
  } })
  assert.equal((await crawler.get('https://example.test/private')).allowed, false)
  assert.equal(requests.length, 1)
  await crawler.get('https://example.test/events')
  assert.equal((await crawler.get('https://example.test/redirect')).allowed, false)
  assert.ok(requests.every((request, i) => i === 0 || request.time - requests[i - 1].time >= 3000))
  assert.ok(!requests.some(request => new URL(request.url).pathname === '/private'))
  assert.equal(USER_AGENT, 'PoruchBot (+https://poruch.fun)')
})
test('robots 503 fails closed, 404 allows; private and mapped addresses are rejected', async () => {
  const denied = createCrawler({ transport: async () => ({ status: 503, text: '' }) })
  await assert.rejects(denied.get(source.url), /robots_unavailable/)
  let now = 0
  const allowed = createCrawler({ now: () => now, sleep: async (ms: number) => { now += ms }, transport: async (url: string) => ({ status: url.endsWith('robots.txt') ? 404 : 200, text: fixture }) })
  assert.equal((await allowed.get(source.url)).allowed, true)
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1']) assert.equal(publicAddress(ip), false, ip)
  assert.equal(publicAddress('8.8.8.8'), true)
})
test('discover distinguishes Event markup from valid normalized records and reports blocked URLs', async () => {
  const results = await discover([source.url, `${source.url}/blocked`], { get: async (url: string) => ({ allowed: !url.endsWith('blocked'), url, text: html({ '@type': 'Event', name: 'No date' }) }) })
  assert.equal(results[0].eventMarkup, true); assert.equal(results[0].events, 0)
  assert.equal(results[1].allowed, false)
})
test('runner respects database daily claim, always finishes failed sources, and does not log keys or page contents', async () => {
  const calls: any[] = [], logs: string[] = []
  const db = { from: () => { const q: any = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: [{ ...source, id: 'skip', type: 'schema_org' }, { ...source, id: 'blocked', type: 'schema_org' }, { ...source, id: 'later', type: 'feed' }], error: null }) }; return q }, rpc: async (name: string, args: any) => { calls.push({ name, args }); return { data: name === 'poruch_ingest_claim' ? args.p_id === 'skip' ? null : 'claim' : null, error: null } } }
  const original = console.log; console.log = value => logs.push(value)
  try {
    const result = await runIngest(db, { get: async () => ({ allowed: false }) })
    assert.equal(result.failed, 2)
    assert.equal(calls.filter(call => call.name === 'poruch_ingest_finish').length, 2)
    assert.ok(!calls.some(call => call.name === 'poruch_ingest_item'))
    assert.ok(logs.every(line => !line.includes('https:') && !line.includes('claim')))
  } finally { console.log = original }
  const env = { ...process.env }; delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY
  const processResult = spawnSync(process.execPath, ['scripts/ingest/run.mjs'], { env, encoding: 'utf8' })
  assert.equal(processResult.status, 1); assert.match(processResult.stderr, /Missing required secrets/)
})
test('SQL copies match, canonical hash is unique, only public projection reads approved, mutation RPCs are service/admin scoped', () => {
  const sql = fs.readFileSync('supabase/migrations/20261116090000_event_ingest.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('docs/sql/event-ingest.sql', 'utf8'))
  assert.match(sql, /dedup_hash text not null unique/)
  assert.match(sql, /last_run_at <= now\(\)-interval '24 hours'/)
  assert.match(sql, /e.status='approved'/)
  assert.match(sql, /reviewed_at=null,reviewed_by=null/)
  assert.doesNotMatch(sql, /tow_leads|svoya_/)
  assert.doesNotMatch(sql, /grant select on public.ingested_events to anon/)
})
