import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const calls: { name: string; args?: any }[] = []
let legacySchema = false
const writeError = (payload: any) => legacySchema && Object.hasOwn(payload, 'use_source_images') ? { code: 'PGRST204', message: 'use_source_images column missing' } : null
const sources = [{ id: 'source-one', name: 'Міський театр', city: 'Чернігів', url: 'https://example.test/events', type: 'schema_org', default_category: 'theatre', enabled: true, partner_params: '', last_run_at: null, last_result: 'ok', last_found: 2, last_changed: 1, run_count: 1 }]
let pending = [{ id: 'event-one', title: 'Вистава', city: 'Чернігів', starts_at: '2099-01-01T18:00Z', place: 'Театр', address: 'Центр', source_url: 'https://example.test/play', source: { name: 'Міський театр' }, fingerprint: 'version-one', event_status: 'EventScheduled' }]
let rpcResponse: (name: string, args: any) => Promise<any> = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null })
mock.module('../src/lib/supabase.ts', { namedExports: { supabase: {
  rpc: async (name: string, args: any) => { calls.push({ name, args }); return name === 'poruch_moderation_expire' ? { data: null, error: null } : rpcResponse(name, args) },
  from: (table: string) => {
    const filters: any[] = []
    const q: any = {
      select: () => q, order: () => q, eq: (key: string, value: any) => { filters.push([key, value]); return q },
      ilike: (key:string,value:string)=>{filters.push([key,value]);return q},
      range: async (start: number, end: number) => { calls.push({ name: `list:${table}`, args: filters }); return { data: (table === 'event_sources' ? sources : pending).slice(start,end+1), count: pending.length, error: null } },
      insert: async (payload: any) => { calls.push({ name: 'insert', args: payload }); return { error: writeError(payload) } },
      update: (payload: any) => { calls.push({ name: 'update', args: payload }); q.payload = payload; return q },
      then: (resolve: any) => Promise.resolve({ error: q.payload ? writeError(q.payload) : null }).then(resolve),
    }; return q
  },
} } })
const { createRoot } = await import('react-dom/client')
const { AdminIngest } = await import('../src/components/admin/AdminIngest.tsx')
const { default: PublishedEvents } = await import('../src/components/admin/PublishedEvents.tsx')
const { default: SourceListImport } = await import('../src/components/admin/SourceListImport.tsx')
const { default: ExternalEventCard } = await import('../src/components/home/ExternalEventCard.tsx')
const { default: MapVenuePopup } = await import('../src/components/home/MapVenuePopup.tsx')
const { groupEventSessions } = await import('../src/lib/eventSessions.ts')
const { groupMapVenues } = await import('../src/lib/mapVenues.ts')
const { useIngestedFeed } = await import('../src/hooks/useIngestedFeed.ts')
const { asExternalEvent, externalUrl, distanceFrom, sourceImageUrl, missingImagesColumn } = await import('../src/lib/ingestedEvents.ts')
const container = document.getElementById('app')!
const external = { id: 'external', title: 'Концерт', starts_at: '2099-01-01T18:00Z', place: 'Зала', address: 'Центр', city: 'Чернігів', category: 'music', latitude: null, longitude: null, price_from: 200, currency: 'UAH', cover_url: null, source_url: 'https://example.test/tickets?seat=1', source_name: 'Квитки', partner_params: 'utm_source=poruch', description: 'Факти' }
async function click(text: string) { await act(async () => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === text); assert.ok(button, text); button.click() }) }
after(() => dom.window.close())

