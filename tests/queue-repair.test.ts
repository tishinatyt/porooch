import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseSchemaEvents, dedupHash } from '../scripts/ingest/normalize.mjs'
import { enrichVenue } from '../scripts/ingest/enrich.mjs'
import { runBackfill } from '../scripts/ingest/backfill.mjs'

const source={city:'Київ',url:'https://kyiv.karabas.com/concerts/',default_category:'music'}
const html=(data: unknown)=>`<script type="application/ld+json">${JSON.stringify(data)}</script>`
test('real Karabas sections keep the full Event with venue even when the short same-ID Event comes first',()=>{
  for(let i=1;i<=4;i++){
    const fixture=JSON.parse(fs.readFileSync(`tests/fixtures/karabas/section-${i}.json`,'utf8'))
    assert.equal(fixture[0].location,undefined)
    assert.ok(fixture[1].location.name)
    const rows=parseSchemaEvents(html(fixture),source)
    assert.equal(rows.length,1)
    assert.equal(rows[0].place,fixture[1].location.name)
    assert.ok(rows[0].address)
    assert.equal(parseSchemaEvents(html([...fixture].reverse()),source)[0].place,rows[0].place)
  }
})
test('location string, unnamed Place address, superEvent and arrays all yield real venue information',()=>{
  const base={'@type':'Event',name:'Show',startDate:'2099-01-01T20:00'}
  for(const extra of [{location:'Hall'},{location:{address:'Street 1'}},{superEvent:{location:{name:'Hall'}}},{location:[{}, {name:'Hall'}]}]){
    const [row]=parseSchemaEvents(html({...base,...extra}),source)
    assert.ok(row.place || row.address)
  }
  const [empty]=parseSchemaEvents(html({...base,location:{address:{addressLocality:'Київ'}}}),source)
  assert.equal(empty.place,'');assert.equal(empty.address,'')
  assert.equal(dedupHash(empty),dedupHash({...empty,place:'Hall',latitude:50,cover_url:'https://a.test/img'}))
})
test('venue fallback obeys robots, fetches only linked detail URL, matches the same event/date and never overwrites facts',async()=>{
  const data={'@type':'Event',name:'Show',startDate:'2099-01-01T20:00',location:{name:'Hall'}}
  const [row]=parseSchemaEvents(html({...data,location:undefined,url:'https://kyiv.karabas.com/show/'}),source)
  const urls:string[]=[]
  const found=await enrichVenue(row,{get:async(url:string)=>{urls.push(url);return {allowed:true,url,text:html(data)}}})
  assert.equal(found.place,'Hall');assert.deepEqual(urls,[row.source_url])
  assert.equal((await enrichVenue(row,{get:async()=>({allowed:false})})).place,'')
  assert.equal((await enrichVenue(row,{get:async()=>({allowed:true,url:row.source_url,text:html({...data,name:'Other'})})})).place,'')
})
test('queue SQL is repeatable, batches exactly 100 independently of the visible page, expires pending by start and merges rich facts',()=>{
  const sql=fs.readFileSync('docs/sql/ingest-queue-repair.sql','utf8')
  assert.equal(sql,fs.readFileSync('supabase/migrations/20261117140000_ingest_queue_repair.sql','utf8'))
  assert.match(sql,/e.status='pending' and e.starts_at<=now\(\)/)
  assert.match(sql,/create or replace function public.poruch_moderation_filter_batch\(p_status text,p_city text/)
  assert.match(sql,/'done',not exists/)
  assert.match(sql,/e.id>v_cursor/)
  assert.match(sql,/limit 100/)
  assert.match(sql,/v_other.observations\|\|e.observations/)
  assert.match(sql,/coalesce\(e.latitude,v_other.latitude\)/)
  assert.doesNotMatch(sql,/tow_leads|svoya_/)
})
test('backfill rereads missing venues, safely repairs facts, geocodes and merges all duplicate batches',async()=>{
  const [row]=parseSchemaEvents(html({'@type':'Event',name:'Show',startDate:'2099-01-01T20:00',url:'/show'}),source)
  const calls:string[]=[];let merged=0
  const db={rpc:async(name:string,args:any)=>{calls.push(name);return {error:null,data:name==='poruch_ingest_repair'?{...args.p_fields,id:'id'}:name==='poruch_ingest_merge_duplicates'?{done:++merged===2,cursor:'next'}:null}},from:()=>{
    const q:any={select:()=>q,in:()=>q,or:()=>q,order:()=>q,limit:()=>q,eq:()=>q,update:()=>q,then:(resolve:any)=>Promise.resolve({data:[{...row,id:'id'}],error:null}).then(resolve)};return q
  }}
  const result=await runBackfill(db,{crawler:{get:async(url:string)=>({allowed:true,url,text:html({'@type':'Event',name:'Show',startDate:'2099-01-01T20:00',location:'Hall'})})},geocode:async(row:any)=>{assert.equal(row.place,'Hall');return {latitude:50,longitude:30}}})
  assert.equal(result.venues,1);assert.equal(merged,2)
  assert.equal(calls[0],'poruch_ingest_expire')
})
