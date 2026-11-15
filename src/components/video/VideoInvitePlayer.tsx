import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { videoUrl, type VideoFields } from '@/lib/eventVideo'
import { videoText as t } from '@/lib/videoInviteText'

export default function VideoInvitePlayer({ fields, compact = false }: { fields: VideoFields; compact?: boolean }) {
  const [poster, setPoster] = useState(''), [src, setSrc] = useState(''), [open, setOpen] = useState(false), [error, setError] = useState('')
  const host = useRef<HTMLDivElement>(null), generation = useRef(0)
  useEffect(() => {
    const request = ++generation.current; setPoster(''); setSrc(''); setOpen(false); setError('')
    const load = () => { if (fields.video_poster_path) void videoUrl(fields.video_poster_path).then(url => { if (request === generation.current) setPoster(url) }).catch(() => {}) }
    let observer: IntersectionObserver | undefined
    if (typeof IntersectionObserver !== 'undefined' && host.current) { observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { load(); observer?.disconnect() } }); observer.observe(host.current) } else load()
    return () => { generation.current++; observer?.disconnect() }
  }, [fields.video_path, fields.video_poster_path, fields.video_updated_at])
  useEffect(() => { if (!open) return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSrc('') } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [open])
  async function play() {
    if (!fields.video_path) return
    const request = generation.current; setError(''); setOpen(true)
    try { const url = await videoUrl(fields.video_path); if (request === generation.current) setSrc(url) }
    catch { if (request === generation.current) setError(t.access) }
  }
  return <div ref={host} className={compact ? 'relative h-full w-full' : 'relative rounded-xl border border-brand-border p-3'}>
    <button type="button" aria-label={t.play} className={compact ? 'relative grid h-full min-h-11 w-full min-w-11 place-items-center overflow-hidden rounded-xl bg-brand-accent-soft' : 'relative grid min-h-32 w-full place-items-center overflow-hidden rounded-xl bg-black text-white'} onClick={() => void play()}>
      {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}<span aria-hidden="true" className="relative grid h-9 w-9 place-items-center rounded-full bg-black/65 text-lg text-white">▶</span>
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setSrc('') } }}><section role="dialog" aria-modal="true" aria-label={t.title} className="w-full max-w-2xl rounded-xl bg-white p-3 text-brand-ink"><button type="button" autoFocus className="mb-2 min-h-11 px-3 font-bold" onClick={() => { setOpen(false); setSrc('') }}>{t.close}</button>{src && <video key={src} src={src} poster={poster || undefined} controls playsInline preload="none" className="max-h-[70vh] w-full bg-black" onError={() => setError(t.access)} />}{error && <p role="alert">{error}</p>}{error && <button type="button" className="min-h-11 px-3" onClick={() => void play()}>{t.retry}</button>}</section></div>, document.body)}
  </div>
}
