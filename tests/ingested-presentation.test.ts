import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeEventTitle } from '../src/lib/eventTitle.ts'
import { formatIngestedDate, formatIngestedCardDate, formatIngestedPrice, ingestedStatusLabel } from '../src/lib/ingestedPresentation.ts'
import { groupMapVenues } from '../src/lib/mapVenues.ts'
import { parseSchemaEvents, dedupHash } from '../scripts/ingest/normalize.mjs'
import { asExternalEvent } from '../src/lib/ingestedEvents.ts'

test('all apostrophe variants, surrounding whitespace, NBSP and double spaces normalize identically and idempotently', () => {
  for (const apostrophe of ['`', '´', '‘', 'ʼ', "'", '’']) for (const spacing of ['', ' ', '  ', '\u00a0']) {
    const title = `  Не  п${spacing}${apostrophe}${spacing}яна  `
    assert.equal(normalizeEventTitle(title), 'Не п’яна')
    assert.equal(normalizeEventTitle(normalizeEventTitle(title)), 'Не п’яна')
  }
  assert.equal(normalizeEventTitle('Не п `яна'), 'Не п’яна')
  assert.equal(normalizeEventTitle('  М\u200Bісто\t\nмузики '), 'М істо музики')
  assert.equal(normalizeEventTitle("Шоу ‘Комедія’ у театрі"), "Шоу ‘Комедія’ у театрі")
  assert.equal(normalizeEventTitle('«Прем’єра»'), '«Прем’єра»')
  assert.equal(normalizeEventTitle(null), '')
})
test('collector and existing stored event display share normalization; dedup is stable across apostrophe variants', () => {
  const [collected] = parseSchemaEvents(`<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: ' Не п `яна ', startDate: '2099-01-01T18:00Z', location: { name: 'Зала' } })}</script>`, { url: 'https://example.test/event', city: 'Київ' })
  assert.equal(collected.title, 'Не п’яна')
  assert.equal(collected.raw_data.name, 'Не п’яна')
  const displayed = asExternalEvent({ ...collected, title: 'Не п ʼ яна', id: 'old', source_name: 'Джерело', partner_params: '' })!
  assert.equal(displayed.title, 'Не п’яна')
  assert.equal(dedupHash(collected), dedupHash({ ...collected, title: 'Не пʼяна' }))
  assert.equal(dedupHash(collected), dedupHash({ ...collected, title: 'Не п `яна' }))
})
test('event status labels hide scheduled and unknown codes and support Schema.org URIs', () => {
  assert.equal(ingestedStatusLabel('EventScheduled'), null)
  assert.equal(ingestedStatusLabel('UnknownEventStatus'), null)
  assert.equal(ingestedStatusLabel('EventCancelled'), 'Скасовано')
  assert.equal(ingestedStatusLabel('EventPostponed'), 'Перенесено')
  assert.equal(ingestedStatusLabel('https://schema.org/EventRescheduled'), 'Нова дата')
})
test('Kyiv dates are numeric with minutes, never seconds, regardless of machine timezone', () => {
  assert.equal(formatIngestedDate('2026-11-16T18:00:39Z'), '16.11.2026, 20:00')
  assert.equal(formatIngestedDate('2026-07-16T18:05:59Z'), '16.07.2026, 21:05')
  assert.equal(formatIngestedDate(null), '—')
  assert.equal(formatIngestedDate('invalid'), '—')
})
test('category SQL copies match and extend the reviewed-version API without replacing the original overload', () => {
  const sql = fs.readFileSync('supabase/migrations/20261116110000_ingested_event_category.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('docs/sql/ingested-event-category.sql', 'utf8'))
  assert.match(sql, /n := poruch_private.ingest_moderate\(p_ids,p_status,p_versions\)/)
  assert.match(sql, /category=p_categories->>e.id::text/)
  assert.doesNotMatch(sql, /tow_leads|svoya_/)
})

test('card date matches native cards and prices use Ukrainian hryvnia labels', () => {
  assert.equal(formatIngestedCardDate('2026-11-18T18:00:39Z'), 'ср, 18 лист., 20:00')
  assert.equal(formatIngestedPrice(590, 'UAH'), 'від 590 грн')
  assert.equal(formatIngestedPrice(590, 'uah'), 'від 590 грн')
  assert.equal(formatIngestedPrice(0, 'UAH'), 'від 0 грн')
  assert.equal(formatIngestedPrice(null, 'UAH'), '')
  assert.equal(formatIngestedPrice(10, 'EUR'), 'від 10 EUR')
})

test('map groups co-located events into one venue, keeps native markers distinct and omits only missing coordinates', () => {
  const source = { id: 'one', title: 'Подія', starts_at: '2099-01-01T18:00Z', source_url: 'https://example.test', source_name: 'Джерело', place: 'Зала', city: 'Київ', category: 'music', latitude: 50.45, longitude: 30.52 }
  const one = asExternalEvent(source as any)!, two = { ...one, id: 'two' }, absent = { ...one, id: 'absent', location_lat: null }
  const native = { ...one, id: 'native', external: undefined, location_lat: 50.451 }
  const groups = groupMapVenues([one, two, absent, native])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].events.length, 2)
  assert.equal(groups[0].kind, 'external')
  assert.equal(groups[1].kind, 'native')
  assert.equal(groupMapVenues([one, { ...two, location_lat: 50.4501, location_lng: 30.5201 }]).length, 1, 'same venue remains grouped when provider coordinates differ slightly')
  assert.equal(groupMapVenues([one, { ...native, location_lat: one.location_lat }])[0].kind, 'mixed')
})
