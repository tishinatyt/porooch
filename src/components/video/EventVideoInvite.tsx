import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { removeEventVideo, saveEventVideo, type VideoFields } from '@/lib/eventVideo'
import { videoText as t } from '@/lib/videoInviteText'
import type { PreparedVideo } from '@/lib/videoInviteProcessing'
import VideoInviteEditor from './VideoInviteEditor'
import VideoInvitePlayer from './VideoInvitePlayer'

export default function EventVideoInvite({ eventId, initial, owner, onSaved }: { eventId: string; initial: VideoFields; owner: boolean; onSaved?: (fields: VideoFields) => void }) {
  const [fields, setFields] = useState(initial), [editing, setEditing] = useState(false), [prepared, setPrepared] = useState<PreparedVideo | null>(null)
  const [busy, setBusy] = useState(false), [processing, setProcessing] = useState(false), [progress, setProgress] = useState(0)
  const [error, setError] = useState(''), [reason, setReason] = useState(''), [reporting, setReporting] = useState(false), [notice, setNotice] = useState('')
  async function save() {
    if (!prepared || busy) return
    setBusy(true); setError(''); setProgress(0)
    try { const next = await saveEventVideo(eventId, prepared, fields, setProgress); setFields(next); setPrepared(null); setEditing(false); onSaved?.(next) }
    catch (e) { setError(e instanceof Error ? e.message : t.failed) } finally { setBusy(false) }
  }
  async function remove() {
    if (busy || !window.confirm(t.confirmRemove)) return
    setBusy(true); setError('')
    try { await removeEventVideo(eventId, fields); const next = { video_path: null, video_poster_path: null, video_duration_ms: null, video_updated_at: null }; setFields(next); setEditing(false); onSaved?.(next) } catch { setError(t.failed) } finally { setBusy(false) }
  }
  async function report() {
    if (reason.trim().length < 3 || reason.trim().length > 500) { setError(t.reason); return }
    setBusy(true); setError('')
    try { const { error } = await supabase.rpc('poruch_report_event_video', { p_event_id: eventId, p_path: fields.video_path, p_reason: reason.trim() }); if (error) throw error; setReporting(false); setNotice(t.reportSent) } catch { setError(t.failed) } finally { setBusy(false) }
  }
  if (!owner && !fields.video_path) return null
  return <section aria-label={t.title} className="space-y-3">
    {fields.video_path && <VideoInvitePlayer key={fields.video_path} fields={fields} />}
    {owner && <div className="flex gap-2"><button type="button" disabled={busy} className="min-h-11 rounded-xl border px-3 font-bold" onClick={() => setEditing(true)}>{fields.video_path ? t.replace : t.add}</button>{fields.video_path && <button type="button" disabled={busy} className="min-h-11 rounded-xl border px-3 text-red-700" onClick={() => void remove()}>{t.remove}</button>}</div>}
    {owner && editing && <><VideoInviteEditor onChange={setPrepared} onBusy={setProcessing} disabled={busy} /><button type="button" disabled={!prepared || processing || busy} className="min-h-11 rounded-xl bg-brand-accent px-3 font-bold text-white" onClick={() => void save()}>{t.save}</button></>}
    {!owner && fields.video_path && <button type="button" disabled={busy} className="min-h-11 px-2 text-sm underline" onClick={() => setReporting(!reporting)}>{t.report}</button>}
    {reporting && <div><label className="block text-sm">{t.reportReason}<textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="block min-h-20 w-full rounded-xl border p-2" /></label><button type="button" disabled={busy} className="min-h-11 px-3 font-bold" onClick={() => void report()}>{t.report}</button></div>}
    {busy && <p role="status">{t.uploading} {progress}%</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
