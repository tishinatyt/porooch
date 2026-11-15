import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { removeEventVideo, type VideoFields } from '@/lib/eventVideo'
import { videoText as t } from '@/lib/videoInviteText'
import VideoInvitePlayer from './VideoInvitePlayer'

type Row = VideoFields & { id: string; title: string; report_count: number; reasons: string[] | null }
export default function AdminVideos() {
  const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [target, setTarget] = useState<Row | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    void Promise.resolve(supabase.rpc('poruch_video_admin_list')).then(({ data, error }) => { if (cancelled) return; if (error) setError(t.failed); else { setRows(Array.isArray(data) ? data : []); setError('') } }).catch(() => { if (!cancelled) setError(t.failed) })
    return () => { cancelled = true }
  }, [revision])
  async function remove() {
    if (!target || busy || reason.trim().length < 3) { setError(t.reason); return }
    setBusy(true); setError('')
    try { await removeEventVideo(target.id, target, reason.trim()); setTarget(null); setReason(''); setRevision(v => v + 1) } catch { setError(t.failed) } finally { setBusy(false) }
  }
  return <section className="mt-6 space-y-3 rounded-2xl border p-4" aria-label={t.adminTitle}><h2 className="text-lg font-bold">{t.adminTitle}</h2>{!rows.length && !error && <p>{t.adminEmpty}</p>}{rows.map(row => <article key={row.id} className="rounded-xl border p-3"><h3 className="font-bold">{row.title}</h3><p>{t.reports}: {row.report_count}</p>{row.reasons?.map((r, i) => <p key={i} className="break-words text-sm">{r}</p>)}<VideoInvitePlayer fields={row} /><button type="button" className="min-h-11 px-3 text-red-700" onClick={() => { setTarget(row); setReason('') }}>{t.remove}</button></article>)}{target && <div role="dialog" aria-modal="true" aria-label={t.confirmRemove}><p>{t.confirmRemove}</p><label>{t.adminReason}<textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="block min-h-20 w-full border p-2" /></label><button type="button" disabled={busy} className="min-h-11 px-3" onClick={() => setTarget(null)}>{t.cancel}</button><button type="button" disabled={busy || reason.trim().length < 3} className="min-h-11 px-3 text-red-700" onClick={() => void remove()}>{t.remove}</button></div>}{error && <p role="alert">{error}</p>}</section>
}
