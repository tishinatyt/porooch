import { createClient } from '@supabase/supabase-js'
import { createCrawler } from './http.mjs'
import { adapters } from './adapters.mjs'
import { createVenueGeocoder } from './geocode.mjs'
import { fillEventCoordinates, runBackfill } from './backfill.mjs'
import { abortable } from './timeouts.mjs'
import { canAutoPublish } from '../../src/lib/autoPublish.ts'

export async function runIngest(db, crawler = createCrawler(), { geocode = createVenueGeocoder({ db }), sourceTimeoutMs = 45000, runBudgetMs = 150 * 60000, now = Date.now } = {}) {
  const checked = async (query, signal) => { if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal); const result = await abortable(query, signal); if (result.error) throw new Error(result.error.code === 'PGRST202' ? 'scaling_migration_required' : 'database_operation_failed'); return result.data }
  const started = now(), candidates = new Map()
  const summary = { sources: 0, processed: 0, skipped: 0, events: 0, changed: 0, failed: 0, geocoded: 0, deferred: false }
  await checked(db.rpc('poruch_ingest_expire'))
  let offset = 0
  while (true) {
    const sources = await checked(db.from('event_sources').select('*').eq('enabled', true).order('id').range(offset, offset + 99))
    for (const source of sources) {
      if (now() - started >= runBudgetMs) { summary.deferred = true; break }
      summary.sources++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.min(sourceTimeoutMs, runBudgetMs - (now() - started)))
      let token
      let found = 0, changed = 0, outcome = 'ok'
      try {
        token = await checked(db.rpc('poruch_ingest_claim', { p_id: source.id }), controller.signal)
        if (!token) { summary.skipped++; continue }
        summary.processed++
        const adapter = adapters.get(source.type)
        if (!adapter) throw new Error('adapter_not_implemented')
        const events = await abortable(adapter(source, { get: (url, fetchPage = true) => crawler.get(url, fetchPage, { signal: controller.signal }) }), controller.signal)
        controller.signal.throwIfAborted(); found = events.length; summary.events += found
        for (let index = 0; index < events.length; index += 100) {
          controller.signal.throwIfAborted()
          const batch = events.slice(index, index + 100).map(event => ({ ...event, auto_publish_eligible: canAutoPublish(event, source.auto_publish === true, false, now()) }))
          const results = await checked(db.rpc('poruch_ingest_batch', { p_source: source.id, p_token: token, p_items: batch }), controller.signal)
          controller.signal.throwIfAborted()
          changed += (results ?? []).filter(row => !['unchanged','duplicate'].includes(row.result)).length
          for (const event of batch) if ((event.latitude == null || event.longitude == null) && !candidates.has(event.dedup_hash)) candidates.set(event.dedup_hash, { ...event, source_id: source.id })
        }
      } catch (error) {
        outcome = controller.signal.aborted ? 'source_timeout' : ['scaling_migration_required','adapter_not_implemented', 'robots_disallow', 'robots_unavailable', 'request_timeout', 'response_too_large', 'redirect_limit', 'unsafe_url', 'unsafe_address', 'database_operation_failed'].includes(error.message) || /^http_\d{3}$/.test(error.message) ? error.message : 'source_failed'
        summary.failed++
      } finally {
        clearTimeout(timer); summary.changed += changed
        if (token) {
          const finish = new AbortController(), finishTimer = setTimeout(() => finish.abort(), 20000)
          try { await checked(db.rpc('poruch_ingest_finish', { p_id: source.id, p_token: token, p_found: found, p_changed: changed, p_result: outcome }), finish.signal) }
          catch { summary.failed++; outcome = 'finish_failed' } finally { clearTimeout(finishTimer) }
        }
      }
      // IDs and bounded result codes only: never URLs, response bodies, env or keys.
      console.log(JSON.stringify({ source: source.id, found, changed, result: outcome }))
    }
    if (sources.length < 100 || summary.deferred) break
    offset += 100
  }
  // Geocoding is optional enrichment after facts are saved, never a per-source bottleneck.
  for (const row of candidates.values()) {
    if (now() - started >= runBudgetMs) { summary.deferred = true; break }
    try { if (await fillEventCoordinates(db, row, await geocode(row))) summary.geocoded++ } catch { summary.failed++ }
  }
  await checked(db.rpc('poruch_ingest_expire'))
  console.log(JSON.stringify({ summary, elapsed_ms: now() - started }))
  return summary
}
if (process.argv[1] && new URL(import.meta.url).pathname.replace(/^\//, '').toLowerCase() === process.argv[1].replaceAll('\\', '/').replace(/^\//, '').toLowerCase()) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('Missing required secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exitCode = 1 }
  else {
    try {
      const mode = process.argv.find(arg => arg.startsWith('--mode='))?.slice(7) ?? process.env.INGEST_MODE ?? 'collect'
      if (!['collect', 'backfill'].includes(mode)) throw Error('invalid_mode')
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(20000)]) }) } })
      const result = mode === 'backfill' ? await runBackfill(db) : await runIngest(db)
      if (result.failed || result.deferred) process.exitCode = 1
    }
    catch { console.error('Ingest failed: database/configuration unavailable; check migration and secrets.'); process.exitCode = 1 }
  }
}
