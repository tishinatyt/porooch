import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/create', pretendToBeVisual: true })
for (const key of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
let decodeFails = false
Object.defineProperty(globalThis, 'Image', { value: class {
  naturalWidth = 100; naturalHeight = 100
  onload!: () => void; onerror!: () => void
  set src(_url: string) { queueMicrotask(() => decodeFails ? this.onerror() : this.onload()) }
}, configurable: true })
const urls = new Set<string>()
let urlCounter = 0
mock.method(URL, 'createObjectURL', () => { const url = `blob:test-${++urlCounter}`; urls.add(url); return url })
mock.method(URL, 'revokeObjectURL', (url: string) => { urls.delete(url) })

const uploads: any[] = []
const writes: any[] = []
let uploadFails = false
let saveFails = false
const originalUrl = 'https://example.test/old-cover.jpg'
const savedEvent = { event_type: 'public', is_public: true, join_mode: 'open', title: 'Fixture event', description: '', category: 'other', cover_photo_url: originalUrl, event_datetime: '2099-01-01T12:00:00Z', address_text: 'Чернігів', max_participants: 10, min_age: 18, max_age: 60, gender_filter: 'any', bank_enabled: false, bank_note: null }
function eventQuery() {
  const q: any = {
    select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: savedEvent, error: null }),
    single: async () => ({ data: saveFails ? null : { id: 'saved-event' }, error: saveFails ? { message: 'fixture save failure' } : null }),
    insert: (payload: any) => { writes.push({ method: 'insert', payload }); return q },
    update: (payload: any) => { writes.push({ method: 'update', payload }); return q },
  }; return q
}
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: () => eventQuery(),
  rpc: () => ({ single: async () => ({ data: { lat: 51.5, lng: 31.3 }, error: null }) }),
  storage: { from: (bucket: string) => ({
    upload: async (path: string, file: File, options: any) => { uploads.push({ bucket, path, file, options }); return { error: uploadFails ? { message: 'fixture upload failure' } : null } },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/storage/${path}` } }),
  }) },
} } })
const user = { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => ({ supaUser: user }) } })
mock.module('../src/contexts/DiscoveryCityContext.tsx', { namedExports: { useDiscoveryCity: () => ({ city: { lat: 51.5, lng: 31.3 } }) } })
mock.module('../src/components/TopBar.tsx', { defaultExport: () => null })
mock.module('../src/components/CreateEventMap.tsx', { defaultExport: ({ onPick }: any) => <button type="button" onClick={() => onPick(51.5, 31.3)}>Pick fixture location</button> })
mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ display_name: 'Чернігів' }) }) as any)
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route } = await import('react-router-dom')
const { default: CreateEvent } = await import('../src/pages/CreateEvent.tsx')
const { validateEventCover } = await import('../src/lib/eventCover.ts')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
const photo = () => new File(['fixture-image'], 'photo.jpg', { type: 'image/jpeg' })
async function mount(edit = false, type = 'public') {
  uploads.length = 0; writes.length = 0; uploadFails = false; saveFails = false; decodeFails = false
  root = createRoot(container)
  await act(async () => root.render(<MemoryRouter initialEntries={[edit ? '/event/fixture/edit' : `/create?type=${type}`]}><Routes><Route path="/create" element={<CreateEvent />} /><Route path="/event/:eventId/edit" element={<CreateEvent />} /><Route path="/event/saved-event" element={<p>Saved fixture</p>} /></Routes></MemoryRouter>))
}
async function unmount() { await act(async () => root.unmount()); assert.equal(urls.size, 0, 'local object URLs are released') }
async function choose(file?: File) {
  const input = container.querySelector<HTMLInputElement>('#cover_file')!
  await act(async () => { Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })) })
}
async function input(id: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(`#${id}`)!
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })) })
}
async function click(text: string) { await act(async () => { const b = [...container.querySelectorAll('button')].find(b => b.textContent === text); assert.ok(b, text); b.click() }) }
async function submit() { await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function validNewForm() { await input('title', 'Fixture new event'); await input('event_date', '2099-01-01'); await click('Pick fixture location') }
after(() => dom.window.close())

test('event cover rejects unsupported, empty, oversized and unreadable images without uploads; existing cover survives', async () => {
  assert.throws(() => validateEventCover(new File(['x'], 'bad.svg', { type: 'image/svg+xml' })), /JPG/)
  assert.throws(() => validateEventCover(new File([], 'empty.jpg', { type: 'image/jpeg' })), /порожній/)
  assert.throws(() => validateEventCover(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })), /5 МБ/)
  await mount(true)
  try {
    await choose(new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }))
    assert.match(container.textContent!, /Оберіть зображення у форматі/)
    decodeFails = true; await choose(photo())
    assert.match(container.textContent!, /Не вдалося прочитати/)
    assert.equal(container.querySelector('#cover_photo_url')?.getAttribute('value'), originalUrl)
    assert.equal(uploads.length, 0)
  } finally { await unmount() }
})