test('session badge opens every date with its own ticket link; map popup contains the same complete list',async()=>{
  const root=createRoot(container)
  const dialogProto=dom.window.HTMLDialogElement.prototype as any
  const oldShow=dialogProto.showModal
  dialogProto.showModal=function(){this.setAttribute('open','')}
  const events=[0,1,2].map(index=>asExternalEvent({...external,id:'session-'+index,latitude:50.45,longitude:30.52,starts_at:`2099-01-0${index+1}T18:00:00Z`,source_url:`https://example.test/tickets/day${index+1}`} )!)
  const [group]=groupEventSessions(events)
  try {
    await act(async()=>root.render(<ExternalEventCard event={group}/>))
    await click('ще 2 дат')
    const dialog=document.querySelector('dialog')!
    assert.ok(dialog.hasAttribute('open'))
    assert.equal(dialog.querySelectorAll('li').length,3)
    assert.deepEqual([...dialog.querySelectorAll<HTMLAnchorElement>('li a')].map(a=>a.href),events.map(event=>event.external!.url))
    await act(async()=>dialog.querySelector<HTMLButtonElement>('button')!.click())
    assert.equal(document.querySelector('dialog'),null)
    await act(async()=>root.render(<MapVenuePopup venue={groupMapVenues([group])[0]} onOpen={()=>{throw Error('external sessions must not open native event details')}}/>))
    assert.equal(container.querySelectorAll('article').length,1)
    assert.equal(container.querySelectorAll('li a').length,3)
  } finally {dialogProto.showModal=oldShow;await act(async()=>root.unmount())}
})

test('published admin filters, selected version checks, permanent hide confirmation and category actions across every page',async()=>{
  const root=createRoot(container),original=pending
  pending=[{...original[0],updated_at:'2026-11-17T12:00:00Z',category:'music',source_id:'source-one'}, {...original[0],id:'event-two',title:'Інша вистава',updated_at:'2026-11-17T12:01:00Z',category:'music',source_id:'source-one'}] as any
  calls.length=0;const confirmations:string[]=[];dom.window.confirm=message=>{confirmations.push(message);return true}
  rpcResponse=async()=>({data:{processed:1,skipped:1,done:true},error:null})
  try {
    await act(async()=>root.render(<PublishedEvents/>))
    assert.deepEqual(calls.find(call=>call.name==='list:ingested_events')!.args,[['status','approved']])
    for(const [label,value] of [['Місто','Чернігів'],['Джерело','source-one'],['Категорія події','music']]) await act(async()=>{const input=container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}))})
    await act(async()=>{const input=container.querySelector<HTMLInputElement>('input[aria-label="Пошук за назвою"]')!;Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Show_');input.dispatchEvent(new Event('input',{bubbles:true}))})
    assert.ok(calls.filter(call=>call.name==='list:ingested_events').at(-1)!.args.some(([key,value]:string[])=>key==='title'&&value==='%Show\\_%'))
    await act(async()=>container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await click('Зняти з публікації (2)')
    const selected=calls.filter(call=>call.name==='poruch_published_batch').at(-1)!.args
    assert.deepEqual(selected.p_ids,['event-one','event-two'])
    assert.deepEqual(selected.p_versions,{'event-one':'2026-11-17T12:00:00Z','event-two':'2026-11-17T12:01:00Z'})
    assert.match(container.textContent!,/Оброблено: 1. Пропущено: 1/)
    await click('Приховати назавжди')
    assert.equal(calls.filter(call=>call.name==='poruch_published_batch').at(-1)!.args.p_action,'hide')
    assert.ok(confirmations.at(-1)!.includes('Приховати назавжди'))
    let batch=0
    rpcResponse=async(_name,args)=>{assert.equal(args.p_ids,undefined);assert.equal(args.p_city,'Чернігів');assert.equal(args.p_source,'source-one');assert.equal(args.p_filter_category,'music');return {data:{processed:1,skipped:0,cursor:'cursor',snapshot:'snapshot',done:++batch===2},error:null}}
    await click('Змінити категорію за фільтром (2)')
    assert.equal(batch,2)
    assert.match(container.textContent!,/Оброблено: 2. Пропущено: 0/)
  } finally {pending=original;rpcResponse=async()=>({data:{processed:1,skipped:0,done:true},error:null});await act(async()=>root.unmount())}
})

