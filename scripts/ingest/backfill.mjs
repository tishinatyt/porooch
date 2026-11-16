import { createVenueGeocoder, validCoordinates } from './geocode.mjs'

export async function fillEventCoordinates(db, row, coordinates) {
  if (!coordinates || !validCoordinates(coordinates.latitude, coordinates.longitude)) return false
  let query = db.from('ingested_events').update({ latitude: coordinates.latitude, longitude: coordinates.longitude }).eq('fingerprint', row.fingerprint).eq('place', row.place).eq('address', row.address).eq('city', row.city).or('latitude.is.null,longitude.is.null')
  query = row.id ? query.eq('id', row.id) : query.contains('source_keys', [`${row.source_id}:${row.external_id}`])
  const result = await query.select('id')
  if (result.error) throw Error('database_operation_failed')
  return Boolean(result.data?.length)
}

export async function runBackfill(db, { geocode = createVenueGeocoder({ db }) } = {}) {
  let last = null, scanned = 0, updated = 0, missing = 0
  while (true) {
    let query = db.from('ingested_events').select('id,place,address,city,latitude,longitude,fingerprint').in('status', ['pending', 'approved']).or('latitude.is.null,longitude.is.null').order('id').limit(100)
    if (last) query = query.gt('id', last)
    const result = await query
    if (result.error) throw Error('database_operation_failed')
    const rows = result.data ?? []
    for (const row of rows) {
      scanned++
      const coordinates = await geocode(row)
      if (await fillEventCoordinates(db, row, coordinates)) updated++
      else missing++
    }
    if (rows.length < 100) break
    last = rows.at(-1).id
  }
  console.log(JSON.stringify({ mode: 'backfill', scanned, updated, missing }))
  return { failed: 0, scanned, updated, missing }
}
