import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'ResizeObserver', { value: class { observe() {} disconnect() {} }, configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const auth = { supaUser: { id: 'fixture-user' }, profile: { city: 'Чернігів', name: 'Fixture', avatar_url: null, age: 30, gender: 'any' } }
const queries: Record<string, number>[] = []
let rpcResponse: (_args: Record<string, number>) => Promise<any> = async () => ({ data: [], error: null })
let metadata: any[] = []
const realtime = new Map<string, (payload: any) => void>()
let showDemoEvents = true
mock.module('../src/lib/demoEventsConfig.ts', { namedExports: { demoEventsEnabled: () => showDemoEvents } })
function chain(data: any[] = []) { const q: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) }; for (const key of ['select', 'eq', 'in', 'on', 'subscribe']) q[key] = () => q; return q }
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => auth } })
mock.module('../src/contexts/MyEventsContext.tsx', { namedExports: { useMyEventsContext: () => ({ events: [], loading: false, pendingRequestCount: 0, pendingRequestCountByEvent: {} }) } })
mock.module('../src/contexts/UnreadMessagesContext.tsx', { namedExports: { useUnreadMessages: () => ({ unreadCount: 0 }) } })
mock.module('../src/contexts/AdminContext.tsx', { namedExports: { useAdmin: () => ({ isAdmin: false }) } })
mock.module('../src/contexts/ProfilePreviewContext.tsx', { namedExports: { useProfilePreview: () => ({ openProfilePreview: () => { throw Error('Demo must not open a fake profile') } }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: { from: (table: string) => chain(table === 'events' ? metadata : []), rpc: async (_name: string, args: Record<string, number>) => { queries.push(args); return rpcResponse(args) }, channel: (name: string) => { const q = chain(); q.on = (_event: string, _filter: any, callback: (payload: any) => void) => { realtime.set(name, callback); return q }; return q }, removeChannel: () => {} } } })
mock.module('../src/components/BrandLogo.tsx', { defaultExport: () => <span>ПОРУЧ</span> })
mock.module('../src/components/home/DiscoveryMap.tsx', { defaultExport: ({ center, events }: any) => <div data-testid="map" data-lat={center.lat}>{events.map((event: any) => <span key={event.id}>{event.title}</span>)}</div> })
mock.module('../src/components/EventMap.tsx', { defaultExport: () => <div>Map</div> })
const eventRequests: string[] = []
mock.module('../src/hooks/useEvent.ts', { namedExports: { useEvent: (id: string) => { eventRequests.push(id); return { event: null, participants: [], participantCount: 0, loading: false, error: null, joinEvent: () => { throw Error('Demo join must not write') } } } } })
const { DiscoveryCityProvider } = await import('../src/contexts/DiscoveryCityContext.tsx')
const { default: HomeScreen } = await import('../src/pages/HomeScreen.tsx')
const { default: BottomNav } = await import('../src/components/BottomNav.tsx')
const { default: AppSidebar } = await import('../src/components/AppSidebar.tsx')
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
    assert.equal(container.querySelector('.organizer-section'), null)
    assert.equal(container.querySelectorAll('.organizer-banner').length, 0)
    assert.doesNotMatch(container.textContent!, /продавай на них квитки/)
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
    assert.match(container.textContent!, /Не вдалося завантажити події/)
    assert.match(container.textContent!, /Кава та знайомство · Львів/)
    await act(async () => { pending[0]({ data: [], error: null }); pending[1]({ data: [], error: null }) })
    assert.match(container.textContent!, /Відкрита прогулянка містом · Львів/)
  } finally { rpcResponse = async () => ({ data: [], error: null }); await act(async () => root.unmount()) }
})