test('all-filter actions see total 270 despite 25 rendered rows and sum three stable cursor batches for approval and rejection', async () => {
  const root = createRoot(container), original = pending
  pending = Array.from({length:270},(_,i)=>({...original[0],id:'event-'+i,title:'Event '+i}))
  dom.window.confirm = () => true
  try {
    for (const [status,label] of [['approved','Опублікувати'],['rejected','Відхилити']]) {
      calls.length=0; let batch=0
      rpcResponse=async(name,args)=> {
        assert.equal(name,'poruch_moderation_filter_batch')
        assert.equal(args.p_ids,undefined)
        assert.equal(args.p_status,status)
        if(batch>0) assert.equal(args.p_after,'cursor-'+batch)
        batch++
        return {data:{processed:batch===3?70:100,skipped:0,done:batch===3,cursor:'cursor-'+batch,snapshot:'snapshot'},error:null}
      }
      await act(async()=>root.render(<AdminIngest key={status} mode="moderation" />))
      assert.ok(calls.findIndex(call=>call.name==='poruch_moderation_expire') < calls.findIndex(call=>call.name==='list:ingested_events'))
      assert.equal(container.querySelectorAll('article').length,25)
      await click(label+' всі за фільтром (270)')
      assert.equal(batch,3)
      assert.match(container.textContent!,/270. Пропущено: 0/)
    }
  } finally {pending=original;rpcResponse=async()=>({data:{processed:1,skipped:0,done:true},error:null});await act(async()=>root.unmount())}
})

