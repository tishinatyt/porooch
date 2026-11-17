import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { asExternalEvent, type IngestedRow } from '@/lib/ingestedEvents'
import type { PublicEventData } from '@/components/home/types'
import { groupEventSessions } from '@/lib/eventSessions'

export function useIngestedFeed(city: string, category: string, search: string, desired: number) {
  const key = JSON.stringify([city, category, search]), generation = useRef(0)
  const [snapshot, setSnapshot] = useState<{ key: string; rows: PublicEventData[]; more: boolean }>({ key: '', rows: [], more: false })
  const [error, setError] = useState(false), [revision, setRevision] = useState(0)
  const [now,setNow]=useState(Date.now)
  useEffect(() => {
    const request = ++generation.current
    setError(false)
    void (async () => {
      try {
        const rows: IngestedRow[] = []
        // Read every page so dates of a group cannot disappear at a UI page boundary.
        while (true) {
          const limit = 100
          const result = await supabase.rpc('poruch_ingest_feed', { p_city: city, p_category: category, p_search: search.trim().slice(0, 200), p_offset: rows.length, p_limit: limit })
          if (request !== generation.current) return
          if (result.error) throw result.error
          const page = Array.isArray(result.data) ? result.data as IngestedRow[] : []
          rows.push(...page)
          if (page.length < limit) break
        }
        if (request === generation.current) { setNow(Date.now()); setSnapshot({ key, rows: rows.map(asExternalEvent).filter((row): row is PublicEventData => row !== null), more: false }) }
      } catch { if (request === generation.current) { setError(true); setSnapshot({ key, rows: [], more: false }) } }
    })()
    return () => { generation.current++ }
  }, [key, city, category, search, revision])
  const grouped=groupEventSessions(snapshot.key === key ? snapshot.rows : [],now)
  useEffect(()=>{
    const next=snapshot.rows.map(row=>Date.parse(row.event_datetime)).filter(time=>time>now).sort((a,b)=>a-b)[0]
    const refresh=()=>setNow(Date.now())
    const timer=next ? setTimeout(refresh,Math.min(2147483647,Math.max(1,next-Date.now()+10))) : null
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{if(timer)clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[snapshot,now])
  const limit=Number.isFinite(desired)?desired:grouped.length
  return { rows: grouped.slice(0,limit), more: grouped.length>limit, error, retry: () => setRevision(v => v + 1) }
}