function fixtureEvent(overrides: Record<string, unknown> = {}) {
  return { id: 'own-event', title: 'Kyiv personal fixture', category: 'bar', address_text: 'Київ',
    event_datetime: '2099-01-01T15:00:00Z', created_at: '2026-10-26T14:00:00Z', min_age: 18, max_age: 60,
    gender_filter: 'any', distance_km: 1.3, max_participants: 5, participant_count: 1,
    organizer_id: auth.supaUser.id, organizer: { id: auth.supaUser.id, name: 'Fixture', avatar_url: null },
    ...overrides }
}
function setFixtures(rows: any[]) {
  metadata = rows.map(row => ({ id: row.id, event_type: 'personal', is_public: true, join_mode: 'open', bank_enabled: false }))
  rpcResponse = async () => ({ data: rows, error: null })
}
async function refreshEvents() { await act(async () => { realtime.get('events-discovery-feed')!({ eventType: 'UPDATE' }) }) }
function resetFixtures() { metadata = []; rpcResponse = async () => ({ data: [], error: null }); auth.profile.gender = 'any' }

function setMixedFixtures() {
  const rows = ['public', 'personal'].flatMap(type => Array.from({ length: 24 }, (_, index) => fixtureEvent({
    id: `${type}-${index}`, title: `${type.toUpperCase()}_FIXTURE_${index}`, category: index % 2 ? 'theatre' : 'cinema',
  })))
  setFixtures(rows)
  metadata = rows.map(row => ({ id: row.id, event_type: row.id.split('-')[0], is_public: true, join_mode: 'open', bank_enabled: false }))
}
const rail = (type: string) => container.querySelector<HTMLElement>(`#${type}-events-carousel`)!
async function reachEnd(type: string, width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  const element = rail(type)
  const vertical = width >= 1024
  Object.defineProperties(element, vertical ? { clientHeight: { value: 400, configurable: true }, scrollHeight: { value: 3000, configurable: true } } : { clientWidth: { value: 320, configurable: true }, scrollWidth: { value: 3000, configurable: true } })
  if (vertical) element.scrollTop = 2600
  else element.scrollLeft = 2680
  await act(async () => { element.dispatchEvent(new Event('scroll')); element.dispatchEvent(new Event('scroll')) })
}

