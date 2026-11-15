import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { eventAuthRedirect } from '../src/lib/eventLinks.ts'

const dom = new JSDOM('<div id="app"></div>', { url: 'https://poruch.fun/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, useLocation, useNavigate } = await import('react-router-dom')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
let auth: any
let savedProfile: any
let navigate: ReturnType<typeof useNavigate>
let oauthDestination = ''
const user = () => ({ id: 'fixture-user', user_metadata: { full_name: 'New User', avatar_url: 'https://example.test/avatar.jpg' } })
function reset(loggedIn: boolean) {
  savedProfile = null
  auth = {
    supaUser: loggedIn ? user() : null, session: loggedIn ? { user: user() } : null, profile: null, loading: false,
    refreshProfile: async () => { auth.profile = savedProfile; root.render(<MemoryRouter><Screen /></MemoryRouter>) },
    signInWithGoogle: async () => {
      oauthDestination = eventAuthRedirect(dom.window.location.pathname, '/', 'https://poruch.fun')
    },
  }
}
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => auth } })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: () => ({
    upsert: async (profile: any) => { savedProfile = profile; return { error: null } },
    update: (fields: any) => ({ eq: async () => { savedProfile = { ...savedProfile, ...fields }; return { error: null } } }),
  }),
  auth: { updateUser: async ({ data }: any) => { auth.supaUser = { ...auth.supaUser, user_metadata: { ...auth.supaUser.user_metadata, ...data } }; return { error: null } } },
} } })
mock.module('../src/components/BrandLogo.tsx', { defaultExport: () => null })
const { default: ProtectedRoute } = await import('../src/components/ProtectedRoute.tsx')
function Screen() {
  const location = useLocation(); navigate = useNavigate()
  return <><output>{location.pathname}</output><ProtectedRoute><p>{location.pathname === '/create' ? 'CREATE FORM' : 'PLATFORM FEED'}</p></ProtectedRoute></>
}
async function render(entry = '/') { await act(async () => root.render(<MemoryRouter initialEntries={[entry]}><Screen /></MemoryRouter>)) }
async function mount(entry = '/') { root = createRoot(container); await render(entry) }
async function unmount() { await act(async () => root.unmount()) }
async function click(label: string) { await act(async () => { const b = [...container.querySelectorAll('button')].find(b => b.textContent === label); assert.ok(b, label); b.click() }) }
after(() => dom.window.close())

test('new OAuth profile created from /create completes both steps into the platform feed', async () => {
  reset(true); await mount('/create')
  try {
    const city = container.querySelector<HTMLSelectElement>('select[aria-label="Місто"]')!
    await act(async () => { city.value = 'Київ'; city.dispatchEvent(new Event('change', { bubbles: true })) })
    await click('ПРОДОВЖИТИ')
    await click('Кава'); await click('Прогулянки'); await click('ГОТОВО')
    assert.equal(savedProfile.name, 'New User')
    assert.deepEqual(savedProfile.interests, ['Кава', 'Прогулянки'])
    assert.equal(auth.supaUser.user_metadata.poruch_onboarding, 'complete')
    assert.equal(container.querySelector('output')!.textContent, '/')
    assert.match(container.textContent!, /PLATFORM FEED/)
    assert.doesNotMatch(container.textContent!, /CREATE FORM/)
  } finally { await unmount() }
})

test('existing profile entering /create after sign-in bypasses onboarding; later home login does not reuse create', async () => {
  reset(false); dom.reconfigure({ url: 'https://poruch.fun/create?returnTo=https://evil.test#old' })
  await mount('/create')
  try {
    await click('УВІЙТИ З GOOGLE')
    assert.equal(oauthDestination, 'https://poruch.fun/create')
    auth.supaUser = user(); auth.session = { user: auth.supaUser }
    auth.profile = { name: 'Existing', city: 'Київ', avatar_url: 'https://example.test/avatar.jpg' }
    await render()
    assert.match(container.textContent!, /CREATE FORM/)
    assert.doesNotMatch(container.textContent!, /КРОК 1 З 2/)
    await act(async () => navigate('/'))
    auth.session = null; auth.supaUser = null; auth.profile = null
    dom.reconfigure({ url: 'https://poruch.fun/' }); await render()
    await click('УВІЙТИ З GOOGLE')
    assert.equal(oauthDestination, 'https://poruch.fun/')
    auth.supaUser = user(); auth.session = { user: auth.supaUser }
    auth.profile = { name: 'Existing', city: 'Київ', avatar_url: 'https://example.test/avatar.jpg' }
    await render()
    assert.match(container.textContent!, /PLATFORM FEED/)
    assert.equal(container.querySelector('output')!.textContent, '/')
  } finally { await unmount() }
})

test('guest hero contains one organizer message and both peer actions at mobile and desktop widths', async () => {
  for (const width of [360, 1440]) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
    reset(false); await mount()
    try {
      const message = 'Створюй свої події та продавай на них квитки разом з Poruch.fun'
      assert.equal(container.textContent!.split(message).length - 1, 1)
      assert.equal(container.querySelectorAll('.landing-hero-actions > *').length, 2)
      assert.equal(container.querySelector('.organizer-section'), null)
      assert.equal(container.querySelector('.organizer-banner'), null)
      assert.match(container.querySelector('.landing-hero-actions')!.textContent!, /Знайти подію.*Створити подію/)
    } finally { await unmount() }
  }
})
