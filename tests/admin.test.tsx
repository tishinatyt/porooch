import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost/porooch/admin', pretendToBeVisual: true })
for (const key of ['window', 'document', 'location', 'navigator', 'HTMLElement', 'Event', 'MouseEvent', 'KeyboardEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
let auth: any = { supaUser: null, loading: false }
const calls: { name: string; args?: any }[] = []
let response: (name: string, args?: any) => Promise<any>
let oauthOptions: any
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => auth } })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  rpc: (name: string, args?: any) => { calls.push({ name, args }); return response(name, args) },
  auth: { signInWithOAuth: async (options: any) => { oauthOptions = options; return { error: null } } },
} } })
mock.module('../src/components/BrandLogo.tsx', { defaultExport: () => <span>ПОРУЧ</span> })
const { AdminProvider } = await import('../src/contexts/AdminContext.tsx')
const { default: Admin } = await import('../src/pages/Admin.tsx')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
const member = { id: 'member-one', name: 'Test Member', city: 'Київ', email: 'fixture@example.test', email_confirmed: true, is_anonymous: false, created_at: '2026-10-26T10:00:00Z', last_sign_in_at: null, event_count: 2, joined_count: 1 }
const event = { id: 'event-one', title: 'Fixture meeting', description: 'Description', address_text: 'Київ', event_type: 'personal', is_public: true, status: 'upcoming', event_datetime: '2099-01-01T10:00:00Z', organizer_name: 'Fixture', max_participants: 5, participant_count: 1, can_restore: false }
function result(rows: any[] = [member], total = rows.length) { return { rows, total, page: 1, page_size: 25, cities: ['Київ','Львів'], stats: { profiles: 50, new_week: 3, anonymous: 17, events: 50, upcoming_events: 9, cancelled_events: 0 } } }
function setup(allowed = true) {
  calls.length = 0; auth = { supaUser: { id: 'admin', email: 'dr12071980@gmail.com' }, loading: false }
  response = async (name, args) => ({ data: name === 'poruch_is_admin' ? allowed : result(args?.p_section === 'events' ? [event] : [member]), error: null })
}
async function render() { await act(async () => { root.render(<MemoryRouter><AdminProvider><Admin /></AdminProvider></MemoryRouter>) }) }
async function mount() { root = createRoot(container); await render() }
async function unmount() { await act(async () => root.unmount()) }
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === text); assert.ok(button, text); button.click() }) }
async function input(selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  const proto = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value); element.dispatchEvent(new Event('input',{ bubbles: true })) })
}
after(() => dom.window.close())

test('admin route denies logged-out and unauthorized users without loading member data, even if client email is spoofed', async () => {
  setup(false); auth.supaUser = null
  await mount()
  try {
    assert.match(container.textContent!, /Вхід адміністратора/)
    assert.equal(calls.length, 0)
    auth.supaUser = { id: 'other-user', email: 'dr12071980@gmail.com' }
    await render()
    assert.match(container.textContent!, /Вхід адміністратора/)
    assert.ok(calls.every(call => call.name === 'poruch_is_admin'))
    assert.doesNotMatch(container.textContent!, /fixture@example.test/)
    await click('Увійти через Google')
    assert.equal(oauthOptions.provider,'google')
    assert.ok(oauthOptions.options.redirectTo.endsWith('/admin'))
    assert.equal(oauthOptions.options.queryParams.prompt,'select_account')
  } finally { await unmount() }
})

test('authorized admin loads Poruch statistics, searches, filters cities, and paginates on the server', async () => {
  setup()
  response = async (name) => ({ data: name === 'poruch_is_admin' ? true : result([member],26), error: null })
  await mount()
  try {
    assert.match(container.textContent!, /Test Member/)
    assert.match(container.textContent!, /fixture@example.test/)
    await input('input[aria-label="Пошук"]','Test')
    await click('Знайти')
    assert.equal(calls.at(-1)?.args.p_search,'Test')
    const select = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => { select.value='Київ'; select.dispatchEvent(new Event('change',{ bubbles:true })) })
    assert.equal(calls.at(-1)?.args.p_city,'Київ')
    await click('Далі →')
    assert.equal(calls.at(-1)?.args.p_page,2)
    await click('Події')
    assert.equal(calls.at(-1)?.args.p_section,'events')
    assert.equal(calls.at(-1)?.args.p_city,'')
    assert.equal(calls.at(-1)?.args.p_page,1)
  } finally { await unmount() }
})

test('event cancellation requires confirmation and reason, sends expected status and refreshes only after success', async () => {
  setup(); await mount()
  try {
    await click('Події'); await click('Скасувати подію')
    assert.ok(container.querySelector('[role="dialog"]'))
    assert.ok(!calls.some(call => call.name === 'poruch_admin_set_event_status'))
    assert.equal([...container.querySelectorAll('button')].find(b => b.textContent === 'Підтвердити')!.disabled,true)
    await input('textarea','Дубль тестової події')
    await click('Підтвердити')
    assert.deepEqual(calls.find(call => call.name === 'poruch_admin_set_event_status')?.args, { p_event_id: 'event-one', p_action: 'cancel', p_reason: 'Дубль тестової події', p_expected_status: 'upcoming' })
    assert.equal(container.querySelector('[role="dialog"]'),null)
    assert.match(container.textContent!, /Подію скасовано/)
    assert.equal(calls.at(-1)?.name,'poruch_admin_data')
  } finally { await unmount() }
})

test('account switch removes admin data immediately and ignores delayed access/data responses', async () => {
  setup(); await mount()
  try {
    assert.match(container.textContent!, /fixture@example.test/)
    let resolveAccess!: (value: any) => void
    response = () => new Promise(resolve => { resolveAccess = resolve })
    auth.supaUser = { id:'another-user' }
    await render()
    assert.doesNotMatch(container.textContent!, /fixture@example.test/)
    auth.supaUser = null
    await render()
    await act(async () => { resolveAccess({ data:true,error:null }) })
    assert.match(container.textContent!, /Вхід адміністратора/)
    assert.doesNotMatch(container.textContent!, /fixture@example.test/)
  } finally { await unmount() }
})

test('older data response cannot replace a newer section; failed requests show retry without stale member data', async () => {
  setup(); await mount()
  try {
    let resolveOld!: (value: any) => void
    response = (_name,args) => args?.p_section === 'users' ? new Promise(resolve => { resolveOld=resolve }) : Promise.resolve({ data:result([event]),error:null })
    await click('Оновити'); await click('Події')
    assert.match(container.textContent!, /Fixture meeting/)
    await act(async () => { resolveOld({ data:result([member]),error:null }) })
    assert.doesNotMatch(container.textContent!, /fixture@example.test/)
    response = async () => ({ data:null,error:{ message:'offline' } })
    await click('Учасники')
    assert.match(container.textContent!, /Не вдалося завантажити дані/)
    assert.doesNotMatch(container.textContent!, /fixture@example.test/)
  } finally { await unmount() }
})
