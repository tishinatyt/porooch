import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { cleanupQaFixtures } from '../qa/fixtures.mjs'

function fixtures() {
  const marker = 'test-run'
  const users = new Map([['one', { id: 'one', user_metadata: { poruch_qa_run: marker } }], ['lost-response', { id: 'lost-response', user_metadata: { poruch_qa_run: marker } }], ['unrelated', { id: 'unrelated', user_metadata: {} }]])
  const tables: Record<string, Set<string>> = { events: new Set(['event', 'unrelated-event']), users: new Set(['one', 'unrelated']) }
  const calls: string[] = []
  let fail: (resource: string) => boolean = () => false
  const ok = (data: any) => ({ data, error: null })
  const error = () => ({ data: null, error: { message: 'cleanup network failure' } })
  const admin = {
    from: (table: string) => ({
      delete: () => ({ eq: async (_: string, id: string) => {
        calls.push(`delete ${table}:${id}`)
        if (fail(`${table}:${id}`)) return error()
        tables[table].delete(id); return ok(null)
      } }),
      select: () => ({ eq: async (_: string, id: string) => ok(tables[table].has(id) ? [{ id }] : []) }),
    }),
    auth: { admin: {
      listUsers: async () => ok({ users: [...users.values()] }),
      getUserById: async (id: string) => users.has(id) ? ok({ user: users.get(id) }) : { data: { user: null }, error: { status: 404 } },
      deleteUser: async (id: string, soft: boolean) => { assert.equal(soft, false); calls.push(`delete auth:${id}`); if (fail(`auth:${id}`)) return error(); users.delete(id); return ok({ user: null }) },
    } },
  }
  const registry = { marker, users: [{ id: 'one', profileCreated: true }], eventIds: ['event'] }
  return { admin, registry, users, tables, calls, failWith: (fn: typeof fail) => { fail = fn } }
}

test('QA cleanup removes events, profiles and Auth users, including partial/lost signup; unrelated data stays', async () => {
  const f = fixtures()
  assert.deepEqual(await cleanupQaFixtures(f.admin, f.registry), [])
  assert.deepEqual([...f.users.keys()], ['unrelated'])
  assert.deepEqual([...f.tables.events], ['unrelated-event'])
  assert.deepEqual([...f.tables.users], ['unrelated'])
  assert.ok(f.calls.includes('delete users:lost-response'))
  assert.ok(f.calls.includes('delete auth:lost-response'))
  assert.deepEqual(await cleanupQaFixtures(f.admin, f.registry), []) // idempotent finally/recovery
})

test('QA cleanup retries transient errors and continues other resources after permanent errors', async () => {
  const f = fixtures()
  let attempts = 0
  f.failWith(resource => resource === 'events:event' && attempts++ < 2)
  assert.deepEqual(await cleanupQaFixtures(f.admin, f.registry), [])
  assert.equal(attempts, 3)
  const broken = fixtures()
  broken.failWith(resource => resource === 'events:event')
  const failures = await cleanupQaFixtures(broken.admin, broken.registry)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].resource, 'event:event')
  assert.ok(broken.calls.includes('delete auth:one'))
  assert.ok(broken.calls.includes('delete auth:lost-response'))
})

