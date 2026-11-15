import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'sessionStorage']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom')
let userId = 'user'
const user = { id: 'user' }
const secondUser = { id: 'user-two' }
const auth = () => ({ supaUser: userId === 'user' ? user : secondUser })
const ok = (data: any) => ({ data, error: null })
const rows = new Map<string, any>()
const inserts: { message: any; resolve: (result: any) => void }[] = []
const channels: { handlers: { filter: any; cb: (payload: any) => any }[] }[] = []
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: auth } })
const markChatRead = async () => {}
mock.module('../src/contexts/UnreadMessagesContext.tsx', { namedExports: { useUnreadMessages: () => ({ markChatRead }) } })
mock.module('../src/components/TopBar.tsx', { defaultExport: () => null })
mock.module('../src/components/home/ParticipantAvatars.tsx', { defaultExport: () => null })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: (table: string) => {
    const filters: Record<string, string> = {}
    const builder: any = {
      select: () => builder, eq: (key: string, value: string) => { filters[key] = value; return builder }, order: () => builder,
      single: () => Promise.resolve(result()), maybeSingle: () => Promise.resolve(result()),
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
      insert: (message: any) => new Promise(resolve => inserts.push({ message, resolve })),
    }
    function result() {
      if (table === 'events') return ok({ title: `Event ${filters.id}`, organizer_id: userId, event_datetime: '2099-01-01', address_text: 'Kyiv' })
      if (table === 'event_participants') return ok([])
      if (table === 'event_chats') return ok({ id: `chat-${filters.event_id}` })
      if (filters.id) return ok(rows.get(filters.id) ?? null)
      return ok([...rows.values()].filter(row => row.event_chat_id === filters.event_chat_id))
    }
    return builder
  },
  channel: () => {
    const channel = { handlers: [] as { filter: any; cb: any }[], on: (_: any, filter: any, cb: any) => { channel.handlers.push({ filter, cb }); return channel }, subscribe: () => channel }
    channels.push(channel); return channel
  },
  removeChannel: async () => {},
} } })
const delivery = await import('../src/lib/chatDelivery.ts')
const { default: EventChat } = await import('../src/pages/EventChat.tsx')
let navigate: ReturnType<typeof useNavigate>
function Navigation() { navigate = useNavigate(); return null }
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
async function mount(id: string) {
  root = createRoot(container)
  await render(id)
}
async function render(id: string) { await act(async () => root.render(<MemoryRouter initialEntries={[`/event/${id}/chat`]}><Navigation /><Routes><Route path="/event/:id/chat" element={<EventChat />} /><Route path="/away" element={<p>Away</p>} /></Routes></MemoryRouter>)) }
async function go(path: string) { await act(async () => navigate(path)) }
async function unmount() { await act(async () => root.unmount()) }
async function type(value: string) {
  const textarea = container.querySelector('textarea')!
  assert.ok(textarea)
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function sendTwice() { await act(async () => { const form = container.querySelector('form')!; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
function save(index: number) { const m = inserts[index].message; rows.set(m.id, { ...m, created_at: '2026-11-14T12:00:00Z', sender: { id: m.sender_id, name: 'Test', avatar_url: null } }); return m }
async function finish(index: number, result = ok(null)) { await act(async () => inserts[index].resolve(result)) }
const sendButton = () => container.querySelector<HTMLButtonElement>('[aria-label="Відправити повідомлення"]')!
after(() => dom.window.close())

test('EventChat sending A→B→A: operation survives, new chat stays usable, realtime/load do not duplicate', async () => {
  await mount('A')
  try {
    await type('message A'); await sendTwice()
    assert.equal(inserts.length, 1)
    const oldChannel = channels.find(c => c.handlers.some(h => h.filter.table === 'event_chat_messages'))!
    await go('/event/B/chat')
    await type('draft B')
    assert.equal(sendButton().disabled, false)
    const m = save(0)
    await act(async () => oldChannel.handlers.find(h => h.filter.table === 'event_chat_messages')!.cb({ new: { id: m.id } }))
    assert.doesNotMatch(container.textContent!, /message A/)
    await finish(0)
    assert.equal(container.querySelector('textarea')!.value, 'draft B')
    await go('/event/A/chat')
    assert.equal(container.querySelector('textarea')!.value, '')
    assert.equal(delivery.getChatDelivery('user:A').sending, false)
    assert.equal(container.textContent!.split('message A').length - 1, 1)
    const active = channels.at(-1)!
    await act(async () => active.handlers.find(h => h.filter.table === 'event_chat_messages')!.cb({ new: { id: m.id } }))
    assert.equal(container.textContent!.split('message A').length - 1, 1)
    await type('next A'); assert.equal(sendButton().disabled, false)
  } finally { await unmount() }
})

test('EventChat unmount during send retains operation; return before completion does not resend', async () => {
  const index = inserts.length
  await mount('unmount')
  await type('survives leaving'); await sendTwice(); await unmount()
  await mount('unmount')
  try {
    assert.equal(sendButton().disabled, true)
    await sendTwice(); assert.equal(inserts.length, index + 1)
    save(index); await finish(index)
    assert.equal(delivery.getChatDelivery('user:unmount').pending, null)
    assert.equal(container.textContent!.split('survives leaving').length - 1, 1)
    await type('next'); assert.equal(sendButton().disabled, false)
  } finally { await unmount() }
})

test('uncertain send result retains exact payload; retry same UUID confirms existing row without duplication', async () => {
  const index = inserts.length
  await mount('retry')
  try {
    await type('once only'); await sendTwice()
    const saved = save(index)
    await finish(index, { data: null, error: { message: 'response lost' } })
    assert.equal(delivery.getChatDelivery('user:retry').sending, false)
    assert.equal(delivery.getChatDelivery('user:retry').pending?.id, saved.id)
    await type('next draft')
    await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Повторити надсилання')!.click() })
    assert.deepEqual(inserts[index + 1].message, inserts[index].message)
    await finish(index + 1, { data: null, error: { code: '23505' } })
    assert.equal(container.querySelector('textarea')!.value, 'next draft')
    assert.equal(delivery.getChatDelivery('user:retry').pending, null)
    assert.equal([...rows.values()].filter(row => row.id === saved.id).length, 1)
    assert.equal(container.textContent!.split('once only').length - 1, 1)
  } finally { await unmount() }
})

test('account switch isolates drafts and ignores old send completion', async () => {
  const index = inserts.length
  await mount('account')
  try {
    await type('private user one'); await sendTwice()
    userId = 'user-two'; await render('account')
    assert.equal(container.querySelector('textarea')!.value, '')
    await type('user two draft')
    save(index); await finish(index)
    assert.equal(container.querySelector('textarea')!.value, 'user two draft')
    assert.doesNotMatch(container.textContent!, /private user one/)
    assert.equal(sendButton().disabled, false)
  } finally { userId = 'user'; await unmount() }
})
