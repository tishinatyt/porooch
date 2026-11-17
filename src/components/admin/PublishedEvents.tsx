import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ingestText as t } from '@/lib/ingestText'
import { normalizeEventTitle } from '@/lib/eventTitle'
import { formatIngestedDate } from '@/lib/ingestedPresentation'
import { sourceImageUrl } from '@/lib/ingestedEvents'
import { runModerationBatches, moderationErrorMessage, type ModerationResult } from '@/lib/moderationBatch'
import { EVENT_CATEGORY_LABELS, eventCategoryLabel } from '@/components/home/eventLabels'
import EventMedia from '@/components/EventMedia'

type Source = { id:string; name:string; city:string; use_source_images?:boolean }
type Row = { id:string;title:string;starts_at:string;place:string;address:string;city:string;source_id:string;category:string;cover_url:string|null;updated_at:string }
type Action = 'unpublish'|'hide'|'category'
const field='min-h-11 min-w-0 rounded-xl border bg-white px-3 text-sm'
const button='min-h-11 rounded-xl border bg-white px-3 text-sm font-bold disabled:opacity-40'
export default function PublishedEvents() {
  const [rows,setRows]=useState<Row[]>([]),[sources,setSources]=useState<Source[]>([]),[total,setTotal]=useState(0)
  const [city,setCity]=useState(''),[source,setSource]=useState(''),[category,setCategory]=useState(''),[search,setSearch]=useState('')
  const [page,setPage]=useState(0),[size,setSize]=useState(25),[revision,setRevision]=useState(0)
  const [selected,setSelected]=useState<Set<string>>(new Set()),[targetCategory,setTargetCategory]=useState('other'),[drafts,setDrafts]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{
    let cancelled=false;setLoading(true);setRows([]);setSelected(new Set());setDrafts({})
    void(async()=>{
      try {
        const all:Source[]=[]
        for(let offset=0;;offset+=100){
          const result=await supabase.from('event_sources').select('id,name,city,use_source_images').order('id').range(offset,offset+99)
          if(result.error)throw result.error
          const batch=result.data??[];all.push(...batch)
          if(cancelled)return
          if(batch.length<100)break
        }
        let query=supabase.from('ingested_events').select('id,title,starts_at,place,address,city,source_id,category,cover_url,updated_at',{count:'exact'}).eq('status','approved')
        if(city)query=query.eq('city',city)
        if(source)query=query.eq('source_id',source)
        if(category)query=query.eq('category',category)
        if(search.trim())query=query.ilike('title','%'+search.trim().slice(0,200).replace(/[\\%_]/g,'\\$&')+'%')
        const result=await query.order('starts_at').order('id').range(page*size,page*size+size-1)
        if(result.error)throw result.error
        if(cancelled)return
        setSources(all);setTotal(result.count??0)
        if(page>0 && page*size>=(result.count??0)){setPage(Math.max(0,Math.ceil((result.count??0)/size)-1));return}
        setRows((result.data??[]) as Row[])
      } catch(error){if(!cancelled)setError(t.publishedMigration+'\n'+moderationErrorMessage(error))}
      finally{if(!cancelled)setLoading(false)}
    })()
    return()=>{cancelled=true}
  },[city,source,category,search,page,size,revision])
  function summary(result:ModerationResult){setNotice(`${t.processed}: ${result.processed}. ${t.skipped}: ${result.skipped}`)}
  const label=(action:Action)=>action==='unpublish'?t.unpublish:action==='hide'?t.hideForever:t.changeCategory
  async function act(action:Action,ids?:string[],rowCategory?:string){
    if(busy || loading || (ids && !ids.length))return
    if((!ids || action==='hide') && !window.confirm(`${t.confirmPublished}: ${label(action)} (${ids?.length??total})?`))return
    setBusy(true);setError('');setNotice('')
    try {
      const args={p_action:action,p_category:action==='category'?(rowCategory??targetCategory):null,p_city:city,p_source:source||null,p_filter_category:category,p_search:search.trim().slice(0,200)}
      if(ids){
        const result=await supabase.rpc('poruch_published_batch',{...args,p_ids:ids,p_versions:Object.fromEntries(rows.filter(row=>ids.includes(row.id)).map(row=>[row.id,row.updated_at]))})
        if(result.error)throw result.error
        summary(result.data)
      } else await runModerationBatches(params=>supabase.rpc('poruch_published_batch',params),args,summary)
    } catch(error){setError(t.publishedMigration+'\n'+moderationErrorMessage(error))}
    finally{setBusy(false);setRevision(value=>value+1)}
  }
  const sourceById=new Map(sources.map(item=>[item.id,item]))
  const pages=Math.max(1,Math.ceil(total/size))
  const reset=(setter:(value:string)=>void,value:string)=>{setter(value);setPage(0)}
  return <section aria-label={t.publishedEvents} className="space-y-4">
    <h2 className="text-xl font-extrabold">{t.publishedEvents}</h2>
    <div className="flex flex-wrap gap-2">
      <select aria-label={t.city} disabled={busy} className={field} value={city} onChange={e=>reset(setCity,e.target.value)}><option value="">{t.allCities}</option>{[...new Set(sources.map(item=>item.city))].sort().map(name=><option key={name}>{name}</option>)}</select>
      <select aria-label={t.source} disabled={busy} className={field} value={source} onChange={e=>reset(setSource,e.target.value)}><option value="">{t.allSources}</option>{sources.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label={t.eventCategory} disabled={busy} className={field} value={category} onChange={e=>reset(setCategory,e.target.value)}><option value="">{t.allCategories}</option>{Object.entries(EVENT_CATEGORY_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <input aria-label={t.searchTitle} placeholder={t.searchTitle} disabled={busy} maxLength={200} className={field} value={search} onChange={e=>reset(setSearch,e.target.value)}/>
      <button className={button} disabled={busy} onClick={()=>{setError('');setRevision(value=>value+1)}}>{t.refresh}</button>
    </div>
    <p>{t.publishedEvents}: {total} · {page+1}/{pages}</p>
    {loading && <p role="status">{t.loading}</p>}{error && <p role="alert" className="whitespace-pre-wrap text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={busy||loading} checked={rows.length>0&&selected.size===rows.length} onChange={e=>setSelected(new Set(e.target.checked?rows.map(row=>row.id):[]))}/>{t.selectAll}</label>
      <select aria-label={t.changeCategory} disabled={busy} className={field} value={targetCategory} onChange={e=>setTargetCategory(e.target.value)}>{Object.entries(EVENT_CATEGORY_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      {(['unpublish','hide','category'] as const).map(action=><span key={action} className="flex flex-wrap gap-2"><button className={button} disabled={busy||loading||!selected.size} onClick={()=>void act(action,[...selected])}>{label(action)} ({selected.size})</button><button className={button} disabled={busy||loading||!total} onClick={()=>void act(action)}>{label(action)} {t.filteredAction} ({total})</button></span>)}
    </div>
    {!loading&&!rows.length&&!error&&<p>{t.emptyPublished}</p>}
    {rows.map(row=><article key={row.id} className="space-y-2 rounded-2xl border bg-white p-4">
      <div className="float-right h-16 w-16 overflow-hidden rounded-xl"><EventMedia category={drafts[row.id]??row.category} coverUrl={sourceImageUrl(row.cover_url,sourceById.get(row.source_id)?.use_source_images)} compactFallback className="h-full w-full"/></div>
      <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" disabled={busy} checked={selected.has(row.id)} onChange={e=>setSelected(old=>{const next=new Set(old);if(e.target.checked)next.add(row.id);else next.delete(row.id);return next})}/>{normalizeEventTitle(row.title)}</label>
      <p>{formatIngestedDate(row.starts_at)} · {row.city}</p><p>{row.place} · {row.address}</p><p>{t.source}: {sourceById.get(row.source_id)?.name} · {eventCategoryLabel(row.category)}</p>
      <label>{t.eventCategory} <select aria-label={`${t.eventCategory}: ${row.title}`} className={field} disabled={busy} value={drafts[row.id]??row.category} onChange={e=>setDrafts(old=>({...old,[row.id]:e.target.value}))}>{Object.entries(EVENT_CATEGORY_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <div className="flex flex-wrap gap-2">{(['unpublish','hide','category'] as const).map(action=><button key={action} className={button} disabled={busy} onClick={()=>void act(action,[row.id],drafts[row.id]??row.category)}>{label(action)}</button>)}</div>
    </article>)}
    <div className="flex flex-wrap items-center gap-3"><button className={button} disabled={busy||loading||page===0} onClick={()=>setPage(value=>value-1)}>{t.previous}</button><span>{page+1}/{pages}</span><button className={button} disabled={busy||loading||page+1>=pages} onClick={()=>setPage(value=>value+1)}>{t.next}</button><select aria-label={t.pageSize} className={field} disabled={busy} value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0)}}>{[25,50,100].map(value=><option key={value}>{value}</option>)}</select></div>
  </section>
}
