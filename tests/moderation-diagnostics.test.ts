import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseSchemaEvents, kyivDate } from '../scripts/ingest/normalize.mjs'
import { runModerationBatches } from '../src/lib/moderationBatch.ts'
import { formatModerationDiagnostics } from '../src/lib/moderationDiagnostics.ts'

const source = { city: 'Київ', default_category: 'music', url: 'https://example.test/concerts/' }
const event = { '@type': 'MusicEvent', name: 'Вечірній концерт', startDate: '2026-11-17T20:00', location: { name: 'Палац', address: { addressLocality: 'Київ' } } }
const parse = (value: any, section = 'concerts') => parseSchemaEvents(`<script type="application/ld+json">${JSON.stringify(value)}</script>`, { ...source, url: `https://example.test/${section}/` })[0]
test('same event in two sections has one canonical hash, with no category restriction', () => {
  const a = parse({ ...event, '@id': 'https://example.test/show' })
  const b = parse({ ...event, '@id': 'https://example.test/show' }, 'all')
  assert.equal(a.dedup_hash,b.dedup_hash)
  assert.equal(a.category,'music')
})
test('alternative venue and string location normalize to a publishable place', () => {
  assert.equal(parse({ ...event, location: undefined, venue: { name: 'Палац' } }).place,'Палац')
  assert.equal(parse({ ...event, location: 'Палац' }).place,'Палац')
})
test('tonight in Kyiv remains in the future relative to this afternoon, using timestamps', () => {
  const evening = kyivDate('2026-11-17T20:00')
  assert.equal(evening,'2026-11-17T18:00:00.000Z')
  assert.ok(Date.parse(evening!) > Date.parse('2026-11-17T15:00:00+02:00'))
})
test('reason counts aggregate across batches, examples are capped at twenty and UI explains them', async () => {
  let n=0
  const result = await runModerationBatches(async () => ({ error:null,data:{ processed:1,skipped:15,reasons:{venue:15},examples:Array.from({length:15},(_,i)=>({id:String(i),title:'Концерт',reason:'venue'})),cursor:'a',snapshot:'s',done:++n===2 } }),{})
  assert.equal(result.reasons?.venue,30)
  assert.equal(result.examples?.length,20)
  assert.match(formatModerationDiagnostics(result),/Не вказано місце: 30/)
})
test('SQL chooses a published canonical only, records duplicate rejection and supplies read-only diagnostics', () => {
  const sql=fs.readFileSync('docs/sql/ingest-moderation-batch.sql','utf8')
  assert.match(sql,/d.id<>v_item.id and d.status='approved'/)
  assert.match(sql,/status='rejected',raw_data=e.raw_data\|\|jsonb_build_object\('moderation_reason','duplicate'/)
  assert.match(sql,/jsonb_array_length\(v_examples\)<20/)
  assert.match(sql,/\{raw_data,location,address,streetAddress\}/)
  const query=fs.readFileSync('docs/sql/ingest-skip-diagnostics.sql','utf8').replace(/--[^\n]*/g,'')
  assert.doesNotMatch(query,/\b(insert|update|delete|alter|create|drop|call)\b/i)
  assert.match(query,/params\(city\) as \(values/)
})
