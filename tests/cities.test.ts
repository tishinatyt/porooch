import test from 'node:test'
import assert from 'node:assert/strict'
import { UKRAINIAN_CITIES, UKRAINIAN_OBLAST_CENTERS, findCity, searchCities, readSelectedCity } from '../src/lib/cities.ts'
import { getCityDemoEvents, getDemoEvent } from '../src/components/home/demoEvents.ts'

test('only the original 24 oblast centres are selectable; names and saved choices remain compatible', () => {
  assert.equal(UKRAINIAN_CITIES.length, 24)
  assert.deepEqual(UKRAINIAN_CITIES.map(city => city.name), [...UKRAINIAN_OBLAST_CENTERS])
  assert.equal(findCity('Ніжин'), null)
  assert.equal(findCity('Миколаїв')?.lat, 46.975)
  assert.equal(searchCities('Чернигов')[0]?.name, 'Чернігів')
  assert.equal(searchCities('Киев')[0]?.name, 'Київ')
  assert.equal(searchCities('неіснуюче місто').length, 0)
  const city = findCity('Львів')!
  assert.equal(readSelectedCity({ getItem: () => city.id })?.name, 'Львів')
  assert.equal(readSelectedCity({ getItem: () => 'unknown' }), null)
  assert.equal(readSelectedCity({ getItem: () => { throw Error('Storage disabled') } }), null)
})
test('every centre has exactly one personal and one public test event with stable deep links', () => {
  const now = new Date('2026-10-24T23:59:59Z')
  const all = UKRAINIAN_CITIES.flatMap(city => {
    const events = getCityDemoEvents(city, now)
    assert.deepEqual(events.map(event => event.event_type), ['personal', 'public'])
    for (const event of events) {
      assert.ok(event.address_text.includes(city.name))
      assert.ok(Date.parse(event.event_datetime) > now.getTime())
      assert.equal(event.isDemo, true)
      assert.equal(event.participant_count, 0)
      assert.equal(event.organizer?.google_verified, false)
      assert.equal(event.organizer?.id, '')
      assert.match(event.description!, /Реальна зустріч не запланована/)
      assert.deepEqual(getDemoEvent(event.id, now), event)
      assert.ok(Math.abs(event.location_lat! - city.lat) < 0.002)
    }
    return events
  })
  assert.equal(all.length, 48)
  assert.equal(new Set(all.map(event => event.id)).size, 48)
  assert.equal(getDemoEvent('demo-city-UA00000000000000000-public'), null)
  assert.equal(getDemoEvent('not-an-event'), null)
})
