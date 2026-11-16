import EventMedia from '@/components/EventMedia'
import { sourceImageUrl, missingImagesColumn } from '@/lib/ingestedEvents'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { UKRAINIAN_CITIES } from '@/lib/cities'
import { ingestText as t } from '@/lib/ingestText'
import { EVENT_CATEGORY_LABELS } from '@/components/home/eventLabels'

type Source = { use_source_images?: boolean; id: string; name: string; type: string; url: string; city: string; default_category: string; enabled: boolean; partner_params: string; last_run_at: string | null; last_result: string | null; last_found: number; last_changed: number; run_count: number }
type Pending = { source_id?: string; category?: string; cover_url?: string | null; id: string; title: string; starts_at: string; place: string; address: string; city: string; fingerprint: string; event_status: string; source_url: string; source: { name: string } | null }
const field = 'min-h-11 min-w-0 rounded-xl border border-brand-border bg-white px-3 text-sm'
const button = 'min-h-11 rounded-xl border border-brand-border bg-white px-3 text-sm font-bold disabled:opacity-40'
const blank = { id: '', name: '', type: 'schema_org', url: '', city: '', default_category: 'other', partner_params: '', enabled: false, use_source_images: false }
function date(value: string | null) { return value ? new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—' }

export default function AdminWorkspace({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<'platform' | 'moderation' | 'sources'>('platform')
  return <><nav aria-label={t.moderation} className="mb-5 flex flex-wrap gap-2">{(['platform', 'moderation', 'sources'] as const).map(tab => <button type="button" className={button} aria-pressed={section === tab} key={tab} onClick={() => setSection(tab)}>{t[tab]}</button>)}</nav>{section === 'platform' ? children : <AdminIngest key={section} mode={section} />}</>
}

export function AdminIngest({ mode }: { mode: 'moderation' | 'sources' }) {
  const [sources, setSources] = useState<Source[]>([]), [rows, setRows] = useState<Pending[]>([])
  const [city, setCity] = useState(''), [source, setSource] = useState(''), [page, setPage] = useState(0), [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set()), [revision, setRevision] = useState(0)
  const [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true); setRows([]); setSelected(new Set()); setError('')
    void (async () => {
      try {
        const all: Source[] = []
        for (let offset = 0; ; offset += 100) {
          const result = await supabase.from('event_sources').select('*').order('id').range(offset, offset + 99)
          if (result.error) throw result.error
          const batch = result.data ?? []; all.push(...batch)
          if (cancelled) return
          if (batch.length < 100) break
        }
        setSources(all)
        if (mode === 'moderation') {
          let query = supabase.from('ingested_events').select('source_id,category,cover_url,id,title,starts_at,place,address,city,fingerprint,event_status,source_url,source:event_sources(name)', { count: 'exact' }).eq('status', 'pending')
          if (city) query = query.eq('city', city)
          if (source) query = query.eq('source_id', source)
          const result = await query.order('starts_at').order('id').range(page * 25, page * 25 + 24)
          if (result.error) throw result.error
          if (cancelled) return
          setRows((result.data ?? []) as unknown as Pending[]); setTotal(result.count ?? 0)
        }
      } catch { if (!cancelled) setError(t.failed) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [mode, city, source, page, revision])
  async function moderate(ids: string[], status: 'approved' | 'rejected') {
    if (busy || !ids.length) return
    setBusy(true); setError(''); setNotice('')
    try {
      const versions = Object.fromEntries(rows.filter(row => ids.includes(row.id)).map(row => [row.id, row.fingerprint]))
      const result = await supabase.rpc('poruch_ingest_moderate', { p_ids: ids, p_status: status, p_versions: versions })
      if (result.error) throw result.error
      setNotice(t.saved); setSelected(new Set()); setRevision(v => v + 1)
    } catch { setError(t.changed) } finally { setBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    let url: URL
    try { url = new URL(form.url); if (url.protocol !== 'https:' || url.username || url.password || !form.name.trim() || !form.city.trim()) throw Error() } catch { setError(t.invalid); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const { id, ...values } = form
      const payload = { ...values, name: values.name.trim(), city: values.city.trim(), url: url.href, auto_publish: false }
      let result = id ? await supabase.from('event_sources').update(payload).eq('id', id) : await supabase.from('event_sources').insert(payload)
      if (missingImagesColumn(result.error)) {
        if (payload.use_source_images) { setError(t.imagesMigration); return }
        const { use_source_images: _ignored, ...legacy } = payload
        result = id ? await supabase.from('event_sources').update(legacy).eq('id', id) : await supabase.from('event_sources').insert(legacy)
      }
      if (result.error) throw result.error
      setForm(blank); setNotice(t.saved); setRevision(v => v + 1)
    } catch { setError(t.failed) } finally { setBusy(false) }
  }
  async function toggle(item: Source) {
    if (busy) return
    setBusy(true); setError('')
    try { const result = await supabase.from('event_sources').update({ enabled: !item.enabled }).eq('id', item.id); if (result.error) throw result.error; setRevision(v => v + 1) } catch { setError(t.failed) } finally { setBusy(false) }
  }
  const sourceById = new Map(sources.map(item => [item.id, item]))
  const cities = [...new Set(sources.map(item => item.city))].sort()
  const displayedSources = sources.filter(item => !city || item.city === city).slice(page * 25, page * 25 + 25)
  const pages = Math.max(1, Math.ceil((mode === 'moderation' ? total : sources.filter(item => !city || item.city === city).length) / 25))
  return <section aria-label={t[mode]} className="space-y-4">
    <h2 className="text-xl font-extrabold">{t[mode]}</h2>
    <div className="flex flex-wrap gap-2"><select className={field} aria-label={t.city} value={city} onChange={e => { setCity(e.target.value); setPage(0) }}><option value="">{t.allCities}</option>{cities.map(name => <option key={name}>{name}</option>)}</select>{mode === 'moderation' && <select className={field} aria-label={t.source} value={source} onChange={e => { setSource(e.target.value); setPage(0) }}><option value="">{t.allSources}</option>{sources.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}<button type="button" className={button} onClick={() => setRevision(v => v + 1)}>{t.refresh}</button></div>
    {loading && <p role="status">{t.loading}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    {mode === 'moderation' ? <>
      <div className="flex flex-wrap items-center gap-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={e => setSelected(new Set(e.target.checked ? rows.map(row => row.id) : []))} />{t.selectAll}</label>{(['approved', 'rejected'] as const).map(status => <button type="button" className={button} key={status} disabled={busy || !selected.size} onClick={() => void moderate([...selected], status)}>{status === 'approved' ? t.publish : t.reject} ({selected.size})</button>)}</div>
      {!loading && !error && !rows.length && <p>{t.empty}</p>}
      {rows.map(row => <article key={row.id} className="rounded-2xl border bg-white p-4"><div className="float-right ml-3 h-16 w-16 overflow-hidden rounded-xl"><EventMedia category={row.category ?? sourceById.get(row.source_id ?? '')?.default_category ?? 'other'} coverUrl={sourceImageUrl(row.cover_url, sourceById.get(row.source_id ?? '')?.use_source_images)} compactFallback className="h-full w-full" /></div><label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={selected.has(row.id)} onChange={e => setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next })} />{row.title}</label><p>{date(row.starts_at)} · {row.city}</p><p>{row.place} · {row.address}</p><p>{t.source}: {row.source?.name} · {row.event_status}</p><a className="inline-flex min-h-11 items-center break-all text-brand-accent underline" href={row.source_url} target="_blank" rel="noopener noreferrer">{t.details}</a><div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void moderate([row.id], 'approved')}>{t.publish}</button><button className={button} disabled={busy} onClick={() => void moderate([row.id], 'rejected')}>{t.reject}</button></div></article>)}
    </> : <>
      <form onSubmit={event => void save(event)} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
        {(['name', 'url', 'city', 'partner_params'] as const).map(key => <label key={key} className="grid gap-1 text-sm font-bold">{key === 'partner_params' ? t.partner : t[key]}<input className={field} required={key !== 'partner_params'} maxLength={key === 'url' ? 2000 : key === 'partner_params' ? 500 : key === 'city' ? 120 : 200} list={key === 'city' ? 'ingest-cities' : undefined} type={key === 'url' ? 'url' : 'text'} value={form[key]} onChange={e => setForm(old => ({ ...old, [key]: e.target.value }))} /></label>)}
        <datalist id="ingest-cities">{UKRAINIAN_CITIES.map(item => <option key={item.id} value={item.name} />)}</datalist>
        <label className="grid gap-1 text-sm font-bold">{t.type}<select className={field} value={form.type} onChange={e => setForm(old => ({ ...old, type: e.target.value }))}>{['schema_org', 'feed', 'telegram', 'manual'].map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">{t.category}<select className={field} value={form.default_category} onChange={e => setForm(old => ({ ...old, default_category: e.target.value }))}>{Object.entries(EVENT_CATEGORY_LABELS).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={e => setForm(old => ({ ...old, enabled: e.target.checked }))} />{t.enabled}</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.use_source_images} onChange={e => setForm(old => ({ ...old, use_source_images: e.target.checked }))} />{t.sourceImages}</label><p className="text-xs">{t.moderationRequired}</p>
        <button className={button} disabled={busy}>{form.id ? t.save : t.add}</button><button type="button" className={button} onClick={() => setForm(blank)}>{t.cancel}</button>
      </form>
      {!loading && !error && !sources.length && <p>{t.noSources}</p>}
      {displayedSources.map(item => <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4"><h3 className="font-bold">{item.name} · {item.city}</h3><p className="break-all text-sm">{item.type} · {item.url}</p><p className="text-sm">{t.lastRun}: {date(item.last_run_at)} · {t.result}: {item.last_result ?? '—'} · {t.counters}: {item.last_found}/{item.last_changed} · {item.run_count}</p><button className={button} disabled={busy} onClick={() => void toggle(item)}>{item.enabled ? t.disable : t.enable}</button> <button className={button} onClick={() => setForm({ id: item.id, name: item.name, type: item.type, url: item.url, city: item.city, default_category: item.default_category, partner_params: item.partner_params, enabled: item.enabled, use_source_images: item.use_source_images === true })}>{t.edit}</button></article>)}
    </>}
    <div className="flex items-center gap-3"><button className={button} disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>{t.previous}</button><span>{page + 1}/{pages}</span><button className={button} disabled={page + 1 >= pages || loading} onClick={() => setPage(v => v + 1)}>{t.next}</button></div>
  </section>
}
