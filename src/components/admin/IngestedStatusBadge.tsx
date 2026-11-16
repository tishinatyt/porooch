import { ingestedStatusLabel } from '@/lib/ingestedPresentation'

export default function IngestedStatusBadge({ status }: { status?: string | null }) {
  const label = ingestedStatusLabel(status)
  return label ? <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">{label}</span> : null
}
