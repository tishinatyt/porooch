import { useEffect, useId, useRef, useState } from 'react'
import { useDiscoveryCity } from '@/contexts/DiscoveryCityContext'
import { cityLabel, findCity, UKRAINIAN_CITIES } from '@/lib/cities'
import { CitySelect } from '@/components/profile/CitySelect'
import { Icon } from '@/components/icons'

export default function DiscoveryCityPicker() {
  const { city, selectCity } = useDiscoveryCity()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) { if (!wrapper.current?.contains(event.target as Node)) setOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    wrapper.current?.querySelector('input')?.focus()
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div ref={wrapper} className="relative min-w-0 flex-1">
    <button ref={button} type="button" aria-expanded={open} aria-controls={id} aria-label={`Обрати місто: ${cityLabel(city)}`} onClick={() => setOpen(!open)} className="flex min-h-9 max-w-full items-center gap-1.5 rounded-lg pr-2 text-xs font-semibold text-brand-ink-soft focus-visible:outline-2 focus-visible:outline-brand-accent">
      <Icon name="pin" className="h-4 w-4 flex-shrink-0 text-brand-accent" /><span className="truncate">{city.name}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id={id} className="absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-48px))] rounded-2xl border border-brand-border bg-white p-4 shadow-xl">
      <p className="mb-3 text-sm font-extrabold">Оберіть місто</p>
      <CitySelect value={cityLabel(city)} onChange={value => { const next = findCity(value); if (next) { selectCity(next.id); setOpen(false); button.current?.focus() } }} />
      <p className="mt-3 text-[10px] leading-4 text-brand-ink-muted">{UKRAINIAN_CITIES.length} обласні центри. Радіус рахується від центру вибраного міста.</p>
    </div>}
  </div>
}
