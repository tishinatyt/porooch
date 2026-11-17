import type { PublicEventData } from './types'
import { formatIngestedCardDate } from '@/lib/ingestedPresentation'
import { ingestText as t } from '@/lib/ingestText'
export default function EventSessionDates({ event }: { event: PublicEventData }) {
  return <ul aria-label={t.sessionDates} className="space-y-2">{(event.external?.sessions ?? [event]).map(session=><li key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2"><span>{formatIngestedCardDate(session.event_datetime)}</span><a href={session.external!.url} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-brand-accent px-3 text-xs font-bold !text-white">{t.ticket}</a></li>)}</ul>
}