test('afisha comes first, top category filters affect only afisha, and no duplicate create CTA remains', async () => {
  setMixedFixtures(); await mount()
  try {
    assert.deepEqual([...container.querySelectorAll('section[aria-labelledby]')].map(s => s.getAttribute('aria-labelledby')), ['public-feed-title', 'personal-feed-title'])
    assert.equal(container.querySelectorAll('[aria-label="Категорії подій"]').length, 1)
    const toolbar = container.querySelector('.home-toolbar')!
    assert.ok(toolbar.querySelector('[aria-label="Категорії публічних подій"]'))
    assert.ok(toolbar.querySelector('[aria-label="Режим перегляду подій"]'))
    assert.equal(container.querySelector('.home-city-summary'), null)
    assert.doesNotMatch(container.textContent!, /особисті та публічні події\. Приклади/)
    assert.equal(container.querySelector('#public-feed-title')?.textContent, 'Публічні події')
    assert.equal(container.querySelector('#personal-feed-title')?.textContent, 'Особисті події')
    const filters = container.querySelector('[aria-label="Категорії публічних подій"]')!
    assert.ok(filters.compareDocumentPosition(rail('public')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)
    const before = rail('personal').textContent
    await click('Кіно')
    assert.match(rail('public').textContent!, /PUBLIC_FIXTURE_0/)
    assert.doesNotMatch(rail('public').textContent!, /PUBLIC_FIXTURE_1\b/)
    assert.equal(rail('personal').textContent, before)
    assert.equal(container.querySelectorAll('a[href^="/create"]').length, 0)
    assert.equal(container.querySelector('.organizer-banner'), null)
  } finally { resetFixtures(); await act(async () => root.unmount()) }
})

test('demo-disabled home and map show only real data and honest empty states', async () => {
  showDemoEvents = false
  setFixtures([])
  await mount()
  try {
    assert.equal(container.querySelector('.home-card-demo'), null)
    assert.match(container.textContent!, /Поки немає публічних подій/)
    assert.match(container.textContent!, /Поки немає особистих подій/)
    assert.doesNotMatch(container.textContent!, /Кава та знайомство|Відкрита прогулянка містом/)
    await click('Карта')
    assert.equal(container.querySelector('[data-testid="map"]')!.textContent, '')
    await click('Стрічка')
    setFixtures([fixtureEvent({ title: 'REAL_EVENT' })]); await refreshEvents()
    assert.match(container.textContent!, /REAL_EVENT/)
    assert.equal(container.querySelector('.home-card-demo'), null)
  } finally { showDemoEvents = true; resetFixtures(); await act(async () => root.unmount()) }
})

test('demo-disabled direct example link does not display a demo or request a fake database UUID', async () => {
  showDemoEvents = false; eventRequests.length = 0
  root = createRoot(container)
  try {
    const id = `demo-city-${findCity('Київ')!.id}-public`
    await act(async () => root.render(<MemoryRouter initialEntries={[`/event/${id}`]}><Routes><Route path="/event/:id" element={<EventDetail />} /></Routes></MemoryRouter>))
    assert.doesNotMatch(container.textContent!, /Тестова подія · Публічна|Відкрита прогулянка містом/)
    assert.ok(eventRequests.length > 0 && eventRequests.every(id => id === ''))
  } finally { showDemoEvents = true; await act(async () => root.unmount()) }
})

test('both rails load separate batches on horizontal and vertical end scroll; filters reset afisha paging', async () => {
  for (const width of [360, 1440]) {
    setMixedFixtures(); await mount()
    try {
      assert.equal(rail('public').children.length, 10)
      assert.equal(rail('personal').children.length, 10)
      await reachEnd('public', width)
      assert.equal(rail('public').children.length, 20)
      assert.equal(rail('personal').children.length, 10)
      await reachEnd('personal', width)
      assert.equal(rail('personal').children.length, 20)
      assert.equal(rail('public').children.length, 20)
      await click('Кіно')
      assert.equal(rail('public').children.length, 10)
      assert.equal(rail('personal').children.length, 20)
    } finally { resetFixtures(); await act(async () => root.unmount()) }
  }
})

test('global and personal empty states work independently without adding create links', async () => {
  setMixedFixtures(); await mount()
  try {
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!
    async function find(value: string) {
      await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, value); search.dispatchEvent(new Event('input', { bubbles: true })) })
    }
    await find('PUBLIC_FIXTURE')
    assert.match(container.textContent!, /Поки немає особистих подій/)
    assert.ok(rail('public'))
    await find('PERSONAL_FIXTURE')
    assert.match(container.textContent!, /Поки немає публічних подій/)
    assert.ok(rail('personal'))
    await find('NO_RESULTS')
    assert.match(container.textContent!, /Поки немає особистих подій/)
    assert.match(container.textContent!, /Поки немає публічних подій/)
    assert.equal(container.querySelectorAll('a[href^="/create"]').length, 0)
  } finally { resetFixtures(); await act(async () => root.unmount()) }
})

test('create is a single entry in each responsive navigation with the new label', async () => {
  root = createRoot(container)
  await act(async () => root.render(<MemoryRouter><BottomNav /><AppSidebar /></MemoryRouter>))
  try {
    const links = container.querySelectorAll('a[href="/create"]')
    assert.equal(links.length, 2) // CSS shows exactly one navigation per breakpoint.
    for (const link of links) assert.equal(link.textContent, 'Створити')
    assert.doesNotMatch(container.textContent!, /Додати/)
  } finally { await act(async () => root.unmount()) }
})

