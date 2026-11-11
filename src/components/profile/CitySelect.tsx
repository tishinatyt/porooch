import { useId, useState } from 'react'
import { cityLabel, findCity, searchCities } from '@/lib/cities'

interface CitySelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
}
export function CitySelect({ value, onChange, className, required = false }: CitySelectProps) {
  const [query, setQuery] = useState('')
  const id = useId()
  const selected = findCity(value)
  const matches = searchCities(query)
  const choices = selected && !matches.some(city => city.id === selected.id) ? [selected, ...matches] : matches
  const inputClass = className ?? 'h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm outline-none focus:border-brand-accent'
  return (
    <div className="min-w-0 space-y-2">
      <input type="search" aria-label="Пошук міста" aria-controls={id} value={query} onChange={event => setQuery(event.target.value)} placeholder="Пошук міста українською або російською" className={inputClass} />
      <select id={id} aria-label="Місто" value={selected ? cityLabel(selected) : value} required={required} onChange={event => onChange(event.target.value)} className={inputClass}>
        <option value="">Оберіть місто</option>
        {value && !selected && <option value={value}>{value}</option>}
        {choices.map(city => <option key={city.id} value={cityLabel(city)}>{cityLabel(city)}</option>)}
      </select>
      {query && <span className="block text-xs font-normal text-brand-ink-muted" role="status">{matches.length ? `Знайдено: ${matches.length}` : 'Місто не знайдено. Спробуйте іншу назву.'}</span>}
    </div>
  )
}