// Execute the real entry point with explicit offline dependencies. Do not import
// Playwright or construct a network-capable Supabase client in these tests.
async function runEntryPoint(failure: 'profile' | 'event' | 'none', withAdminKey = true) {
  const source = readFileSync(new URL('../qa/production-smoke.mjs', import.meta.url), 'utf8').replace(/^import [^\r\n]*\r?\n/gm, '')
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const profiles = new Map<string, any>()
  const identities = new Map<string, any>()
  const events = new Map<string, any>()
  let report: any
  let hiddenChecks = 0
  let visibleChecks = 0
  const processStub = { env: { SUPABASE_URL: 'https://mock.invalid', SUPABASE_ANON_KEY: 'anon', ...(withAdminKey ? { SUPABASE_SERVICE_ROLE_KEY: 'mock-admin' } : {}) }, exitCode: undefined as number | undefined }
  const ok = (data: any) => ({ data, error: null })
  const admin = {
    auth: { admin: {
      listUsers: async () => ok({ users: [...identities.values()] }),
      getUserById: async (id: string) => identities.has(id) ? ok({ user: identities.get(id) }) : { data: null, error: { status: 404 } },
      deleteUser: async (id: string) => { identities.delete(id); return ok(null) },
    } },
    from: (table: string) => {
      const data = table === 'users' ? profiles : events
      return {
        delete: () => ({ eq: async (_: string, id: string) => { data.delete(id); return ok(null) } }),
        select: () => ({ eq: async (_: string, id: string) => ok(data.has(id) ? [{ id }] : []) }),
      }
    },
  }
  const createClient = (_url: string, key: string) => {
    if (key === 'mock-admin') return admin
    let user: any
    return {
      auth: {
        signInAnonymously: async (args: any) => {
          user = { id: randomUUID(), user_metadata: args.options.data }
          identities.set(user.id, user)
          return { data: { user, session: { user } }, error: null }
        },
        signOut: async () => ok(null),
      },
      from: (table: string) => ({
        upsert: async (row: any) => {
          assert.equal(row.gender, 'male')
          if (failure === 'profile') return { error: Error('profile write failure') }
          profiles.set(row.id, row); return ok(null)
        },
        insert: (row: any) => {
          assert.equal(table, 'events'); events.set(row.id, row)
          return { select: () => ({ single: async () => failure === 'event' ? { data: null, error: Error('insert response lost') } : ok({ id: row.id }) }) }
        },
      }),
    }
  }
  let stepChecks = 0
  const locator = (count = 1): any => ({
    first: () => locator(count), nth: (index: number) => ({ isVisible: async () => { if (index === 0) { hiddenChecks += 1; return false }; visibleChecks += 1; return true } }), isVisible: async () => true,
    count: async () => count,
    click: async () => {}, fill: async () => {}, waitFor: async () => {},
  })
  const page = {
    goto: async () => {}, screenshot: async () => {}, reload: async () => {}, waitForTimeout: async () => {},
    getByText: (text: string) => locator(text === 'КРОК 1 З 2' && ++stepChecks > 1 ? 0 : 2), getByRole: () => locator(), getByPlaceholder: () => locator(),
    evaluate: async () => ({ scrollWidth: 390, clientWidth: 390, bodyWidth: 390, viewport: 390 }),
  }
  const chromium = { launch: async () => ({ newContext: async () => ({ newPage: async () => page, addInitScript: async () => {}, close: async () => {} }), close: async () => {} }) }
  const fs = { mkdir: async () => {}, writeFile: async (_file: string, content: string) => { report = JSON.parse(content) } }
  const run = new AsyncFunction('fs', 'path', 'chromium', 'createClient', 'randomUUID', 'cleanupQaFixtures', 'process', 'console', source)
  let rejected = false
  try { await run(fs, path, chromium, createClient, randomUUID, cleanupQaFixtures, processStub, { log: () => {} }) }
  catch { rejected = true }
  return { report, identities, profiles, events, processStub, rejected, hiddenChecks, visibleChecks }
}

test('real QA finally cleans partial signup/profile failure without live services', async () => {
  const f = await runEntryPoint('profile')
  assert.equal(f.rejected, false)
  assert.equal(f.processStub.exitCode, 1)
  assert.equal(f.report.users.length, 1)
  assert.equal(f.report.users[0].profileCreated, false)
  assert.equal(f.report.baseUrl, 'https://poruch.fun/')
  assert.deepEqual(f.report.cleanupFailures, [])
  assert.equal(f.identities.size + f.profiles.size + f.events.size, 0)
})

test('real QA finally removes event after a lost insert response as well as both Auth users/profiles', async () => {
  const f = await runEntryPoint('event')
  assert.equal(f.rejected, false)
  assert.equal(f.processStub.exitCode, 1)
  assert.equal(f.report.cleanupEventIds.length, 1)
  assert.equal(f.report.users.length, 2)
  assert.deepEqual(f.report.cleanupFailures, [])
  assert.equal(f.identities.size + f.profiles.size + f.events.size, 0)
})

test('real QA successful path also cleans all fixtures; missing admin key fails before signup', async () => {
  const success = await runEntryPoint('none')
  assert.equal(success.rejected, false)
  assert.equal(success.processStub.exitCode, undefined)
  assert.deepEqual(success.report.cleanupFailures, [])
  assert.equal(success.identities.size + success.profiles.size + success.events.size, 0)
  const denied = await runEntryPoint('none', false)
  assert.equal(denied.rejected, true)
  assert.equal(denied.identities.size + denied.profiles.size + denied.events.size, 0)
})

test('QA entry point skips hidden first text match and accepts a later visible match', async () => {
  const f = await runEntryPoint('none')
  assert.equal(f.rejected, false)
  assert.equal(f.processStub.exitCode, undefined)
  assert.ok(f.hiddenChecks > 0)
  assert.equal(f.hiddenChecks, f.visibleChecks)
})
