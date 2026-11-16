import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CITY_STORAGE_KEY, DEFAULT_CITY, findCity, readSelectedCity, mergePublishedCities, normalizeCitySearch, UKRAINIAN_CITIES, type UkrainianCity } from '@/lib/cities'
import { supabase } from '@/lib/supabase'

const DiscoveryCityContext = createContext<{ city: UkrainianCity; cities: UkrainianCity[]; selectCity: (id: string) => void } | null>(null)
export function DiscoveryCityProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [cities, setCities] = useState(UKRAINIAN_CITIES)
  const [selected, setSelected] = useState<UkrainianCity | null>(() => {
    try { return readSelectedCity(window.localStorage) } catch { return null }
  })
  useEffect(() => {
    let cancelled = false
    void Promise.resolve(supabase.rpc('poruch_ingest_cities')).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return
      const next = mergePublishedCities(data); setCities(next)
      try { const stored = window.localStorage.getItem(CITY_STORAGE_KEY); const restored = next.find(city => city.id === stored); if (restored) setSelected(restored) } catch { /* Storage is optional. */ }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const city = (selected && cities.find(city => city.id === selected.id)) ?? selected ?? cities.find(city => normalizeCitySearch(city.name) === normalizeCitySearch(profile?.city ?? '')) ?? findCity(profile?.city) ?? DEFAULT_CITY
  function selectCity(id: string) {
    const next = cities.find(city => city.id === id || normalizeCitySearch(city.name) === normalizeCitySearch(id))
    if (!next) return
    setSelected(next)
    try { window.localStorage.setItem(CITY_STORAGE_KEY, next.id) } catch { /* Selection still works without browser storage. */ }
  }
  return <DiscoveryCityContext.Provider value={{ city, cities, selectCity }}>{children}</DiscoveryCityContext.Provider>
}
export function useDiscoveryCity() {
  const value = useContext(DiscoveryCityContext)
  if (!value) throw new Error('DiscoveryCityProvider is required')
  return value
}
