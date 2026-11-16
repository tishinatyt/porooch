import { ingestStatusLabels, ingestText } from './ingestText'

const formatter = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function formatIngestedDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`
}
export function ingestedStatusLabel(value?: string | null) {
  return ingestStatusLabels[(value ?? '').split(/[/#]/).pop() ?? ''] ?? null
}

const cardFormatter = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function formatIngestedCardDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? cardFormatter.format(new Date(value)) : '—'
}
export function formatIngestedPrice(price: number | null, currency?: string | null) {
  if (price == null || !Number.isFinite(price) || price < 0) return ''
  const label = currency?.toUpperCase() === 'UAH' ? 'грн' : currency?.toUpperCase() ?? ''
  return `${ingestText.from} ${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(price)} ${label}`.trim()
}
