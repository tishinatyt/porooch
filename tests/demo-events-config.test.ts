import test from 'node:test'
import assert from 'node:assert/strict'
import { demoEventsEnabled } from '../src/lib/demoEventsConfig.ts'

test('demo events require explicit development opt-in and cannot be enabled in production', () => {
  assert.equal(demoEventsEnabled({ DEV: false, VITE_SHOW_DEMO_EVENTS: 'true' }), false)
  assert.equal(demoEventsEnabled({ DEV: false }), false)
  assert.equal(demoEventsEnabled({ DEV: true }), false)
  assert.equal(demoEventsEnabled({ DEV: true, VITE_SHOW_DEMO_EVENTS: 'false' }), false)
  assert.equal(demoEventsEnabled({ DEV: true, VITE_SHOW_DEMO_EVENTS: 'true' }), true)
  assert.equal(demoEventsEnabled(undefined), false)
})
