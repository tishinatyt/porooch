import EventMedia from '@/components/EventMedia'
import IngestedStatusBadge from '@/components/admin/IngestedStatusBadge'
import { ingestText as t } from '@/lib/ingestText'
import { formatIngestedCardDate, formatIngestedPrice } from '@/lib/ingestedPresentation'
import type { MapVenue } from '@/lib/mapVenues'
import EventSessionDates from './EventSessionDates'

export default function MapVenuePopup({ venue, onOpen }: { venue: MapVenue; onOpen: (id: string) => void }) {
  return <section aria-label={t.venueEvents} className="min-w-56 text-brand-ink">
    <h2 className="mb-2 text-sm font-extrabold">{venue.name || t.venueEvents} · {venue.events.length}</h2>
    <div className="max-h-80 space-y-3 overflow-y-auto overscroll-contain">
      {venue.events.map(event => <article key={event.id} className="border-t border-brand-border pt-2">
        <div className="flex gap-2"><div className="h-16 w-16 flex-none overflow-hidden rounded-lg"><EventMedia category={event.category} coverUrl={event.cover_photo_url} compactFallback className="h-full w-full" /></div><div className="min-w-0"><h3 className="break-words text-sm font-bold">{event.title}</h3><p className="text-xs">{formatIngestedCardDate(event.event_datetime)}</p><IngestedStatusBadge status={event.external?.status} /></div></div>
        <p className="mt-1 break-words text-xs">{event.address_text}</p>
        {event.external ? <><p className="mt-1 text-xs">{t.source}: {event.external.sourceName}</p><p className="text-xs">{formatIngestedPrice(event.external.priceFrom, event.external.currency)}</p><EventSessionDates event={event}/></> : <button type="button" className="mt-2 min-h-11 rounded-lg bg-brand-accent px-3 text-xs font-bold text-white" onClick={() => onOpen(event.id)}>{t.details}</button>}
      </article>)}
    </div>
  </section>
}
