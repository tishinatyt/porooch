import { useEffect, useRef, useState } from 'react'
import { inspectVideo, processVideoInvite, VIDEO_TARGET_BYTES, type PreparedVideo } from '@/lib/videoInviteProcessing'
import { videoText as t, videoErrorMessage } from '@/lib/videoInviteText'

export default function VideoInviteEditor({ onChange, onBusy, disabled = false }: { onChange: (video: PreparedVideo | null) => void; onBusy: (busy: boolean) => void; disabled?: boolean }) {
  const [file, setFile] = useState<File | null>(null), [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0), [posterTime, setPosterTime] = useState(0)
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [progress, setProgress] = useState<number | null>(null)
  const [ready, setReady] = useState<PreparedVideo | null>(null)
  const preview = useRef<HTMLVideoElement>(null), camera = useRef<HTMLInputElement>(null), picker = useRef<HTMLInputElement>(null)
  const job = useRef<AbortController | null>(null), selection = useRef(0)
  useEffect(() => { if (!file) { setUrl(''); return }; const local = URL.createObjectURL(file); setUrl(local); return () => URL.revokeObjectURL(local) }, [file])
  useEffect(() => () => { selection.current++; job.current?.abort() }, [])
  async function choose(next?: File) {
    if (!next || disabled || progress !== null) return
    const request = ++selection.current
    let accepted = false
    setError(''); onBusy(true); onChange(null); setReady(null)
    try { const meta = await inspectVideo(next); if (request !== selection.current) return; setFile(next); setDuration(meta.duration); setStart(0); setPosterTime(0); accepted = true }
    catch (e) { if (request === selection.current) { setFile(null); setError(videoErrorMessage(e, t.decode)) } }
    finally { if (request === selection.current && !accepted) onBusy(false) }
  }
  function frame(time: number) { setPosterTime(time); if (preview.current) { preview.current.pause(); preview.current.currentTime = time } }
  async function prepare() {
    if (!file || progress !== null) return
    preview.current?.pause()
    const controller = new AbortController(); job.current = controller
    let prepared = false
    setProgress(0); setError(''); onBusy(true)
    try {
      const result = await processVideoInvite(file, start, posterTime, setProgress, controller.signal)
      if (!controller.signal.aborted) { setReady(result); onChange(result); prepared = true }
    } catch (e) { if (!controller.signal.aborted) setError(videoErrorMessage(e, t.encode)) }
    finally { if (job.current === controller) { setProgress(null); onBusy(!prepared && !controller.signal.aborted) } }
  }
  const locked = disabled || progress !== null
  return <section className="space-y-3 rounded-xl border border-brand-border p-3" aria-label={t.title}>
    <h3 className="text-sm font-bold">{t.title}</h3><p className="text-xs text-brand-ink-muted">{t.hint}</p>
    <input ref={camera} type="file" accept="video/*" capture="environment" className="sr-only" aria-label={t.record} disabled={locked} onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} />
    <input ref={picker} type="file" accept="video/*" className="sr-only" aria-label={t.choose} disabled={locked} onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} />
    <div className="flex flex-wrap gap-2"><button type="button" disabled={locked} className="min-h-11 rounded-xl bg-brand-accent px-3 text-sm font-bold text-white" onClick={() => camera.current?.click()}>{t.record}</button><button type="button" disabled={locked} className="min-h-11 rounded-xl border px-3 text-sm" onClick={() => picker.current?.click()}>{t.choose}</button></div>
    {file && <>
      <video ref={preview} src={url} controls playsInline preload="metadata" className="max-h-56 w-full rounded-xl bg-black" />
      {duration > 10 && <label className="block text-xs font-bold">{t.trim}: {start.toFixed(1)} с<p className="font-normal">{t.trimHint}</p><input type="range" min={0} max={Math.max(0, duration - 10)} step={0.1} value={start} disabled={locked} className="min-h-11 w-full" onChange={e => { const next = Number(e.target.value); setStart(next); frame(next); setReady(null); onChange(null); onBusy(true) }} /></label>}
      <label className="block text-xs font-bold">{t.poster}: {(posterTime - start).toFixed(1)} с<input type="range" min={start} max={Math.max(start, Math.min(duration - 0.01, start + 10))} step={0.1} value={posterTime} disabled={locked} className="min-h-11 w-full" onChange={e => { frame(Number(e.target.value)); setReady(null); onChange(null); onBusy(true) }} /></label>
      <button type="button" disabled={locked} className="min-h-11 rounded-xl border px-3 text-sm font-bold" onClick={() => void prepare()}>{t.prepare}</button>
      <button type="button" disabled={locked} className="min-h-11 px-3 text-sm" onClick={() => { setFile(null); setReady(null); onChange(null); onBusy(false) }}>{t.cancel}</button>
    </>}
    {progress !== null && <div role="status">{t.preparing} {progress}%<progress className="w-full" max={100} value={progress} /><button type="button" className="min-h-11 px-3" onClick={() => { job.current?.abort(); setFile(null); onChange(null); onBusy(false) }}>{t.cancel}</button></div>}
    {ready && <p role="status" className="text-xs">{t.ready}{ready.blob.size > VIDEO_TARGET_BYTES && ` ${t.large}`}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
