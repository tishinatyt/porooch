import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const users = [{ id: 'one' }, { id: 'two' }]
let supaUser: { id: string } | null = users[0]
const ok = (data: any) => ({ data, error: null })
function pending() { let resolve!: (result: any) => void; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const memberships: ReturnType<typeof pending>[] = []
const chatRequests: ReturnType<typeof pending>[] = []
const channels: { name: string; handlers: { filter: any; cb: () => void }[] }[] = []
mock.module('../src/contexts/AuthContext.tsx', { namedExports: { useAuth: () => ({ supaUser }) } })
mock.module('../src/components/TopBar.tsx', { defaultExport: () => null })
mock.module('../src/components/EventMedia.tsx', { defaultExport: () => null })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: (table: string) => {
    let selected = ''; let eventIds: string[] = []
    const b: any = {
      select: (fields: string) => { selected = fields; return b }, eq: () => b,
      in: (_: string, ids: string[]) => { eventIds = ids; return b }, order: () => b,
      then: (resolve: any, reject: any) => {
        if (selected === 'event_id, role, status') { const p = pending(); memberships.push(p); return p.promise.then(resolve, reject) }
        const rows = table === 'events' ? eventIds.map(id => ({ id, title: `Event ${id}`, event_datetime: '2099-01-01', organizer: null })) : []
        return Promise.resolve(ok(rows)).then(resolve, reject)
      },
    }
    return b
  },
  rpc: (name: string) => {
    if (name === 'get_accessible_event_chat_unread_counts') return Promise.resolve(ok([]))
    const p = pending(); chatRequests.push(p); return p.promise
  },
  channel: (name: string) => { const c = { name, handlers: [] as { filter: any; cb: () => void }[], on: (_: string, filter: any, cb: () => void) => { c.handlers.push({ filter, cb }); return c }, subscribe: () => c }; channels.push(c); return c },
  removeChannel: async () => {},
} } })
const { useMyEvents } = await import('../src/hooks/useMyEvents.ts')
const { default: Chats } = await import('../src/pages/Chats.tsx')
let state: ReturnType<typeof useMyEvents>
function MyEvents() { state = useMyEvents(); return <output>{JSON.stringify(state.events)}</output> }
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
async function render(chats = false) { await act(async () => root.render(<MemoryRouter>{chats ? <Chats /> : <MyEvents />}</MemoryRouter>)) }
async function mount(chats = false) { supaUser = users[0]; memberships.length = 0; chatRequests.length = 0; channels.length = 0; root = createRoot(container); await render(chats) }
async function unmount() { await act(async () => root.unmount()) }
async function membership(index: number, id: string) { await act(async () => memberships[index].resolve(ok([{ event_id: id, role: 'participant', status: 'joined' }]))) }
async function chat(index: number, title: string) { await act(async () => chatRequests[index].resolve(ok([{ event_id: title, event_title: title, chat_id: title, event_datetime: '2099-01-01', event_status: 'upcoming', member_role: 'participant', category: 'other', last_message: null }]))) }
async function refresh(name: string) { await act(async () => channels.findLast(c => c.name.startsWith(name))!.handlers.find(h => h.filter.table === 'events')!.cb()) }
after(() => dom.window.close())

test('My Events ignores old account responses and clears on logout', async () => {
  await mount()
  try {
    supaUser = users[1]; await render()
    await membership(1, 'two')
    await membership(0, 'one')
    assert.deepEqual(state.events.map(event => event.eventId), ['two'])
    supaUser = null; await render()
    assert.deepEqual(state.events, [])
    assert.equal(state.pendingRequestCount, 0)
    assert.equal(state.loading, false)
  } finally { await unmount() }
})

test('My Events background refresh preserves cards on errors and applies only latest realtime result', async () => {
  await mount()
  try {
    await membership(0, 'initial')
    await refresh('my-events:')
    assert.equal(state.loading, false)
    assert.equal(state.events[0].eventId, 'initial')
    await act(async () => memberships[1].resolve({ data: null, error: { message: 'fixture error' } }))
    assert.equal(state.events[0].eventId, 'initial')
    await refresh('my-events:'); await refresh('my-events:')
    await membership(3, 'newest'); await membership(2, 'obsolete')
    assert.equal(state.events[0].eventId, 'newest')
  } finally { await unmount() }
})

test('Chat list ignores old account responses and clears on logout', async () => {
  await mount(true)
  try {
    supaUser = users[1]; await render(true)
    await chat(1, 'New account chat'); await chat(0, 'Private old chat')
    assert.match(container.textContent!, /New account chat/)
    assert.doesNotMatch(container.textContent!, /Private old chat/)
    supaUser = null; await render(true)
    assert.doesNotMatch(container.textContent!, /New account chat/)
  } finally { await unmount() }
})

test('Chat list reacts to event edits, handles errors, and rejects older realtime responses', async () => {
  await mount(true)
  try {
    await chat(0, 'Original title')
    await refresh('chat-list:'); await refresh('chat-list:')
    await chat(2, 'Edited title'); await chat(1, 'Obsolete title')
    assert.match(container.textContent!, /Edited title/)
    assert.doesNotMatch(container.textContent!, /Obsolete title|Original title/)
    await refresh('chat-list:')
    await act(async () => chatRequests[3].resolve({ data: null, error: { message: 'fixture error' } }))
    assert.ok(container.querySelector('[role="alert"]'))
    await refresh('chat-list:'); await chat(4, 'Recovered title')
    assert.equal(container.querySelector('[role="alert"]'), null)
    assert.match(container.textContent!, /Recovered title/)
  } finally { await unmount() }
})
