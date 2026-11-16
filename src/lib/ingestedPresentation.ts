import { ingestStatusLabels } from './ingestText'

const formatter = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function formatIngestedDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`
}
export function ingestedStatusLabel(value?: string | null) {
  return ingestStatusLabels[(value ?? '').split(/[/#]/).pop() ?? ''] ?? null
}
