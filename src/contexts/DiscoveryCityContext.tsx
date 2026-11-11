import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CITY_STORAGE_KEY, DEFAULT_CITY, findCity, readSelectedCity, type UkrainianCity } from '@/lib/cities'

const DiscoveryCityContext = createContext<{ city: UkrainianCity; selectCity: (id: string) => void } | null>(null)
export function DiscoveryCityProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [selected, setSelected] = useState<UkrainianCity | null>(() => {
    try { return readSelectedCity(window.localStorage) } catch { return null }
  })
  const city = selected ?? findCity(profile?.city) ?? DEFAULT_CITY
  function selectCity(id: string) {
    const next = findCity(id)
    if (!next) return
    setSelected(next)
    try { window.localStorage.setItem(CITY_STORAGE_KEY, next.id) } catch { /* Selection still works without browser storage. */ }
  }
  return <DiscoveryCityContext.Provider value={{ city, selectCity }}>{children}</DiscoveryCityContext.Provider>
}
export function useDiscoveryCity() {
  const value = useContext(DiscoveryCityContext)
  if (!value) throw new Error('DiscoveryCityProvider is required')
  return value
}
