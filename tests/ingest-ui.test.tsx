import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const calls: { name: string; args?: any }[] = []
const sources = [{ id: 'source-one', name: 'Міський театр', city: 'Чернігів', url: 'https://example.test/events', type: 'schema_org', default_category: 'theatre', enabled: true, partner_params: '', last_run_at: null, last_result: 'ok', last_found: 2, last_changed: 1, run_count: 1 }]
let pending = [{ id: 'event-one', title: 'Вистава', city: 'Чернігів', starts_at: '2099-01-01T18:00Z', place: 'Театр', address: 'Центр', source_url: 'https://example.test/play', source: { name: 'Міський театр' }, fingerprint: 'version-one', event_status: 'EventScheduled' }]
let rpcResponse: (name: string, args: any) => Promise<any> = async () => ({ data: 1, error: null })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  rpc: async (name: string, args: any) => { calls.push({ name, args }); return rpcResponse(name, args) },
  from: (table: string) => {
    const filters: any[] = []
    const q: any = {
      select: () => q, order: () => q, eq: (key: string, value: any) => { filters.push([key, value]); return q },
      range: async () => { calls.push({ name: `list:${table}`, args: filters }); return { data: table === 'event_sources' ? sources : pending, count: pending.length, error: null } },
      insert: async (payload: any) => { calls.push({ name: 'insert', args: payload }); return { error: null } },
      update: (payload: any) => { calls.push({ name: 'update', args: payload }); return q },
      then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
    }; return q
  },
} } })
const { createRoot } = await import('react-dom/client')
const { AdminIngest } = await import('../src/components/admin/AdminIngest.tsx')
const { default: ExternalEventCard } = await import('../src/components/home/ExternalEventCard.tsx')
const { useIngestedFeed } = await import('../src/hooks/useIngestedFeed.ts')
const { asExternalEvent, externalUrl, distanceFrom } = await import('../src/lib/ingestedEvents.ts')
const container = document.getElementById('app')!
const external = { id: 'external', title: 'Концерт', starts_at: '2099-01-01T18:00Z', place: 'Зала', address: 'Центр', city: 'Чернігів', category: 'music', latitude: null, longitude: null, price_from: 200, currency: 'UAH', cover_url: null, source_url: 'https://example.test/tickets?seat=1', source_name: 'Квитки', partner_params: 'utm_source=poruch', description: 'Факти' }
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === text); assert.ok(button, text); button.click() }) }
after(() => dom.window.close())

test('moderation is pending-only with city/source filters; single and batch actions carry displayed fingerprints', async () => {
  const root = createRoot(container); calls.length = 0
  await act(async () => root.render(<AdminIngest mode="moderation" />))
  try {
    assert.match(container.textContent!, /Вистава/)
    const sourceLink = container.querySelector<HTMLAnchorElement>('article a')!
    assert.equal(sourceLink.href, 'https://example.test/play')
    for (const [label, value] of [['Місто', 'Чернігів'], ['Джерело', 'source-one']]) await act(async () => { const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
    assert.deepEqual(calls.filter(call => call.name === 'list:ingested_events').at(-1)?.args, [['status', 'pending'], ['city', 'Чернігів'], ['source_id', 'source-one']])
    await click('Опублікувати')
    assert.deepEqual(calls.find(call => call.name === 'poruch_ingest_moderate')?.args, { p_ids: ['event-one'], p_status: 'approved', p_versions: { 'event-one': 'version-one' } })
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await click('Відхилити (1)')
    assert.equal(calls.filter(call => call.name === 'poruch_ingest_moderate').at(-1)?.args.p_status, 'rejected')
    rpcResponse = async () => ({ error: { message: 'event_changed' } })
    await click('Опублікувати')
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /вже змінилася/)
  } finally { rpcResponse = async () => ({ data: 1, error: null }); await act(async () => root.unmount()) }
})
test('source editor accepts an arbitrary Ukrainian city, saves moderation-only configuration and can disable a source', async () => {
  const root = createRoot(container); calls.length = 0
  await act(async () => root.render(<AdminIngest mode="sources" />))
  try {
    const values = ['Місцеві події', 'https://example.test/nizhyn', 'Ніжин', 'utm_source=poruch']
    const inputs = [...container.querySelectorAll<HTMLInputElement>('form input:not([type="checkbox"])')]
    await act(async () => inputs.forEach((input, index) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, values[index]); input.dispatchEvent(new Event('input', { bubbles: true })) }))
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const payload = calls.find(call => call.name === 'insert')!.args
    assert.equal(payload.city, 'Ніжин'); assert.equal(payload.auto_publish, false); assert.equal(payload.partner_params, 'utm_source=poruch')
    await click('Вимкнути')
    assert.deepEqual(calls.find(call => call.name === 'update')?.args, { enabled: false })
  } finally { await act(async () => root.unmount()) }
})
test('external event cards link to source with partner params, have source attribution and no join/chat actions', async () => {
  const root = createRoot(container)
  const event = asExternalEvent(external)!
  await act(async () => root.render(<ExternalEventCard event={event} />))
  try {
    assert.match(container.textContent!, /Джерело: Квитки/)
    assert.match(container.textContent!, /Купити квиток/)
    assert.equal(container.querySelectorAll('button').length, 0)
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a')) {
      assert.equal(new URL(link.href).searchParams.get('utm_source'), 'poruch')
      assert.equal(new URL(link.href).searchParams.get('seat'), '1')
      assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener/)
    }
    assert.equal(externalUrl('javascript:alert(1)'), null)
    assert.equal(externalUrl('https://user:password@example.test'), null)
    assert.equal(distanceFrom(event, 51, 31), null)
    assert.ok(distanceFrom({ ...event, location_lat: 51, location_lng: 31 }, 51, 31)! < 0.001)
  } finally { await act(async () => root.unmount()) }
})
test('external feed A→B→A ignores obsolete responses; failed external queries do not expose stale city data', async () => {
  const requests: { args: any; resolve: (value: any) => void }[] = []
  rpcResponse = (_name, args) => new Promise(resolve => requests.push({ args, resolve }))
  function Probe({ city }: { city: string }) { const feed = useIngestedFeed(city, 'all', '', 10); return <p>{feed.error ? 'error' : feed.rows.map(row => row.title).join(',')}</p> }
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Probe city="A" />))
    await act(async () => root.render(<Probe city="B" />))
    await act(async () => root.render(<Probe city="A" />))
    await act(async () => requests[2].resolve({ data: [{ ...external, title: 'Current A' }], error: null }))
    await act(async () => { requests[0].resolve({ data: [{ ...external, title: 'Old A' }], error: null }); requests[1].resolve({ error: { message: 'old B' } }) })
    assert.equal(container.textContent, 'Current A')
    await act(async () => root.render(<Probe city="C" />))
    assert.equal(container.textContent, '')
    await act(async () => requests[3].resolve({ error: { message: 'offline' } }))
    assert.equal(container.textContent, 'error')
  } finally { rpcResponse = async () => ({ data: 1, error: null }); await act(async () => root.unmount()) }
})
