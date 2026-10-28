import { useId, useRef, useState } from 'react'
import { useHref } from 'react-router-dom'
import { Icon } from '@/components/icons'

export default function EventShare({ eventId, title, isPublic }: { eventId: string; title: string; isPublic: boolean }) {
  const href = useHref(`/event/${encodeURIComponent(eventId)}`)
  // Build from the event ID, not location.href: never share auth tokens or query parameters.
  const url = new URL(href, window.location.origin).toString()
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function copyLink() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      setMessage('Посилання скопійовано')
    } catch {
      inputRef.current?.focus()
      inputRef.current?.select()
      setMessage('Скопіюйте виділене посилання вручну.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function shareLink() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await navigator.share({ title, url })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setMessage('Не вдалося відкрити меню. Скористайтеся кнопкою «Копіювати посилання».')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); setMessage('') }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-bold text-brand-accent transition hover:bg-brand-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
        <Icon name="share" className="h-4 w-4" />Поділитися
      </button>
      {open && <div id={panelId} className="mt-3 rounded-2xl border border-brand-border bg-brand-bg p-4">
        <label className="block text-xs font-bold text-brand-ink-soft">Посилання на подію
          <input ref={inputRef} readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-11 w-full min-w-0 rounded-xl border border-brand-border bg-white px-3 text-sm font-normal text-brand-ink outline-none focus:border-brand-accent" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => { void copyLink() }} className="min-h-11 rounded-xl bg-brand-accent px-4 text-sm font-bold text-white hover:bg-brand-accent-hover disabled:opacity-50">Копіювати посилання</button>
          {typeof navigator.share === 'function' && <button type="button" disabled={busy} onClick={() => { void shareLink() }} className="min-h-11 rounded-xl border border-brand-border bg-white px-4 text-sm font-bold text-brand-ink-soft disabled:opacity-50">Надіслати через…</button>}
        </div>
        <p className="mt-3 text-xs leading-5 text-brand-ink-muted">{isPublic ? 'Надішліть посилання друзям. Після входу або реєстрації вони відкриють цю подію.' : 'Подія за запрошенням. Посилання працює лише для тих, хто вже має доступ; воно не надає запрошення.'}</p>
        <p role="status" className="mt-2 text-xs font-semibold text-brand-accent">{message}</p>
      </div>}
    </div>
  )
}
