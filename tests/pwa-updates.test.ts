import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { shouldReload } from '../src/lib/pwaUpdates.ts'

test('PWA reloads only for a new worker version, never initial installation, repeats or a stale shell after reload', () => {
  assert.equal(shouldReload('a', 'a', null), false)
  assert.equal(shouldReload('a', null, null), false)
  assert.equal(shouldReload('a', 'b', null), true)
  assert.equal(shouldReload('a', 'b', 'b'), false)
  assert.equal(shouldReload('b', 'b', 'b'), false)
  assert.equal(shouldReload('b', 'c', 'b'), true)
  assert.equal(shouldReload('a', 'b', 'older', 'b'), false, 'history guard wins when a full sessionStorage still returns an older value')
})

test('worker fetches fresh versioned HTML on every navigation, uses offline fallback, and does not cache SW/API documents', async () => {
  const handlers = new Map<string, any>(), stored = new Map<string, Response>(), calls: any[] = []
  let offline = false, body = 'version a'
  const code = fs.readFileSync('pwa/runtime.js', 'utf8').replaceAll('__PORUCH_BUILD_ID__', 'test-b')
  vm.runInNewContext(code, {
    URL, Response,
    self: { registration: { scope: 'https://example.test/app/' }, addEventListener: (event: string, callback: any) => handlers.set(event, callback) },
    fetch: async (url: URL, options: any) => { calls.push({ url: String(url), options }); if (offline) throw Error('offline'); return new Response(body, { headers: { 'Content-Type': 'text/html' } }) },
    caches: { open: async () => ({ put: async (url: URL, response: Response) => stored.set(String(url), response), match: async (url: URL) => stored.get(String(url))?.clone() }) },
  })
  let installation!: Promise<any>
  handlers.get('install')({ waitUntil: (promise: Promise<any>) => { installation = promise } }); await installation
  assert.equal(calls[0].url, 'https://example.test/app/index.html?__poruch_build=test-b')
  assert.equal(calls[0].options.cache, 'no-store')
  async function navigate() {
    let response!: Promise<Response>
    handlers.get('fetch')({ request: { mode: 'navigate', method: 'GET', url: 'https://example.test/app/event/123' }, respondWith: (promise: Promise<Response>) => { response = promise } })
    return (await response).text()
  }
  body = 'version b'; assert.equal(await navigate(), 'version b')
  offline = true; assert.equal(await navigate(), 'version b')
  let intercepted = false
  for (const path of ['sw.js', 'version.json', 'photo.jpg']) handlers.get('fetch')({ request: { mode: 'navigate', method: 'GET', url: `https://example.test/app/${path}` }, respondWith: () => { intercepted = true } })
  assert.equal(intercepted, false)
  let answer: unknown
  handlers.get('message')({ data: { type: 'PORUCH_GET_VERSION' }, ports: [{ postMessage: (value: any) => { answer = value.version } }] })
  assert.equal(answer, 'test-b')
})

test('image consent SQL copies match and the public projection defaults to no source image', () => {
  const sql = fs.readFileSync('supabase/migrations/20261116100000_event_sources_images.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('docs/sql/event-sources-images.sql', 'utf8'))
  assert.match(sql, /use_source_images boolean not null default false/)
  assert.match(sql, /case when s.use_source_images then e.cover_url else null end/)
})
