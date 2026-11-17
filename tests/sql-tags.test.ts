import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { checkSqlTags, sqlFiles } from '../scripts/check-sql-tags.mjs'

test('every SQL file has paired dollar tags and no damaged single-dollar delimiter',()=>{
  for(const file of sqlFiles()) assert.doesNotThrow(()=>checkSqlTags(fs.readFileSync(file,'utf8'),file),file)
  const pairs=checkSqlTags(fs.readFileSync('docs/sql/ingest-queue-repair.sql','utf8'))
  assert.ok(pairs.length>10)
  assert.ok(pairs.every(pair=>pair.tag==='$fn$'))
  assert.equal(fs.readFileSync('docs/sql/ingest-queue-repair.sql','utf8'),fs.readFileSync('supabase/migrations/20261117140000_ingest_queue_repair.sql','utf8'))
})
test('tag scanner rejects single dollars, missing closers and mismatched tags with line diagnostics',()=>{
  for(const sql of ['as $\nselect 1;\n$;','as $fn$ select 1;','as $fn$ select 1; $other$;']) assert.throws(()=>checkSqlTags(sql,'bad.sql'),/bad.sql:\d+:/)
})
test('tag scanner handles comments, quoted regex dollars, parameters and nested distinct tags',()=>{
  const sql='-- as $\n/* $bad$ /* nested */ */ select \'regex$\', $1; do $outer$ begin execute $inner$select \'$\';$inner$; end $outer$;'
  assert.deepEqual(checkSqlTags(sql).map(pair=>pair.tag),['$inner$','$outer$'])
})