test('partial moderation reports counts and refreshes skipped rows; filtered actions confirm scope and preserve stored category', async () => {
  const root = createRoot(container); calls.length = 0
  const confirmations: string[] = []
  dom.window.confirm = message => { confirmations.push(message); return true }
  rpcResponse = async () => ({ data: { processed: 2, skipped: 1, done: true }, error: null })
  try {
    await act(async () => root.render(<AdminIngest mode="moderation" />))
    await click('Опублікувати')
    assert.match(container.textContent!, /Опубліковано: 2. Пропущено: 1/)
    assert.ok(calls.filter(call => call.name === 'list:ingested_events').length >= 2)
    assert.match(container.querySelector('article')!.textContent!, /Вистава/)
    await act(async () => {
      const city = container.querySelector<HTMLSelectElement>('select[aria-label="Місто"]')!
      city.value = 'Чернігів'; city.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await click('Опублікувати всі за фільтром (1)')
    const args = calls.filter(call => call.name === 'poruch_moderation_filter_batch').at(-1)!.args
    assert.equal(args.p_city, 'Чернігів')
    assert.equal(args.p_ids, undefined)
    assert.equal(args.p_categories, undefined)
    assert.match(confirmations[0], /1/)
    await act(async () => {
      const size = container.querySelector<HTMLSelectElement>('select[aria-label="Подій на сторінці"]')!
      size.value = '100'; size.dispatchEvent(new Event('change', { bubbles: true }))
    })
    assert.match(container.textContent!, /Подій у черзі: 1/)
  } finally { rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})

test('source list import previews duplicates before writing, then submits uniform consent and reports counts', async () => {
  const root = createRoot(container); calls.length = 0; let saved = 0
  rpcResponse = async () => ({ data: { created: 1, skipped: 2 }, error: null })
  try {
    await act(async () => root.render(<SourceListImport urls={['https://example.test/events']} onSaved={() => saved++} />))
    const row = { city: 'Київ', section: 'Концерти', url: 'https://example.test/new', default_category: 'music' }
    await act(async () => {
      const input = container.querySelector('textarea')!
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(input, JSON.stringify([{ ...row, url: 'https://example.test/events/' }, row, row]))
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Переглянути список')
    assert.equal(container.querySelectorAll('tbody tr').length, 3)
    assert.equal(calls.length, 0)
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await click('Підтвердити імпорт')
    const request = calls.find(call => call.name === 'poruch_import_sources')!.args
    assert.equal(request.p_rows.length, 3)
    assert.equal(request.p_use_images, true)
    assert.equal(request.p_enabled, true)
    assert.equal(request.p_rows.some((item: any) => item.auto_publish), false)
    assert.equal(saved, 1)
    assert.match(container.querySelector('[role="status"]')!.textContent!, /1.*2/)
  } finally { rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})

test('moderation is pending-only with city/source filters; single and batch actions carry displayed fingerprints', async () => {
  const root = createRoot(container); calls.length = 0
  await act(async () => root.render(<AdminIngest mode="moderation" />))
  try {
    assert.match(container.textContent!, /Вистава/)
    const sourceLink = container.querySelector<HTMLAnchorElement>('article a')!
    assert.equal(sourceLink.href, 'https://example.test/play')
    for (const [label, value] of [['Місто', 'Чернігів'], ['Джерело', 'source-one']]) await act(async () => { const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
    assert.deepEqual(calls.filter(call => call.name === 'list:ingested_events').at(-1)?.args, [['status', 'pending'], ['city', 'Чернігів'], ['source_id', 'source-one']])
    await click('Опублікувати')
    assert.deepEqual(calls.find(call => call.name === 'poruch_moderation_batch')?.args, { p_ids: ['event-one'], p_status: 'approved', p_versions: { 'event-one': 'version-one' } })
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await click('Відхилити (1)')
    assert.equal(calls.filter(call => call.name === 'poruch_moderation_batch').at(-1)?.args.p_status, 'rejected')
    rpcResponse = async () => ({ error: { code: '42702', message: 'column reference "category" is ambiguous' } })
    await click('Опублікувати')
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /ingest-moderation-batch.sql/)
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /column reference "category" is ambiguous/)
  } finally { rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})
test('source editor accepts an arbitrary Ukrainian city, saves moderation-only configuration and can disable a source', async () => {
  const root = createRoot(container); calls.length = 0
  await act(async () => root.render(<AdminIngest mode="sources" />))
  try {
    const values = ['Місцеві події', 'https://example.test/nizhyn', 'Ніжин', 'utm_source=poruch']
    const inputs = [...container.querySelectorAll<HTMLInputElement>('form input:not([type="checkbox"])')]
    await act(async () => inputs.forEach((input, index) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, values[index]); input.dispatchEvent(new Event('input', { bubbles: true })) }))
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const payload = calls.find(call => call.name === 'insert')!.args
    assert.equal(payload.city, 'Ніжин'); assert.equal(payload.auto_publish, false); assert.equal(payload.partner_params, 'utm_source=poruch')
    await click('Вимкнути')
    assert.deepEqual(calls.find(call => call.name === 'update')?.args, { enabled: false })
  } finally { await act(async () => root.unmount()) }
})
test('external event cards link to source with partner params, have source attribution and no join/chat actions', async () => {
  const root = createRoot(container)
  const event = asExternalEvent(external)!
  await act(async () => root.render(<ExternalEventCard event={event} />))
  try {
    assert.match(container.textContent!, /Джерело: Квитки/)
    assert.match(container.textContent!, /Купити квиток/)
    assert.equal(container.querySelectorAll('button').length, 0)
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a')) {
      assert.equal(new URL(link.href).searchParams.get('utm_source'), 'poruch')
      assert.equal(new URL(link.href).searchParams.get('seat'), '1')
      assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener/)
    }
    assert.equal(externalUrl('javascript:alert(1)'), null)
    assert.equal(externalUrl('https://user:password@example.test'), null)
    assert.equal(distanceFrom(event, 51, 31), null)
    assert.ok(distanceFrom({ ...event, location_lat: 51, location_lng: 31 }, 51, 31)! < 0.001)
  } finally { await act(async () => root.unmount()) }
})
test('external feed A→B→A ignores obsolete responses; failed external queries do not expose stale city data', async () => {
  const requests: { args: any; resolve: (value: any) => void }[] = []
  rpcResponse = (_name, args) => new Promise(resolve => requests.push({ args, resolve }))
  function Probe({ city }: { city: string }) { const feed = useIngestedFeed(city, 'all', '', 10); return <p>{feed.error ? 'error' : feed.rows.map(row => row.title).join(',')}</p> }
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Probe city="A" />))
    await act(async () => root.render(<Probe city="B" />))
    await act(async () => root.render(<Probe city="A" />))
    await act(async () => requests[2].resolve({ data: [{ ...external, title: 'Current A' }], error: null }))
    await act(async () => { requests[0].resolve({ data: [{ ...external, title: 'Old A' }], error: null }); requests[1].resolve({ error: { message: 'old B' } }) })
    assert.equal(container.textContent, 'Current A')
    await act(async () => root.render(<Probe city="C" />))
    assert.equal(container.textContent, '')
    await act(async () => requests[3].resolve({ error: { message: 'offline' } }))
    assert.equal(container.textContent, 'error')
  } finally { rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})

test('source images require explicit consent; failed posters fall back to the existing category illustration', async () => {
  const root = createRoot(container)
  const poster = 'https://example.test/poster.jpg'
  try {
    for (const flag of [undefined, false]) {
      const event = asExternalEvent({ ...external, cover_url: poster, use_source_images: flag })!
      assert.equal(event.cover_photo_url, null)
      await act(async () => root.render(<ExternalEventCard event={event} />))
      assert.equal(container.querySelector('img'), null)
      assert.ok(container.querySelector('svg'))
    }
    const event = asExternalEvent({ ...external, cover_url: poster, use_source_images: true })!
    await act(async () => root.render(<ExternalEventCard event={event} />))
    assert.equal(container.querySelector('img')?.src, poster)
    await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')))
    assert.equal(container.querySelector('img'), null)
    assert.ok(container.querySelector('svg'))
    assert.equal(sourceImageUrl('javascript:alert(1)', true), null)
    assert.equal(missingImagesColumn({ code: 'PGRST204', message: 'use_source_images' }), true)
    assert.equal(missingImagesColumn({ code: '500', message: 'use_source_images' }), false)
  } finally { await act(async () => root.unmount()) }
})

test('moderation thumbnails use the same source consent and failed-image fallback as the feed', async () => {
  const root = createRoot(container), previousPending = pending
  pending = [{ ...pending[0], source_id: sources[0].id, category: 'theatre', cover_url: 'https://example.test/poster.jpg' }] as any
  try {
    await act(async () => root.render(<AdminIngest key="disabled" mode="moderation" />))
    assert.equal(container.querySelector('article img'), null)
    ;(sources[0] as any).use_source_images = true
    await act(async () => root.render(<AdminIngest key="enabled" mode="moderation" />))
    assert.equal(container.querySelector<HTMLImageElement>('article img')?.src, 'https://example.test/poster.jpg')
    await act(async () => container.querySelector('article img')!.dispatchEvent(new Event('error')))
    assert.equal(container.querySelector('article img'), null)
    assert.ok(container.querySelector('article svg'))
  } finally { delete (sources[0] as any).use_source_images; pending = previousPending; await act(async () => root.unmount()) }
})

test('before the SQL, default-off source saves retry without the column; enabling images reports the required migration', async () => {
  const root = createRoot(container); legacySchema = true; calls.length = 0
  await act(async () => root.render(<AdminIngest mode="sources" />))
  async function fill() {
    const values = ['Новий театр', 'https://example.test/new', 'Ніжин', '']
    await act(async () => [...container.querySelectorAll<HTMLInputElement>('form input:not([type="checkbox"])')].forEach((input, index) => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, values[index]); input.dispatchEvent(new Event('input', { bubbles: true }))
    }))
  }
  async function submit() { await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
  try {
    await fill(); await submit()
    const writes = calls.filter(call => call.name === 'insert')
    assert.equal(writes.length, 2)
    assert.equal(writes[0].args.use_source_images, false)
    assert.equal(Object.hasOwn(writes[1].args, 'use_source_images'), false)
    assert.equal(container.querySelector('[role="alert"]'), null)
    calls.length = 0
    await fill()
    const label = [...container.querySelectorAll('form label')].find(item => item.textContent?.includes('Показувати афіші джерела'))!
    await act(async () => label.querySelector<HTMLInputElement>('input')!.click())
    await submit()
    assert.equal(calls.filter(call => call.name === 'insert').length, 1)
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /event-sources-images.sql/)
  } finally { legacySchema = false; await act(async () => root.unmount()) }
})

