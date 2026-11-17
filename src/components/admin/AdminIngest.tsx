import { formatModerationDiagnostics } from '@/lib/moderationDiagnostics'
import { runModerationBatches, moderationErrorMessage, type ModerationResult } from '@/lib/moderationBatch'
import SourceListImport from './SourceListImport'
import { normalizeEventTitle } from '@/lib/eventTitle'
import { formatIngestedDate as date } from '@/lib/ingestedPresentation'
import IngestedStatusBadge from './IngestedStatusBadge'
import EventMedia from '@/components/EventMedia'
import { sourceImageUrl, missingImagesColumn } from '@/lib/ingestedEvents'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { UKRAINIAN_CITIES } from '@/lib/cities'
import { ingestText as t } from '@/lib/ingestText'
import { EVENT_CATEGORY_LABELS } from '@/components/home/eventLabels'

type Source = { auto_publish?: boolean; use_source_images?: boolean; id: string; name: string; type: string; url: string; city: string; default_category: string; enabled: boolean; partner_params: string; last_run_at: string | null; last_result: string | null; last_found: number; last_changed: number; run_count: number }
type Pending = { latitude?: number | null; longitude?: number | null; source_id?: string; category?: string; cover_url?: string | null; id: string; title: string; starts_at: string; place: string; address: string; city: string; fingerprint: string; event_status: string; source_url: string; source: { name: string } | null }
const field = 'min-h-11 min-w-0 rounded-xl border border-brand-border bg-white px-3 text-sm'
const button = 'min-h-11 rounded-xl border border-brand-border bg-white px-3 text-sm font-bold disabled:opacity-40'
const blank = { id: '', name: '', type: 'schema_org', url: '', city: '', default_category: 'other', partner_params: '', enabled: false, use_source_images: false, auto_publish: false }

