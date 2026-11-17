import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { runModerationBatches } from '../src/lib/moderationBatch.ts'

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
  for (const pattern of [/is_admin\(\)/, /pg_advisory_xact_lock\(1760916000\)/, /fingerprint is distinct from/, /updated_at>snapshot/, /skipped:=skipped\+1; continue/, /limit 100 for update/, /e.id>p_after/, /e.city=p_city/, /e.source_id=any\(p_sources\)/, /item.starts_at<=now\(\)/, /char_length\(btrim\(item.title\)\)<3/, /d.dedup_hash=item.dedup_hash/, /security invoker/]) assert.match(sql, pattern)
  assert.doesNotMatch(sql, /tow_leads|svoya_|offset /)
})
