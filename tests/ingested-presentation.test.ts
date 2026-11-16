import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeEventTitle } from '../src/lib/eventTitle.ts'
import { formatIngestedDate, ingestedStatusLabel } from '../src/lib/ingestedPresentation.ts'
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
