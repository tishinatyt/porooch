import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/porooch/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} disconnect() {} }, configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const auth = { supaUser: { id: 'fixture-user' }, profile: { city: 'Чернігів', name: 'Fixture', avatar_url: null, age: 30, gender: 'any' } }
const queries: Record<string, number>[] = []
let rpcResponse = async (_args: Record<string, number>) => ({ data: [], error: null })
function chain() { const q: any = { then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) }; for (const key of ['select', 'eq', 'in', 'on', 'subscribe']) q[key] = () => q; return q }
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => auth } })
mock.module('../src/contexts/MyEventsContext.tsx', { namedExports: { useMyEventsContext: () => ({ pendingRequestCountByEvent: {} }) } })
mock.module('../src/contexts/ProfilePreviewContext.tsx', { namedExports: { useProfilePreview: () => ({ openProfilePreview: () => { throw Error('Demo must not open a fake profile') } }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: { from: () => chain(), rpc: async (_name: string, args: Record<string, number>) => { queries.push(args); return rpcResponse(args) }, channel: () => chain(), removeChannel: () => {} } } })
mock.module('../src/components/BrandLogo.tsx', { defaultExport: () => <span>ПОРУЧ</span> })
mock.module('../src/components/home/DiscoveryMap.tsx', { defaultExport: ({ center, events }: any) => <div data-testid="map" data-lat={center.lat}>{events.map((event: any) => <span key={event.id}>{event.title}</span>)}</div> })
mock.module('../src/components/EventMap.tsx', { defaultExport: () => <div>Map</div> })
const eventRequests: string[] = []
mock.module('../src/hooks/useEvent.ts', { namedExports: { useEvent: (id: string) => { eventRequests.push(id); return { event: null, participants: [], participantCount: 0, loading: false, error: null, joinEvent: () => { throw Error('Demo join must not write') } } } } })
const { DiscoveryCityProvider } = await import('../src/contexts/DiscoveryCityContext.tsx')
const { default: HomeScreen } = await import('../src/pages/HomeScreen.tsx')
const { default: EventDetail } = await import('../src/pages/EventDetail.tsx')
const { CITY_STORAGE_KEY, findCity } = await import('../src/lib/cities.ts')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output> }
async function mount() {
  root = createRoot(container)
  await act(async () => { root.render(<MemoryRouter><DiscoveryCityProvider><Routes><Route path="/" element={<HomeScreen />} /><Route path="/event/:id" element={<EventDetail />} /><Route path="/create" element={<Location />} /></Routes></DiscoveryCityProvider></MemoryRouter>) })
}
async function click(text: string) { await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === text || button.querySelector('h3')?.textContent === text)!.click() }) }
async function chooseCity(name: string) {
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label^="Обрати місто:"]')!.click() })
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Місто"]')!
  assert.equal(select.options.length, 25)
  await act(async () => { select.value = name; select.dispatchEvent(new Event('change', { bubbles: true })) })
}
after(() => dom.window.close())
test('city switches inside the platform, queries the chosen coordinates, updates both feeds and persists across reloads', async () => {
  dom.window.localStorage.clear(); queries.length = 0
  await mount()
  try {
    assert.match(container.textContent!, /Кава та знайомство · Чернігів/)
    assert.match(container.textContent!, /Відкрита прогулянка містом · Чернігів/)
    await chooseCity('Львів')
    assert.match(container.textContent!, /Кава та знайомство · Львів/)
    assert.doesNotMatch(container.textContent!, /Кава та знайомство · Чернігів/)
    assert.equal(queries.at(-1)?.user_lat, findCity('Львів')!.lat)
    assert.equal(dom.window.localStorage.getItem(CITY_STORAGE_KEY), findCity('Львів')!.id)
    await click('Карта')
    assert.equal(container.querySelector('[data-testid=map]')?.getAttribute('data-lat'), String(findCity('Львів')!.lat))
    assert.match(container.textContent!, /Відкрита прогулянка містом · Львів/)
  } finally { await act(async () => root.unmount()) }
  await mount()
  try {
    assert.match(container.textContent!, /Кава та знайомство · Львів/)
    await click('Кава та знайомство · Львів')
    assert.match(container.textContent!, /Тестова подія · Особиста/)
    assert.match(container.textContent!, /реєстрація та чат не відкриваються/)
    assert.ok(eventRequests.length > 0 && eventRequests.every(id => id === ''))
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Створити свою подію')!.click() })
    assert.equal(container.querySelector('output')?.textContent, '/create?type=personal')
  } finally { await act(async () => root.unmount()) }
})
test('rapid city changes ignore an older in-flight response', async () => {
  dom.window.localStorage.clear()
  const pending: ((result: any) => void)[] = []
  rpcResponse = () => new Promise(resolve => pending.push(resolve))
  await mount()
  try {
    await chooseCity('Київ')
    await act(async () => { pending[1]({ data: [], error: null }) })
    assert.match(container.textContent!, /Кава та знайомство · Київ/)
    await act(async () => { pending[0]({ data: [{ id: 'stale-event', title: 'STALE', event_datetime: '2099-01-01', category: 'walk', min_age: 18, max_age: 99, gender_filter: 'any', address_text: 'Old city' }], error: null }) })
    assert.doesNotMatch(container.textContent!, /STALE|Кава та знайомство · Чернігів/)
    assert.match(container.textContent!, /Відкрита прогулянка містом · Київ/)
  } finally { rpcResponse = async () => ({ data: [], error: null }); await act(async () => root.unmount()) }
})

test('city, both demo feeds and map change immediately while the server is still loading', async () => {
  dom.window.localStorage.clear()
  const pending: ((result: any) => void)[] = []
  rpcResponse = () => new Promise(resolve => pending.push(resolve))
  await mount()
  try {
    await chooseCity('Одеса')
    assert.match(container.textContent!, /Кава та знайомство · Одеса/)
    assert.match(container.textContent!, /Відкрита прогулянка містом · Одеса/)
    assert.doesNotMatch(container.textContent!, /Кава та знайомство · Чернігів/)
    assert.equal(container.querySelector('[aria-label^="Обрати місто:"]')?.getAttribute('aria-label'), 'Обрати місто: Одеса')
    await click('Карта')
    assert.equal(container.querySelector('[data-testid=map]')?.getAttribute('data-lat'), String(findCity('Одеса')!.lat))
    await chooseCity('Львів')
    assert.equal(container.querySelector('[data-testid=map]')?.getAttribute('data-lat'), String(findCity('Львів')!.lat))
    assert.match(container.textContent!, /Відкрита прогулянка містом · Львів/)
    assert.doesNotMatch(container.textContent!, /Кава та знайомство · Одеса/)
    await click('Стрічка')
    assert.match(container.textContent!, /Кава та знайомство · Львів/)
    // A failed request must preserve the selected city and its examples.
    await act(async () => { pending[2]({ data: null, error: { message: 'Fixture network error' } }) })
    assert.match(container.textContent!, /Не вдалося завантажити реальні події/)
    assert.match(container.textContent!, /Кава та знайомство · Львів/)
    await act(async () => { pending[0]({ data: [], error: null }); pending[1]({ data: [], error: null }) })
    assert.match(container.textContent!, /Відкрита прогулянка містом · Львів/)
  } finally { rpcResponse = async () => ({ data: [], error: null }); await act(async () => root.unmount()) }
})
