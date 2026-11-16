/** Mirrors server validation; the database remains authoritative. */
export function canAutoPublish(event: { title?: string; place?: string; address?: string; starts_at?: string; event_status?: string }, enabled: boolean, duplicate: boolean, now = Date.now()) {
  return enabled && !duplicate && [...(event.title?.trim() ?? '')].length >= 3 && Boolean(event.place?.trim() || event.address?.trim()) && Number.isFinite(Date.parse(event.starts_at ?? '')) && Date.parse(event.starts_at!) > now && !['EventCancelled', 'EventPostponed'].includes(event.event_status ?? '')
}
