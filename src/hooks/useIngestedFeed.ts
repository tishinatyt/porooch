import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { asExternalEvent, type IngestedRow } from '@/lib/ingestedEvents'
import type { PublicEventData } from '@/components/home/types'

export function useIngestedFeed(city: string, category: string, search: string, desired: number) {
  const key = JSON.stringify([city, category, search]), generation = useRef(0)
  const [snapshot, setSnapshot] = useState<{ key: string; rows: PublicEventData[]; more: boolean }>({ key: '', rows: [], more: false })
  const [error, setError] = useState(false), [revision, setRevision] = useState(0)
  useEffect(() => {
    const request = ++generation.current
    setError(false)
    void (async () => {
      try {
        const rows: IngestedRow[] = []; const target = desired + 1
        while (rows.length < target) {
          const limit = Math.min(100, target - rows.length)
          const result = await supabase.rpc('poruch_ingest_feed', { p_city: city, p_category: category, p_search: search.trim().slice(0, 200), p_offset: rows.length, p_limit: limit })
          if (request !== generation.current) return
          if (result.error) throw result.error
          const page = Array.isArray(result.data) ? result.data as IngestedRow[] : []
          rows.push(...page)
          if (page.length < limit) break
        }
        if (request === generation.current) setSnapshot({ key, rows: rows.map(asExternalEvent).filter((row): row is PublicEventData => row !== null), more: rows.length === target })
      } catch { if (request === generation.current) { setError(true); setSnapshot({ key, rows: [], more: false }) } }
    })()
    return () => { generation.current++ }
  }, [key, city, category, search, desired, revision])
  return { rows: snapshot.key === key ? snapshot.rows : [], more: snapshot.key === key && snapshot.more, error, retry: () => setRevision(v => v + 1) }
}
