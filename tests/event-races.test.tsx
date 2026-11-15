import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
function deferred<T = any>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const requests: { id: string; result: ReturnType<typeof deferred> }[] = []
let holdParticipants = false
const participantRequests: { id: string; result: ReturnType<typeof deferred> }[] = []
const subscriptions: (() => void)[] = []
const ok = (data: any) => ({ data, error: null })
mock.module('../src/lib/eventParticipation.ts', { namedExports: { joinEventParticipation: async () => ({ error: null, status: 'joined' }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  from: (table: string) => ({ select: () => ({ eq: (_: string, id: string) => {
    if (table === 'events') return { single: () => { const result = deferred(); requests.push({ id, result }); return result.promise } }
    if (holdParticipants) { const result = deferred(); participantRequests.push({ id, result }); return result.promise }
    return Promise.resolve(ok([{ id: `p-${id}`, event_id: id, user_id: `u-${id}`, role: 'participant', status: 'joined' }]))
  } }) }),
  rpc: (name: string, args: any) => name === 'get_event_coords' ? { single: async () => ok({ lat: args.p_event_id === 'A' ? 1 : 2, lng: 3 }) } : Promise.resolve(ok(1)),
  channel: () => { const channel = { on: (_: string, __: any, cb: () => void) => { subscriptions.push(cb); return channel }, subscribe: () => channel }; return channel },
  removeChannel: async () => {},
} } })
const { createRoot } = await import('react-dom/client')
const { useEvent } = await import('../src/hooks/useEvent.ts')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof useEvent>
function Screen({ id }: { id: string }) { current = useEvent(id); return <output>{JSON.stringify({ event: current.event, participants: current.participants, loading: current.loading })}</output> }
async function render(id: string) { await act(async () => root.render(<Screen id={id} />)) }
async function mount(id: string) { requests.length = 0; participantRequests.length = 0; subscriptions.length = 0; holdParticipants = false; root = createRoot(container); await render(id) }
async function complete(index: number, title: string, error = false) { await act(async () => requests[index].result.resolve(error ? { data: null, error: { message: 'stale error' } } : ok({ id: requests[index].id, title, organizer: null }))) }
async function unmount() { await act(async () => root.unmount()) }
after(() => dom.window.close())

test('useEvent A→B→A ignores both old A success and B error, including participant/count state', async () => {
  await mount('A')
  try {
    await render('B'); await render('A')
    assert.deepEqual(requests.map(r => r.id), ['A', 'B', 'A'])
    await complete(2, 'current A')
    await complete(0, 'obsolete A')
    await complete(1, '', true)
    assert.equal(current.event?.title, 'current A')
    assert.equal(current.participants[0].event_id, 'A')
    assert.equal(current.participantCount, 1)
    assert.equal(current.error, null)
    assert.equal(current.loading, false)
    await render('B')
    assert.equal(current.event, null)
    assert.deepEqual(current.participants, [])
    assert.equal(current.loading, true)
  } finally { await unmount() }
})

test('useEvent ignores obsolete A even when it resolves before the second A load', async () => {
  await mount('A')
  try {
    await render('B'); await render('A')
    await complete(0, 'obsolete A')
    assert.equal(current.event, null)
    assert.equal(current.loading, true)
    await complete(2, 'latest A')
    assert.equal(current.event?.title, 'latest A')
    await render('')
    assert.equal(current.event, null)
    assert.equal(current.loading, false)
    await complete(1, 'obsolete B')
    assert.equal(current.event, null)
  } finally { await unmount() }
})

test('useEvent participant refreshes respect request order and cannot cross A→B→A', async () => {
  await mount('A')
  try {
    await complete(0, 'A')
    holdParticipants = true
    await act(async () => subscriptions.at(-1)!())
    await render('B'); await render('A')
    await act(async () => {
      participantRequests[2].result.resolve(ok([{ id: 'current', event_id: 'A' }]))
      requests[2].result.resolve(ok({ id: 'A', title: 'new A', organizer: null }))
    })
    await act(async () => participantRequests[0].result.resolve(ok([{ id: 'old', event_id: 'A' }])))
    assert.equal(current.participants[0].id, 'current')
    await act(async () => { subscriptions.at(-1)!(); subscriptions.at(-1)!() })
    await act(async () => participantRequests[4].result.resolve(ok([{ id: 'newest', event_id: 'A' }])))
    await act(async () => participantRequests[3].result.resolve(ok([{ id: 'older', event_id: 'A' }])))
    assert.equal(current.participants[0].id, 'newest')
  } finally { await unmount() }
})

test('useEvent ignores a response after unmount', async () => {
  await mount('A'); await unmount()
  await complete(0, 'unmounted')
  assert.equal(container.textContent, '')
})
