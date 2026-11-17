import { createCrawler } from './http.mjs'
import { enrichVenue } from './enrich.mjs'
import { createVenueGeocoder, validCoordinates } from './geocode.mjs'

export async function fillEventCoordinates(db, row, coordinates) {
  if (!coordinates || !validCoordinates(coordinates.latitude, coordinates.longitude)) return false
  let query = db.from('ingested_events').update({ latitude: coordinates.latitude, longitude: coordinates.longitude }).eq('fingerprint', row.fingerprint).eq('place', row.place).eq('address', row.address).eq('city', row.city).or('latitude.is.null,longitude.is.null')
  query = row.id ? query.eq('id', row.id) : query.contains('source_keys', [`${row.source_id}:${row.external_id}`])
  const result = await query.select('id')
  if (result.error) throw Error('database_operation_failed')
  return Boolean(result.data?.length)
}

export async function runBackfill(db, { geocode = createVenueGeocoder({ db }), crawler = createCrawler(), budgetMs = 150 * 60000 } = {}) {
  let last = null, scanned = 0, updated = 0, missing = 0, venues = 0, failed = 0, merged = 0
  const started = Date.now()
  const finish = (deferred = false) => {
    const result = { failed, scanned, updated, missing, venues, merged, deferred }
    console.log(JSON.stringify({ mode: 'backfill', ...result }))
    return result
  }
  const expired = await db.rpc('poruch_ingest_expire'); if (expired.error) throw Error('database_operation_failed')
  while (true) {
    let query = db.from('ingested_events').select('*').in('status', ['pending', 'approved']).or('latitude.is.null,longitude.is.null,and(place.eq.,address.eq.)').order('id').limit(100)
    if (last) query = query.gt('id', last)
    const result = await query
    if (result.error) throw Error('database_operation_failed')
    const rows = result.data ?? []
    for (let row of rows) {
      if (Date.now() - started > budgetMs) return finish(true)
      scanned++
      const enriched = await enrichVenue(row, crawler)
      if ((!row.place && enriched.place) || (!row.address && enriched.address)) {
        const result = await db.rpc('poruch_ingest_repair', { p_id: row.id, p_fingerprint: row.fingerprint, p_fields: enriched })
        if (result.error) { failed++; continue }
        if (result.data) { row = { ...row, ...result.data }; venues++ }
      }
      try {
        const coordinates = await geocode(row)
        if (await fillEventCoordinates(db, row, coordinates)) updated++
        else missing++
      } catch { failed++ }
    }
    if (rows.length < 100) break
    last = rows.at(-1).id
  }
  let cursor = null
  do {
    const result = await db.rpc('poruch_ingest_merge_duplicates', { p_after: cursor })
    if (result.error) throw Error('database_operation_failed')
    if (typeof result.data?.done !== 'boolean' || (!result.data.done && (!result.data.cursor || result.data.cursor === cursor))) throw Error('invalid_merge_cursor')
    merged += result.data.merged ?? 0
    cursor = result.data.done ? null : result.data.cursor
    if (Date.now() - started > budgetMs) return finish(true)
  } while (cursor)
  return finish()
}
