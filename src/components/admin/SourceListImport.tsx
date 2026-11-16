import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseSourceImport } from '@/lib/sourceImport'
import { ingestText as t } from '@/lib/ingestText'
import { eventCategoryLabel } from '@/components/home/eventLabels'

export default function SourceListImport({ urls, onSaved }: { urls: string[]; onSaved: () => void }) {
  const [text, setText] = useState(''), [rows, setRows] = useState<ReturnType<typeof parseSourceImport> | null>(null)
  const [images, setImages] = useState(false), [enabled, setEnabled] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const button = 'min-h-11 rounded-xl border px-3 text-sm font-bold disabled:opacity-40'
  function preview() { setError(''); setNotice(''); try { setRows(parseSourceImport(text, urls)) } catch { setRows(null); setError(t.importInvalid) } }
  async function save() {
    if (!rows || busy) return
    setBusy(true); setError('')
    try {
      const result = await supabase.rpc('poruch_import_sources', { p_rows: rows.map(({ skip: _skip, ...row }) => row), p_use_images: images, p_enabled: enabled })
      if (result.error) throw result.error
      setNotice(`${t.importCreated}: ${result.data?.created ?? 0}; ${t.importSkipped}: ${result.data?.skipped ?? 0}`); setRows(null); setText(''); onSaved()
    } catch { setError(t.scalingMigration) } finally { setBusy(false) }
  }
  return <details className="rounded-2xl border bg-white p-4"><summary className="min-h-11 cursor-pointer font-bold">{t.importList}</summary>
    <label className="mt-2 block text-sm">JSON<textarea aria-label={t.importJson} value={text} onChange={e => { setText(e.target.value); setRows(null) }} className="block min-h-36 w-full rounded-xl border p-2 font-mono text-xs" /></label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={images} onChange={e => setImages(e.target.checked)} />{t.sourceImages}</label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{t.enabled}</label>
    <p className="mb-2 text-xs">{t.importAutoOff}</p><button type="button" className={button} disabled={busy} onClick={preview}>{t.importPreview}</button>
    {rows && <><div className="my-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{[t.city, t.importSection, 'URL', t.eventCategory, t.result].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td className="p-2">{row.city}</td><td className="p-2">{row.section}</td><td className="max-w-72 break-all p-2">{row.url}</td><td className="p-2">{eventCategoryLabel(row.default_category)}</td><td className="p-2">{row.skip ? t.importSkipped : t.importNew}</td></tr>)}</tbody></table></div><button type="button" className={button} disabled={busy || !rows.some(row => !row.skip)} onClick={() => void save()}>{t.importConfirm}</button></>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
  </details>
}