test('afisha title and metadata share one detail action without losing long event text', async () => {
  const title = 'Зустріч друзів міста: великий вечір кіно і музики для всіх охочих'
  const address = 'Київ, центральна площа біля театру, головний вхід'
  const description = 'Опис зустрічі для перегляду в картці'
  const event = fixtureEvent({ id: 'public-long', title, address_text: address, description })
  setFixtures([event])
  metadata[0].event_type = 'public'
  await mount()
  try {
    const details = rail('public').querySelector<HTMLButtonElement>('.home-card-details')!
    assert.match(details.textContent!, new RegExp(title))
    assert.match(details.textContent!, new RegExp(address))
    assert.equal(details.querySelector('.home-card-description')!.textContent, description)
    await act(async () => details.click())
    assert.equal(eventRequests.at(-1), 'public-long')
  } finally { resetFixtures(); await act(async () => root.unmount()) }
})

test('Kyiv organizer keeps their edited event after audience changes and reload; other audience and radius filters still apply', async () => {
  dom.window.localStorage.setItem(CITY_STORAGE_KEY, findCity('Київ')!.id)
  auth.profile.gender = 'male'
  setFixtures([fixtureEvent()])
  await mount()
  try {
    assert.match(container.textContent!, /Kyiv personal fixture/)
    // Reproduce the actual saved edit: male organizer invites women.
    setFixtures([fixtureEvent({ gender_filter: 'female' })])
    await refreshEvents()
    assert.match(container.textContent!, /Kyiv personal fixture/)
    setFixtures([
      fixtureEvent({ gender_filter: 'female', min_age: 40, max_age: 60 }),
      fixtureEvent({ id: 'other-gender', title: 'HIDDEN_GENDER', organizer_id: 'other', organizer: null, gender_filter: 'female' }),
      fixtureEvent({ id: 'other-age', title: 'HIDDEN_AGE', organizer_id: 'other', organizer: null, min_age: 40 }),
      fixtureEvent({ id: 'far-own', title: 'HIDDEN_RADIUS', distance_km: 20 }),
      fixtureEvent({ id: 'eligible-other', title: 'VISIBLE_OTHER', organizer_id: 'other', organizer: null }),
    ])
    await refreshEvents()
    assert.match(container.textContent!, /Kyiv personal fixture/)
    assert.match(container.textContent!, /VISIBLE_OTHER/)
    assert.doesNotMatch(container.textContent!, /HIDDEN_GENDER|HIDDEN_AGE|HIDDEN_RADIUS/)
    await click('Карта')
    assert.match(container.querySelector('[data-testid=map]')!.textContent!, /Kyiv personal fixture/)
    assert.doesNotMatch(container.querySelector('[data-testid=map]')!.textContent!, /HIDDEN_/)
  } finally { await act(async () => root.unmount()) }
  await mount()
  try { assert.match(container.textContent!, /Kyiv personal fixture/) }
  finally { resetFixtures(); await act(async () => root.unmount()) }
})

test('realtime refresh keeps cards until replacement data arrives, then applies updates and removals', async () => {
  dom.window.localStorage.setItem(CITY_STORAGE_KEY, findCity('Київ')!.id)
  setFixtures([fixtureEvent()])
  await mount()
  try {
    const pending: ((result: any) => void)[] = []
    rpcResponse = () => new Promise(resolve => pending.push(resolve))
    await refreshEvents()
    assert.match(container.textContent!, /Kyiv personal fixture/)
    await act(async () => { pending[0]({ data: [fixtureEvent({ title: 'Updated fixture' })], error: null }) })
    assert.match(container.textContent!, /Updated fixture/)
    assert.doesNotMatch(container.textContent!, /Kyiv personal fixture/)
    await refreshEvents()
    assert.match(container.textContent!, /Updated fixture/)
    await act(async () => { pending[1]({ data: [], error: null }) })
    assert.doesNotMatch(container.textContent!, /Updated fixture/)
  } finally { resetFixtures(); await act(async () => root.unmount()) }
})
