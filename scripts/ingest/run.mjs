import { createClient } from '@supabase/supabase-js'
import { createCrawler } from './http.mjs'
import { adapters } from './adapters.mjs'

export async function runIngest(db, crawler = createCrawler()) {
  const checked = async promise => { const result = await promise; if (result.error) throw new Error('database_operation_failed'); return result.data }
  await checked(db.rpc('poruch_ingest_expire'))
  let offset = 0, failed = 0
  while (true) {
    const sources = await checked(db.from('event_sources').select('*').eq('enabled', true).order('id').range(offset, offset + 99))
    for (const source of sources) {
      const token = await checked(db.rpc('poruch_ingest_claim', { p_id: source.id }))
      if (!token) continue
      let found = 0, changed = 0, outcome = 'ok'
      try {
        const adapter = adapters.get(source.type)
        if (!adapter) throw new Error('adapter_not_implemented')
        const events = await adapter(source, crawler); found = events.length
        for (const event of events) {
          const result = await checked(db.rpc('poruch_ingest_item', { p_source: source.id, p_token: token, p_item: event }))
          if (result !== 'unchanged' && result !== 'duplicate') changed++
        }
      } catch (error) {
        outcome = ['adapter_not_implemented', 'robots_disallow', 'robots_unavailable', 'request_timeout', 'response_too_large', 'redirect_limit', 'unsafe_url', 'unsafe_address', 'database_operation_failed'].includes(error.message) || /^http_\d{3}$/.test(error.message) ? error.message : 'source_failed'
        failed++
      } finally {
        await checked(db.rpc('poruch_ingest_finish', { p_id: source.id, p_token: token, p_found: found, p_changed: changed, p_result: outcome }))
      }
      // IDs and bounded result codes only: never URLs, response bodies, env or keys.
      console.log(JSON.stringify({ source: source.id, found, changed, result: outcome }))
    }
    if (sources.length < 100) break
    offset += 100
  }
  await checked(db.rpc('poruch_ingest_expire'))
  return { failed }
}
if (process.argv[1] && new URL(import.meta.url).pathname.replace(/^\//, '').toLowerCase() === process.argv[1].replaceAll('\\', '/').replace(/^\//, '').toLowerCase()) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Missing required secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exitCode = 1 }
  else {
    try { const result = await runIngest(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })); if (result.failed) process.exitCode = 1 }
    catch { console.error('Ingest failed: database/configuration unavailable; check migration and secrets.'); process.exitCode = 1 }
  }
}
