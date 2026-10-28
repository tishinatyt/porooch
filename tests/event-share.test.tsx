import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { eventAuthRedirect, eventReturnPath } from '../src/lib/eventLinks.ts'

const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://tishinatyt.github.io/porooch/event/fixture?code=secret#access_token=secret', pretendToBeVisual: true })
for (const key of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const copies: string[] = []
const shares: ShareData[] = []
let copyFails = false
let shareError: Error | null = null
function clipboard(available = true) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: available ? { writeText: async (url: string) => { if (copyFails) throw new Error('Denied'); copies.push(url) } } : undefined })
}
function nativeShare(available = true) {
  Object.defineProperty(navigator, 'share', { configurable: true, value: available ? async (data: ShareData) => { if (shareError) throw shareError; shares.push(data) } : undefined })
}
clipboard(); nativeShare()
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  auth: { updateUser: async () => ({ error: null }) },
} } })
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => ({
  supaUser: { id: 'fixture-user', user_metadata: { poruch_onboarding: 'interests' } },
  profile: { name: 'Fixture', city: 'Київ', avatar_url: 'https://example.test/avatar.jpg', interests: ['Кава', 'Кіно'] },
  refreshProfile: async () => {},
}) } })
mock.module('../src/components/BrandLogo.tsx', { defaultExport: () => null })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const { default: EventShare } = await import('../src/components/event-detail/EventShare.tsx')
const { default: Onboarding } = await import('../src/pages/Onboarding.tsx')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
const expectedUrl = 'https://tishinatyt.github.io/porooch/event/fixture'
async function mount(isPublic = true) {
  copyFails = false; shareError = null; copies.length = 0; shares.length = 0
  root = createRoot(container)
  await act(async () => root.render(<MemoryRouter basename="/porooch" initialEntries={['/porooch/event/fixture?code=secret#access_token=secret']}><EventShare eventId="fixture" title="Прогулянка містом" isPublic={isPublic} /></MemoryRouter>))
}
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === text); assert.ok(button, text); button.click() }) }
async function unmount() { await act(async () => root.unmount()) }
after(() => dom.window.close())

test('share copies a canonical event URL with deployment basename and no auth/query fragments', async () => {
  clipboard(); nativeShare(false); await mount()
  try {
    assert.equal(container.querySelector('input'), null)
    await click('Поділитися')
    assert.equal(container.querySelector('input')!.value, expectedUrl)
    assert.doesNotMatch(container.textContent!, /Надіслати через/)
    await click('Копіювати посилання')
    assert.deepEqual(copies, [expectedUrl])
    assert.match(container.querySelector('[role=status]')!.textContent!, /скопійовано/)
    await click('Поділитися'); assert.equal(container.querySelector('input'), null)
  } finally { await unmount() }
})

test('denied or missing clipboard offers a selected manual-copy field, never false success', async () => {
  for (const available of [true, false]) {
    clipboard(available); await mount(); copyFails = true
    try {
      await click('Поділитися'); await click('Копіювати посилання')
      const input = container.querySelector('input')!
      assert.equal(document.activeElement, input)
      assert.equal(input.selectionEnd, expectedUrl.length)
      assert.match(container.querySelector('[role=status]')!.textContent!, /вручну/)
      assert.equal(copies.length, 0)
    } finally { await unmount() }
  }
})

test('native sharing sends only title and clean URL; cancel is quiet and failure keeps copying available', async () => {
  clipboard(); nativeShare(); await mount(false)
  try {
    await click('Поділитися')
    assert.match(container.textContent!, /не надає запрошення/)
    await click('Надіслати через…')
    assert.deepEqual(shares, [{ title: 'Прогулянка містом', url: expectedUrl }])
    shareError = Object.assign(new Error('Cancel'), { name: 'AbortError' })
    await click('Надіслати через…'); assert.equal(container.querySelector('[role=status]')!.textContent, '')
    shareError = new Error('Unavailable'); await click('Надіслати через…')
    assert.match(container.querySelector('[role=status]')!.textContent!, /Не вдалося/)
    await click('Копіювати посилання'); assert.deepEqual(copies, [expectedUrl])
  } finally { await unmount() }
})

test('onboarding returns to the shared event while other entry routes keep their home destination', async () => {
  function Form() { const location = useLocation(); return <><output>{location.pathname}</output><Onboarding /></> }
  for (const [entry, destination] of [['/event/fixture', '/event/fixture'], ['/create', '/']]) {
    root = createRoot(container)
    await act(async () => root.render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="*" element={<Form />} /></Routes></MemoryRouter>))
    try {
      await click('ГОТОВО')
      assert.equal(container.querySelector('output')!.textContent, destination)
    } finally { await unmount() }
  }
})

test('OAuth return paths allow only local event details within the deployment base', () => {
  assert.equal(eventAuthRedirect('/porooch/event/fixture', '/porooch/', 'https://tishinatyt.github.io'), expectedUrl)
  assert.equal(eventAuthRedirect('/event/fixture', '/', 'http://localhost:5173'), 'http://localhost:5173/event/fixture')
  for (const path of ['/other/event/fixture', '/porooch/event/fixture/edit', '//evil.test/event/fixture', '/porooch/event/%2F%2Fevil.test', '/porooch/event/..']) {
    assert.equal(eventAuthRedirect(path, '/porooch/', 'https://tishinatyt.github.io'), 'https://tishinatyt.github.io/porooch/')
  }
  assert.equal(eventReturnPath('https://evil.test/event/fixture'), '/')
})

test('GitHub Pages fallback preserves a directly opened event until the app restores it', () => {
  const saved = new Map<string, string>()
  const sessionStorage = { setItem: (key: string, value: string) => saved.set(key, value), getItem: (key: string) => saved.get(key) ?? null, removeItem: (key: string) => saved.delete(key) }
  let redirected = ''
  const page404 = readFileSync(new URL('../public/404.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1]
  vm.runInNewContext(page404, { sessionStorage, window: { location: { pathname: '/porooch/event/fixture', search: '', hash: '', protocol: 'https:', hostname: 'tishinatyt.github.io', port: '', replace: (url: string) => { redirected = url } } } })
  assert.equal(redirected, 'https://tishinatyt.github.io/porooch/')
  const location = { origin: 'https://tishinatyt.github.io', pathname: '/porooch/' }
  const restore = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>\s*\/\/ Restore[\s\S]*?<\/script>/)![0].replace(/<\/?script>/g, '').replaceAll('%BASE_URL%', '/porooch/')
  vm.runInNewContext(restore, { URL, sessionStorage, window: { location, history: { replaceState: (_state: unknown, _title: string, url: string) => { location.pathname = url } } } })
  assert.equal(location.pathname, '/porooch/event/fixture')
  assert.equal(saved.size, 0)
})
