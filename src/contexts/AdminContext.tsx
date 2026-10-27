import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Access = { userId: string | null; allowed: boolean; loading: boolean; error: boolean }
const AdminContext = createContext({ isAdmin: false, loading: false, error: false, retry: () => {} })

export function AdminProvider({ children }: { children: ReactNode }) {
  const { supaUser, loading: authLoading } = useAuth()
  const userId = supaUser?.id ?? null
  const [attempt, setAttempt] = useState(0)
  const [access, setAccess] = useState<Access>({ userId: null, allowed: false, loading: false, error: false })
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    let cancelled = false
    if (!userId) { setAccess({ userId: null, allowed: false, loading: false, error: false }); return }
    setAccess({ userId, allowed: false, loading: true, error: false })
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('poruch_is_admin')
        if (!cancelled) setAccess({ userId, allowed: !error && data === true, loading: false, error: Boolean(error) })
      } catch {
        if (!cancelled) setAccess({ userId, allowed: false, loading: false, error: true })
      }
    })()
    return () => { cancelled = true }
  }, [userId, attempt])
  const current = access.userId === userId
  return <AdminContext.Provider value={{ isAdmin: current && access.allowed && !authLoading, loading: authLoading || !current || access.loading, error: current && access.error, retry }}>{children}</AdminContext.Provider>
}
export function useAdmin() { return useContext(AdminContext) }