export default function AdminWorkspace({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<'platform' | 'moderation' | 'sources'>('platform')
  return <><nav aria-label={t.moderation} className="mb-5 flex flex-wrap gap-2">{(['platform', 'moderation', 'sources'] as const).map(tab => <button type="button" className={button} aria-pressed={section === tab} key={tab} onClick={() => setSection(tab)}>{t[tab]}</button>)}</nav>{section === 'platform' ? children : <AdminIngest key={section} mode={section} />}</>
}

export function AdminIngest({ mode }: { mode: 'moderation' | 'sources' }) {
  const [sources, setSources] = useState<Source[]>([]), [rows, setRows] = useState<Pending[]>([])
  const [city, setCity] = useState(''), [source, setSource] = useState(''), [page, setPage] = useState(0), [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set()), [revision, setRevision] = useState(0)
  const [form, setForm] = useState(blank), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    let cancelled = false
    setLoading(true); setRows([]); setSelected(new Set()); setCategories({})
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
          const expired = await supabase.rpc('poruch_moderation_expire')
          if (expired.error) throw expired.error
          let query = supabase.from('ingested_events').select('latitude,longitude,source_id,category,cover_url,id,title,starts_at,place,address,city,fingerprint,event_status,source_url,source:event_sources(name)', { count: 'exact' }).eq('status', 'pending')
          if (city) query = query.eq('city', city)
          if (source) query = query.eq('source_id', source)
          const result = await query.order('starts_at').order('id').range(page * pageSize, page * pageSize + pageSize - 1)
          if (result.error) throw result.error
          if (cancelled) return
          if (page > 0 && page * pageSize >= (result.count ?? 0)) { setPage(Math.max(0, Math.ceil((result.count ?? 0) / pageSize) - 1)); return }
          setRows(((result.data ?? []) as unknown as Pending[]).map(row => ({ ...row, title: normalizeEventTitle(row.title) }))); setTotal(result.count ?? 0)
        }
      } catch (error) { if (!cancelled) setError(t.failed + ' ' + t.queueMigration + '\n' + moderationErrorMessage(error)) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [mode, city, source, page, pageSize, revision])
  async function moderate(ids: string[], status: 'approved' | 'rejected') {
    if (busy || !ids.length) return
    setBusy(true); setError(''); setNotice('')
    try {
      const versions = Object.fromEntries(rows.filter(row => ids.includes(row.id)).map(row => [row.id, row.fingerprint]))
      const edits = Object.fromEntries(rows.filter(row => ids.includes(row.id) && categories[row.id] && categories[row.id] !== (row.category ?? sources.find(source => source.id === row.source_id)?.default_category ?? 'other')).map(row => [row.id, categories[row.id]]))
      const result = await supabase.rpc('poruch_moderation_batch', { p_ids: ids, p_status: status, p_versions: versions, ...(status === 'approved' && Object.keys(edits).length ? { p_categories: edits } : {}) })
      if (result.error) throw result.error
      setNotice(summary(status, result.data)); setSelected(new Set()); setRevision(v => v + 1)
    } catch (error) { setError(t.batchMigration + '\n' + moderationErrorMessage(error)); setRevision(v => v + 1) } finally { setBusy(false) }
  }
  function summary(status: 'approved' | 'rejected', result: ModerationResult) {
    return (status === 'approved' ? t.published : t.rejected) + ': ' + result.processed + '. ' + t.skipped + ': ' + result.skipped + ' (' + t.skipReason + ')' + formatModerationDiagnostics(result)
  }
  async function filtered(status: 'approved' | 'rejected', sourceIds?: string[]) {
    if (!sourceIds && !window.confirm(t.confirmFiltered + ': ' + total + '. ' + (status === 'approved' ? t.publish : t.reject) + '?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await runModerationBatches(args => supabase.rpc('poruch_moderation_filter_batch', args), {
        p_status: status, p_city: sourceIds ? '' : city, p_sources: sourceIds ?? (source ? [source] : null),
      }, result => setNotice(summary(status, result)))
    } catch (error) { setError(t.batchMigration + ' ' + t.queueMigration + '\n' + moderationErrorMessage(error)) }
    finally { setSelected(new Set()); setRevision(v => v + 1); setBusy(false) }
  }
  async function offerCollected(ids: string[]) {
    if (window.confirm(t.publishCollected)) await filtered('approved', ids)
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    let url: URL
    try { url = new URL(form.url); if (url.protocol !== 'https:' || url.username || url.password || !form.name.trim() || !form.city.trim()) throw Error() } catch { setError(t.invalid); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const { id, ...values } = form
      const payload = { ...values, name: values.name.trim(), city: values.city.trim(), url: url.href }
      const enablingAuto = values.auto_publish && (!id || !sources.find(item => item.id === id)?.auto_publish)
      let result = id ? await supabase.from('event_sources').update(payload).eq('id', id) : await supabase.from('event_sources').insert(payload)
      if (missingImagesColumn(result.error)) {
        if (payload.use_source_images) { setError(t.imagesMigration); return }
        const { use_source_images: _ignored, ...legacy } = payload
        result = id ? await supabase.from('event_sources').update(legacy).eq('id', id) : await supabase.from('event_sources').insert(legacy)
      }
      if (result.error) throw result.error
      setForm(blank); setNotice(t.saved); setRevision(v => v + 1); if (id && enablingAuto) await offerCollected([id])
    } catch { setError(t.failed) } finally { setBusy(false) }
  }
  async function toggle(item: Source) {
    if (busy) return
    setBusy(true); setError('')
    try { const result = await supabase.from('event_sources').update({ enabled: !item.enabled }).eq('id', item.id); if (result.error) throw result.error; setRevision(v => v + 1) } catch { setError(t.failed) } finally { setBusy(false) }
  }
  async function setAuto(ids: string[], enabled: boolean) {
    if (busy || !ids.length) return
    setBusy(true); setError('')
    try { const result = await supabase.rpc('poruch_sources_auto_publish', { p_ids: ids, p_enabled: enabled }); if (result.error) throw result.error; setRevision(v => v + 1); if (enabled) await offerCollected(ids) } catch { setError(t.scalingMigration) } finally { setBusy(false) }
  }
  const sourceById = new Map(sources.map(item => [item.id, item]))
  const cities = [...new Set(sources.map(item => item.city))].sort()
  const filteredSources = sources.filter(item => !city || item.city === city)
  const displayedSources = filteredSources.slice(page * 25, page * 25 + 25)
  const pages = Math.max(1, Math.ceil((mode === 'moderation' ? total : sources.filter(item => !city || item.city === city).length) / (mode === 'moderation' ? pageSize : 25)))
  return <section aria-label={t[mode]} className="space-y-4">
    <h2 className="text-xl font-extrabold">{t[mode]}</h2>
    <div className="flex flex-wrap gap-2"><select className={field} aria-label={t.city} disabled={busy} value={city} onChange={e => { setCity(e.target.value); setPage(0) }}><option value="">{t.allCities}</option>{cities.map(name => <option key={name}>{name}</option>)}</select>{mode === 'moderation' && <select className={field} aria-label={t.source} disabled={busy} value={source} onChange={e => { setSource(e.target.value); setPage(0) }}><option value="">{t.allSources}</option>{sources.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}<button type="button" className={button} onClick={() => setRevision(v => v + 1)}>{t.refresh}</button></div>
    {loading && <p role="status">{t.loading}</p>}{error && <p role="alert" className="whitespace-pre-wrap text-red-700">{error}</p>}{notice && <p role="status" className="whitespace-pre-wrap">{notice}</p>}
    {mode === 'moderation' ? <>
      <div className="flex flex-wrap items-center gap-2"><span>{t.queueTotal}: {total}</span><label>{t.pageSize} <select aria-label={t.pageSize} className={field} disabled={busy} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}>{[25,50,100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>{(['approved','rejected'] as const).map(status => <button key={status} className={button} disabled={busy || loading || !total} onClick={() => void filtered(status)}>{status === 'approved' ? t.publishFiltered : t.rejectFiltered} ({total})</button>)}</div>
      <div className="flex flex-wrap items-center gap-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={e => setSelected(new Set(e.target.checked ? rows.map(row => row.id) : []))} />{t.selectAll}</label>{(['approved', 'rejected'] as const).map(status => <button type="button" className={button} key={status} disabled={busy || !selected.size} onClick={() => void moderate([...selected], status)}>{status === 'approved' ? t.publish : t.reject} ({selected.size})</button>)}</div>
      {!loading && !error && !rows.length && <p>{t.empty}</p>}
      {rows.map(row => <article key={row.id} className="rounded-2xl border bg-white p-4"><div className="float-right ml-3 h-16 w-16 overflow-hidden rounded-xl"><EventMedia category={categories[row.id] ?? row.category ?? sourceById.get(row.source_id ?? '')?.default_category ?? 'other'} coverUrl={sourceImageUrl(row.cover_url, sourceById.get(row.source_id ?? '')?.use_source_images)} compactFallback className="h-full w-full" /></div><label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={selected.has(row.id)} onChange={e => setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next })} />{row.title}</label><p>{date(row.starts_at)} · {row.city}</p><p>{row.place} · {row.address}</p><p className="flex flex-wrap items-center gap-2">{t.source}: {row.source?.name}<IngestedStatusBadge status={row.event_status} />{(row.latitude == null || row.longitude == null) && <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900">{t.noCoordinates}</span>}</p><label className="my-2 flex flex-wrap items-center gap-2 text-sm font-bold">{t.eventCategory}<select aria-label={`${t.eventCategory}: ${row.title}`} className={field} disabled={busy} value={categories[row.id] ?? row.category ?? sourceById.get(row.source_id ?? '')?.default_category ?? 'other'} onChange={e => setCategories(old => ({ ...old, [row.id]: e.target.value }))}>{row.category && !EVENT_CATEGORY_LABELS[row.category] && <option value={row.category}>{row.category}</option>}{Object.entries(EVENT_CATEGORY_LABELS).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><p className="text-xs text-brand-ink-muted">{t.categoryHint}</p><a className="inline-flex min-h-11 items-center break-all text-brand-accent underline" href={row.source_url} target="_blank" rel="noopener noreferrer">{t.details}</a><div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void moderate([row.id], 'approved')}>{t.publish}</button><button className={button} disabled={busy} onClick={() => void moderate([row.id], 'rejected')}>{t.reject}</button></div></article>)}
    </> : <>
      <SourceListImport urls={sources.map(item => item.url)} onSaved={() => setRevision(v => v + 1)} />
      <div className="flex flex-wrap items-center gap-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={filteredSources.length > 0 && filteredSources.every(item => selected.has(item.id))} onChange={e => setSelected(new Set(e.target.checked ? filteredSources.map(item => item.id) : []))} />{t.importSelectAll}</label><button type="button" className={button} disabled={busy || !selected.size} onClick={() => void setAuto([...selected], true)}>{t.autoSelected} ({selected.size})</button></div>
      <form onSubmit={event => void save(event)} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
        {(['name', 'url', 'city', 'partner_params'] as const).map(key => <label key={key} className="grid gap-1 text-sm font-bold">{key === 'partner_params' ? t.partner : t[key]}<input className={field} required={key !== 'partner_params'} maxLength={key === 'url' ? 2000 : key === 'partner_params' ? 500 : key === 'city' ? 120 : 200} list={key === 'city' ? 'ingest-cities' : undefined} type={key === 'url' ? 'url' : 'text'} value={form[key]} onChange={e => setForm(old => ({ ...old, [key]: e.target.value }))} /></label>)}
        <datalist id="ingest-cities">{UKRAINIAN_CITIES.map(item => <option key={item.id} value={item.name} />)}</datalist>
        <label className="grid gap-1 text-sm font-bold">{t.type}<select className={field} value={form.type} onChange={e => setForm(old => ({ ...old, type: e.target.value }))}>{['schema_org', 'feed', 'telegram', 'manual'].map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">{t.category}<select className={field} value={form.default_category} onChange={e => setForm(old => ({ ...old, default_category: e.target.value }))}>{Object.entries(EVENT_CATEGORY_LABELS).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={e => setForm(old => ({ ...old, enabled: e.target.checked }))} />{t.enabled}</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.use_source_images} onChange={e => setForm(old => ({ ...old, use_source_images: e.target.checked }))} />{t.sourceImages}</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.auto_publish} onChange={e => setForm(old => ({ ...old, auto_publish: e.target.checked }))} />{t.autoPublish}</label><p className="text-xs">{t.moderationRequired}</p>
        <button className={button} disabled={busy}>{form.id ? t.save : t.add}</button><button type="button" className={button} onClick={() => setForm(blank)}>{t.cancel}</button>
      </form>
      {!loading && !error && !sources.length && <p>{t.noSources}</p>}
      {displayedSources.map(item => <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label={`${t.sourceSelect}: ${item.name}`} checked={selected.has(item.id)} onChange={e => setSelected(old => { const next = new Set(old); if(e.target.checked) next.add(item.id); else next.delete(item.id); return next })} />{t.sourceSelect}</label><h3 className="font-bold">{item.name} · {item.city}</h3><p className="break-all text-sm">{item.type} · {item.url}</p><p className="text-sm">{t.lastRun}: {date(item.last_run_at)} · {t.result}: {item.last_result ?? '—'} · {t.counters}: {item.last_found}/{item.last_changed} · {item.run_count}</p><button className={button} disabled={busy} onClick={() => void toggle(item)}>{item.enabled ? t.disable : t.enable}</button> <button className={button} onClick={() => setForm({ id: item.id, name: item.name, type: item.type, url: item.url, city: item.city, default_category: item.default_category, partner_params: item.partner_params, enabled: item.enabled, use_source_images: item.use_source_images === true, auto_publish: item.auto_publish === true })}>{t.edit}</button> <button className={button} disabled={busy} onClick={() => void setAuto([item.id], !item.auto_publish)}>{item.auto_publish ? t.autoOff : t.autoOn}</button></article>)}
    </>}
    <div className="flex items-center gap-3"><button className={button} disabled={page === 0 || loading || busy} onClick={() => setPage(v => v - 1)}>{t.previous}</button><span>{page + 1}/{pages}</span><button className={button} disabled={page + 1 >= pages || loading || busy} onClick={() => setPage(v => v + 1)}>{t.next}</button></div>
  </section>
}
