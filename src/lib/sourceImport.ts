import { EVENT_CATEGORY_LABELS } from '../components/home/eventLabels'

export interface SourceImportRow { city: string; section: string; url: string; default_category: string; valid_events?: number }
export function sourceUrlKey(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw Error('invalid_source_url')
  url.hash = ''; url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|gad_|gclid$|fbclid$|gbraid$|wbraid$)/i.test(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  return url.href.replace(/\/(?=\?|$)/, '')
}
export function parseSourceImport(text: string, existingUrls: string[] = []) {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data) || !data.length || data.length > 1000) throw Error('invalid_source_list')
  const existing = new Set(existingUrls.flatMap(url => { try { return [sourceUrlKey(url)] } catch { return [] } }))
  const rows: (SourceImportRow & { skip: boolean })[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') throw Error('invalid_source_row')
    const row = item as SourceImportRow
    if (typeof row.city !== 'string' || !row.city.trim() || row.city.length > 120 || typeof row.section !== 'string' || !row.section.trim() || row.section.length > 200 || typeof row.default_category !== 'string' || !Object.hasOwn(EVENT_CATEGORY_LABELS, row.default_category) || typeof row.url !== 'string' || row.url.length > 2000) throw Error('invalid_source_row')
    const key = sourceUrlKey(row.url), skip = existing.has(key)
    rows.push({ city: row.city.trim(), section: row.section.trim(), url: key, default_category: row.default_category, valid_events: row.valid_events, skip })
    existing.add(key)
  }
  return rows
}