test('selection is a local preview, cancel keeps it, remove and unmount do not upload', async () => {
  await mount()
  try {
    await choose(photo()); assert.match(container.querySelector<HTMLImageElement>('img[alt="Попередній перегляд обкладинки"]')!.src, /^blob:/)
    await choose(); assert.match(container.textContent!, /photo.jpg/)
    assert.equal(uploads.length, 0)
    await click('Прибрати фото'); assert.equal(container.querySelector('img[alt="Попередній перегляд обкладинки"]'), null)
    await choose(photo()); assert.equal(uploads.length, 0)
  } finally { await unmount() }
})

test('both personal and public events upload once on save and persist a durable owner-scoped URL', async () => {
  for (const type of ['personal', 'public']) {
    await mount(false, type)
    try {
      await choose(photo()); await submit(); assert.equal(uploads.length, 0, 'invalid form cannot upload')
      await validNewForm(); await submit()
      assert.equal(uploads.length, 1); assert.equal(writes.length, 1)
      assert.equal(uploads[0].bucket, 'avatars')
      assert.match(uploads[0].path, new RegExp(`^${user.id}/event-covers/[a-f0-9-]+\\.jpg$`))
      assert.deepEqual(uploads[0].options, { contentType: 'image/jpeg', upsert: false })
      assert.equal(writes[0].payload.cover_photo_url, `https://example.test/storage/${uploads[0].path}`)
      assert.equal(writes[0].payload.event_type, type)
      assert.match(container.textContent!, /Saved fixture/)
    } finally { await unmount() }
  }
})

test('upload failure prevents event write and allows retry; save failure reuses a successful upload', async () => {
  await mount(true)
  try {
    await choose(photo()); uploadFails = true; await submit()
    assert.equal(writes.length, 0); assert.match(container.textContent!, /Не вдалося завантажити обкладинку/)
    assert.equal(container.querySelector('fieldset')!.disabled, false)
    uploadFails = false; saveFails = true
    const log = mock.method(console, 'error', () => {})
    await submit(); log.mock.restore()
    assert.equal(uploads.length, 2); assert.equal(writes.length, 1)
    const url = writes[0].payload.cover_photo_url
    assert.notEqual(url, originalUrl)
    saveFails = false; await submit()
    assert.equal(uploads.length, 2, 'retry reuses uploaded image')
    assert.equal(writes[1].payload.cover_photo_url, url)
    assert.equal(writes[1].method, 'update')
    assert.match(container.textContent!, /Saved fixture/)
  } finally { await unmount() }
})

test('editing keeps an existing cover, can remove it, and still accepts URL covers', async () => {
  for (const mode of ['keep', 'remove', 'url']) {
    await mount(true)
    try {
      if (mode === 'remove') await click('Прибрати фото')
      if (mode === 'url') { await choose(photo()); await input('cover_photo_url', 'https://example.test/new.jpg') }
      await submit()
      assert.equal(uploads.length, 0)
      assert.equal(writes[0].payload.cover_photo_url, mode === 'keep' ? originalUrl : mode === 'remove' ? null : 'https://example.test/new.jpg')
    } finally { await unmount() }
  }
})
