import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { runModerationBatches, moderationErrorMessage } from '../src/lib/moderationBatch.ts'

test('moderation SQL declarations cannot shadow table columns and migration matches manual SQL', () => {
  const sql = fs.readFileSync('docs/sql/ingest-moderation-batch.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('supabase/migrations/20261117120000_ingest_moderation_batch.sql', 'utf8'))
  const columns = new Set(['category','status','city','title','id','source_id','fingerprint','updated_at','collected_at','starts_at','place','address'])
  for (const block of sql.matchAll(/declare\s+([\s\S]*?)\bbegin\b/gi)) {
    for (const declaration of block[1].split(';').filter(value => value.trim())) {
      const name = declaration.trim().split(/\s+/)[0]
      assert.equal(columns.has(name), false, 'variable shadows column: ' + name)
      assert.match(name, /^v_/)
    }
  }
  assert.match(sql, /category=coalesce\(v_category,e.category\)/)
  assert.match(sql, /where e.id=v_item.id/)
  assert.doesNotMatch(sql, /v_item\.v_category/)
  for (const path of ['docs/sql/ingested-event-category.sql', 'supabase/migrations/20261116110000_ingested_event_category.sql']) {
    const legacy = fs.readFileSync(path, 'utf8')
    assert.match(legacy, /ingest_moderate\(p_ids::uuid\[\],p_status::text,p_versions::jsonb\)/)
    assert.doesNotMatch(legacy, /create function /i)
  }
})

test('real database messages survive direct and wrapped moderation errors', () => {
  const error = { code: '42702', message: 'column reference "category" is ambiguous' }
  assert.equal(moderationErrorMessage(error), error.message)
  assert.equal(moderationErrorMessage({ message: 'moderation_failed', cause: error }), error.message)
})

test('filtered moderation keeps city/source scope, cursor and snapshot across all pages, summing partial success', async () => {
  const calls: any[] = [], progress: any[] = []
  const result = await runModerationBatches(async args => {
    calls.push(args)
    return { error: null, data: calls.length === 1
      ? { processed: 97, skipped: 3, done: false, cursor: 'row-100', snapshot: '2026-11-17T10:00:00Z' }
      : { processed: 20, skipped: 2, done: true } }
  }, { p_status: 'approved', p_city: 'Київ', p_sources: ['source-a'] }, result => progress.push(result))
  assert.deepEqual(result, { processed: 117, skipped: 5 })
  assert.equal(calls[1].p_city, 'Київ')
  assert.deepEqual(calls[1].p_sources, ['source-a'])
  assert.equal(calls[1].p_after, 'row-100')
  assert.equal(calls[1].p_snapshot, '2026-11-17T10:00:00Z')
  assert.equal(calls[1].p_ids, undefined)
  assert.deepEqual(progress[0], { processed: 97, skipped: 3 })
})

test('batch rejection preserves completed counts on later RPC failure and never loops on a stale cursor', async () => {
  let calls = 0
  await assert.rejects(runModerationBatches(async () => ++calls === 1
    ? { error: null, data: { processed: 99, skipped: 1, done: false, cursor: 'a', snapshot: 'snapshot' } }
    : { error: { code: 'PGRST202' }, data: null }, { p_status: 'rejected' }), (error: any) => {
    assert.deepEqual(error.partial, { processed: 99, skipped: 1 }); return true
  })
  await assert.rejects(runModerationBatches(async () => ({ error: null, data: { processed: 0, skipped: 100, done: false, cursor: 'a', snapshot: 's' } }), {}), /cursor/)
})

test('SQL authorizes admins, skips conflicts, locks against ingestion, validates approval and uses bounded keyset scanning', () => {
  const sql = fs.readFileSync('docs/sql/ingest-moderation-batch.sql', 'utf8')
  for (const pattern of [/is_admin\(\)/, /pg_advisory_xact_lock\(1760916000\)/, /fingerprint is distinct from/, /updated_at>v_snapshot/, /v_skipped:=v_skipped\+1/, /limit 100 for update/, /e.id>p_after/, /e.city=p_city/, /e.source_id=any\(p_sources\)/, /moderation_reason\(to_jsonb\(v_item\),now\(\)\)/, /char_length\(btrim\(coalesce\(p_item/, /d.dedup_hash=v_item.dedup_hash/, /security invoker/]) assert.match(sql, pattern)
  assert.doesNotMatch(sql, /tow_leads|svoya_|offset /)
})
