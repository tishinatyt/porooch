import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { asExternalEvent } from '../src/lib/ingestedEvents.ts'
import { groupEventSessions } from '../src/lib/eventSessions.ts'
import { groupMapVenues } from '../src/lib/mapVenues.ts'
import { runIngest } from '../scripts/ingest/run.mjs'
import { registerAdapter } from '../scripts/ingest/adapters.mjs'

const base={title:'Не п’яна',starts_at:'2099-01-01T18:00:00Z',place:'Театр',address:'Street 1',city:'Київ',category:'theatre',latitude:50.45,longitude:30.52,price_from:100,currency:'UAH',cover_url:null,source_url:'https://tickets.test/day1',source_name:'Tickets',partner_params:'partner=poruch',description:''}
const row=(id:string,extra={})=>asExternalEvent({...base,id,...extra})!
test('same title/venue/city sessions become one nearest-date card while retaining per-session ticket links',()=>{
  const events=[row('later',{starts_at:'2099-01-03T18:00:00Z',source_url:'https://tickets.test/day3'}),row('first'),row('second',{title:' Не  п `яна ',starts_at:'2099-01-02T18:00:00Z',source_url:'https://tickets.test/day2'})]
  const before=JSON.stringify(events)
  const [group]=groupEventSessions(events,Date.parse('2098-12-31T12:00:00Z'))
  assert.equal(group.event_datetime,base.starts_at)
  assert.equal(group.external!.sessions!.length,3)
  assert.deepEqual(group.external!.sessions!.map(event=>event.external!.url),['https://tickets.test/day1?partner=poruch','https://tickets.test/day2?partner=poruch','https://tickets.test/day3?partner=poruch'])
  assert.equal(JSON.stringify(events),before)
  const next=groupEventSessions([group],Date.parse('2099-01-01T18:00:00Z'))[0]
  assert.equal(next.event_datetime,'2099-01-02T18:00:00Z')
  assert.equal(next.id,group.id)
  assert.equal(groupEventSessions([group],Date.parse('2099-01-04T00:00:00Z')).length,0)
})
test('city and venue distinguish groups; native personal events remain independent',()=>{
  const a=row('a'),native={...a,id:'native1',external:undefined,event_type:'personal' as const}
  const result=groupEventSessions([a,row('b',{city:'Львів'}),row('c',{place:'Other hall'}),native,{...native,id:'native2'}],Date.now())
  assert.equal(result.length,5)
  assert.equal(result.filter(event=>!event.external).length,2)
  assert.equal(groupMapVenues(groupEventSessions([a,row('d',{starts_at:'2099-01-02T18:00:00Z'})])).flatMap(venue=>venue.events).length,1)
})
test('permanent-hide SQL protects repeat collection by alias, date identity and trigger, with no anonymous access',()=>{
  const sql=fs.readFileSync('docs/sql/published-events.sql','utf8')
  assert.equal(sql,fs.readFileSync('supabase/migrations/20261117150000_published_events.sql','utf8'))
  assert.match(sql,/return 'hidden'; end if;/)
  assert.ok(sql.indexOf("return 'hidden'")<sql.indexOf('return poruch_private.ingest_item_visible'))
  assert.match(sql,/before insert or update on public.ingested_events/)
  assert.match(sql,/new.status:='rejected'/)
  assert.match(sql,/old.raw_data->>'moderation_reason'='hidden'/)
  assert.match(sql,/on conflict\(key\) do nothing/)
  assert.match(sql,/'source:'\|\|k.value/)
  assert.match(sql,/ingest_hidden_keys enable row level security/)
  assert.match(sql,/if not poruch_private.is_admin\(\)/)
  assert.match(sql,/order by e.id limit 100 for update/)
  assert.doesNotMatch(sql,/as \$\$|tow_leads|svoya_/)
})
test('repeat collection honors a permanent-hide result even after source facts change, without rewriting or enriching the rejected row',async()=>{
  const observations:any[]=[]
  let revision=0
  registerAdapter('hidden-fixture',async()=>[{external_id:'same-source-id',title:revision++?'Changed title':'Original title',starts_at:'2099-01-01T18:00:00Z',place:'Hall',city:'Київ',latitude:null,longitude:null,dedup_hash:'hash',fingerprint:'version-'+revision}])
  const db={
    from:(table:string)=>{assert.equal(table,'event_sources');const q:any={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[{id:'source',type:'hidden-fixture',auto_publish:true}],error:null})};return q},
    rpc:async(name:string,args:any)=>{
      if(name==='poruch_ingest_claim')return {data:'token',error:null}
      if(name==='poruch_ingest_batch'){observations.push(args.p_items[0]);return {data:[{external_id:'same-source-id',result:'hidden'}],error:null}}
      return {data:null,error:null}
    },
  }
  for(let i=0;i<2;i++){
    const result=await runIngest(db,{}, {geocode:async()=>{throw Error('hidden event must not be enriched')}})
    assert.equal(result.changed,0);assert.equal(result.failed,0)
  }
  assert.equal(observations.length,2)
  assert.notEqual(observations[0].title,observations[1].title)
  assert.ok(observations.every(event=>event.status===undefined))
})
