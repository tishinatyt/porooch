import EventMedia from '@/components/EventMedia'
import type { PublicEventData } from './types'
import { eventCategoryLabel } from './eventLabels'
import { ingestText as t } from '@/lib/ingestText'
import { formatIngestedCardDate, formatIngestedPrice } from '@/lib/ingestedPresentation'
import IngestedStatusBadge from '@/components/admin/IngestedStatusBadge'

export default function ExternalEventCard({ event }: { event: PublicEventData }) {
  const external = event.external!
  return <article className="home-event-card home-public-card group h-full rounded-[18px] border border-[#d9d2e4] bg-white p-3 sm:p-3.5 lg:h-auto lg:p-3">
    <div className="home-card-demo-slot" />
    <div className="flex min-w-0 gap-3 lg:gap-2.5">
      <div className="min-w-0 flex-1">
        <span className="rounded-lg border bg-brand-accent-soft px-2 py-0.5 text-[10px] font-bold text-brand-accent">{eventCategoryLabel(event.category)}</span>
        <IngestedStatusBadge status={external.status} />
        <a href={external.url} target="_blank" rel="sponsored noopener noreferrer" className="home-card-details mt-1 block min-h-11">
          <h3 title={event.title} className="line-clamp-2 text-[18px] font-extrabold leading-[1.16] tracking-[-0.025em]">{event.title}</h3>
          <p className="home-card-description hidden" title={event.description}>{event.description}</p>
          <p className="home-card-meta mt-1 text-[11px] text-brand-ink-muted">{formatIngestedCardDate(event.event_datetime)}</p>
          <p className="home-card-meta truncate text-[11px] text-brand-ink-muted" title={event.address_text}>{event.address_text}</p>
        </a>
      </div>
      <div className="home-card-cover h-20 w-20 flex-none overflow-hidden rounded-xl sm:h-24 sm:w-24 lg:h-[104px] lg:w-[104px] xl:h-[108px] xl:w-[108px]"><EventMedia category={event.category} coverUrl={event.cover_photo_url} alt="" compactFallback className="h-full w-full" /></div>
    </div>
    <div className="home-card-footer mt-1.5 flex items-center justify-between gap-2 border-t border-brand-border pt-1.5">
      <div className="min-w-0"><p className="truncate text-[10px] font-bold" title={external.sourceName}>{t.source}: {external.sourceName}</p>{external.priceFrom != null && <p className="text-[10px]">{formatIngestedPrice(external.priceFrom, external.currency)}</p>}</div>
      <a href={external.url} target="_blank" rel="sponsored noopener noreferrer" className="home-card-cta inline-flex min-h-11 flex-none items-center justify-center bg-brand-accent px-2 text-[10px] font-bold text-white">{external.priceFrom != null && external.priceFrom > 0 ? t.ticket : t.details}</a>
    </div>
  </article>
}