test('moderation renders old titles normalized, hides technical statuses, and formats time without seconds', async () => {
  const root = createRoot(container), original = pending
  try {
    for (const [status, label] of [['EventScheduled', null], ['EventCancelled', 'Скасовано'], ['EventPostponed', 'Перенесено'], ['EventRescheduled', 'Нова дата']]) {
      pending = [{ ...original[0], title: ' Не  п `яна ', starts_at: '2026-11-16T18:00:39Z', event_status: status }] as any
      await act(async () => root.render(<AdminIngest key={status} mode="moderation" />))
      const card = container.querySelector('article')!
      assert.match(card.textContent!, /Не п’яна/)
      assert.match(card.textContent!, /16\.11\.2026, 20:00/)
      assert.match(card.textContent!, /без координат/)
      assert.doesNotMatch(card.textContent!, /EventScheduled|EventCancelled|EventPostponed|EventRescheduled|20:00:39/)
      if (label) assert.ok(card.textContent!.includes(label))
    }
  } finally { pending = original; await act(async () => root.unmount()) }
})

test('category drafts preview immediately and bulk publication sends only changed categories with displayed versions', async () => {
  const root = createRoot(container), original = pending; calls.length = 0
  pending = [{ ...original[0], category: 'music' }, { ...original[0], id: 'event-two', title: 'Кіно', category: 'cinema', fingerprint: 'version-two' }] as any
  await act(async () => root.render(<AdminIngest mode="moderation" />))
  try {
    const select = container.querySelector<HTMLSelectElement>('article select')!
    assert.equal(select.value, 'music')
    await act(async () => { select.value = 'theatre'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    assert.equal(select.value, 'theatre')
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    await click('Опублікувати (2)')
    assert.deepEqual(calls.find(call => call.name === 'poruch_moderation_batch')?.args, {
      p_ids: ['event-one', 'event-two'], p_status: 'approved', p_versions: { 'event-one': 'version-one', 'event-two': 'version-two' }, p_categories: { 'event-one': 'theatre' },
    })
    const current = container.querySelector<HTMLSelectElement>('article select')!
    await act(async () => { current.value = 'food'; current.dispatchEvent(new Event('change', { bubbles: true })) })
    rpcResponse = async () => ({ error: { code: 'PGRST202', message: 'p_categories RPC not found' } })
    await click('Опублікувати')
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /ingest-moderation-batch.sql/)
  } finally { pending = original; rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})

test('map mode fetches external events beyond the feed first page and all RPC batches', async () => {
  const root = createRoot(container), pages: number[] = []
  rpcResponse = async (_name, args) => {
    pages.push(args.p_offset)
    return { data: Array.from({ length: 101 }, (_, index) => ({ ...external, id: String(index), title: `Event ${index}` })).slice(args.p_offset, args.p_offset + args.p_limit), error: null }
  }
  function MapProbe() { const feed = useIngestedFeed('Київ', 'all', '', Infinity); return <p>{feed.rows.length}:{feed.rows.at(-1)?.title}</p> }
  try {
    await act(async () => root.render(<MapProbe />))
    assert.equal(container.textContent, '101:Event 100')
    assert.deepEqual(pages, [0, 100])
  } finally { rpcResponse = async () => ({ data: { processed: 1, skipped: 0, done: true }, error: null }); await act(async () => root.unmount()) }
})
