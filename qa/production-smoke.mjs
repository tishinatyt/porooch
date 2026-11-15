import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { cleanupQaFixtures } from './fixtures.mjs'

const BASE_URL = new URL(process.env.BASE_URL || 'https://poruch.fun/').href.replace(/\/?$/, '/')
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase environment')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for complete QA cleanup')
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
// Validate cleanup privileges BEFORE creating any fixtures.
const preflight = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
if (preflight.error) throw preflight.error

const outDir = path.resolve('qa-artifacts')
await fs.mkdir(outDir, { recursive: true })

const stamp = Date.now()
const marker = `QA_${stamp}_${randomUUID()}`
const result = { marker, baseUrl: BASE_URL, users: [], eventId: null, checks: [], errors: [] }
const registry = { marker, users: result.users, eventIds: [] }
const clients = []
const saveRegistry = () => fs.writeFile(path.join(outDir, 'fixtures.json'), JSON.stringify(registry, null, 2))
// Keep the run marker/IDs available for recovery after interruption.
await saveRegistry()
const check = (name, extra = {}) => result.checks.push({ name, ok: true, ...extra })

function clientForSession() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function createQaUser(name) {
  const client = clientForSession()
  clients.push(client)
  const { data, error } = await client.auth.signInAnonymously({ options: { data: { poruch_qa_run: marker } } })
  const userId = data.user?.id
  // Register even when auth returned a user but no usable session.
  if (!userId) throw error ?? new Error('Anonymous auth returned no user')
  const tracked = { id: userId, name, profileCreated: false }
  result.users.push(tracked)
  await saveRegistry()
  if (error || !data.session) throw error ?? new Error('Anonymous auth returned no session')
  const avatarUrl = `${BASE_URL}images/landing/poruch-friends.jpg`
  const { error: profileError } = await client.from('users').upsert({
    id: userId,
    name,
    city: 'Чернігів',
    avatar_url: avatarUrl,
    interests: ['Кава', 'Прогулянки'],
    age: 30,
    gender: 'male',
  })
  if (profileError) throw profileError
  tracked.profileCreated = true
  await saveRegistry()
  return { client, userId, session: data.session }
}

function storageKey() {
  const host = new URL(SUPABASE_URL).hostname
  const ref = host.split('.')[0]
  return `sb-${ref}-auth-token`
}

async function contextWithSession(browser, session, options) {
  const context = await browser.newContext(options)
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, { key: storageKey(), value: session })
  return context
}

async function assertNoHorizontalOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    viewport: window.innerWidth,
  }))
  const overflow = Math.max(dims.scrollWidth, dims.bodyWidth) - dims.clientWidth
  if (overflow > 2) throw new Error(`${label}: horizontal overflow ${overflow}px (${JSON.stringify(dims)})`)
  check(`${label}: no horizontal overflow`, dims)
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true })
}

async function waitText(page, text, timeout = 15000) {
  const matches = page.getByText(text, { exact: false })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const count = await matches.count()
    for (let index = 0; index < count; index += 1) {
      if (await matches.nth(index).isVisible().catch(() => false)) return
    }
    await page.waitForTimeout(100)
  }
  throw new Error(`No visible text match: ${text}`)
}

let browser
let organizer
let participant
let eventId
try {
  browser = await chromium.launch({ headless: true })

  const publicMobile = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true })
  const landing = await publicMobile.newPage()
  await landing.goto(BASE_URL, { waitUntil: 'networkidle' })
  await waitText(landing, 'Poruch — миттєві зустрічі зі своїми!')
  await assertNoHorizontalOverflow(landing, '360px landing')
  await screenshot(landing, '01-landing-360.png')
  await landing.getByRole('button', { name: 'ПОЧАТИ' }).first().click()
  await waitText(landing, 'КРОК 1 З 2')
  await assertNoHorizontalOverflow(landing, '360px onboarding step 1')
  await screenshot(landing, '02-onboarding-360.png')
  await publicMobile.close()

  const publicDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const desktopLanding = await publicDesktop.newPage()
  await desktopLanding.goto(BASE_URL, { waitUntil: 'networkidle' })
  await waitText(desktopLanding, 'Poruch — миттєві зустрічі зі своїми!')
  await assertNoHorizontalOverflow(desktopLanding, 'desktop landing')
  await screenshot(desktopLanding, '03-landing-desktop.png')
  await publicDesktop.close()

  organizer = await createQaUser(`${marker}_ORG`)
  participant = await createQaUser(`${marker}_PART`)
  check('created isolated anonymous QA users', { userIds: [organizer.userId, participant.userId] })

  const eventTime = new Date(Date.now() + 24 * 60 * 60 * 1000)
  eventTime.setMinutes(0, 0, 0)
  // Track before insertion, including an insert whose response may be lost.
  eventId = randomUUID()
  registry.eventIds.push(eventId)
  result.eventId = eventId
  await saveRegistry()
  const { data: insertedEvent, error: eventError } = await organizer.client
    .from('events')
    .insert({
      id: eventId,
      organizer_id: organizer.userId,
      event_type: 'personal',
      is_public: true,
      join_mode: 'approval',
      title: `${marker}_EVENT`,
      description: 'Automated production QA event',
      category: 'other',
      cover_photo_url: null,
      event_datetime: eventTime.toISOString(),
      address_text: 'Чернігів, QA',
      location: 'POINT(31.2849 51.4982)',
      max_participants: 3,
      min_age: 18,
      max_age: 60,
      gender_filter: 'any',
      status: 'upcoming',
      bank_enabled: false,
      bank_note: null,
    })
    .select('id')
    .single()
  if (eventError || !insertedEvent?.id) throw eventError ?? new Error('Failed to create QA event')
  eventId = insertedEvent.id
  result.eventId = eventId
  check('created approval QA event', { eventId })

  const organizerContext = await contextWithSession(browser, organizer.session, {
    viewport: { width: 1440, height: 900 },
    geolocation: { latitude: 51.4982, longitude: 31.2849 },
    permissions: ['geolocation'],
  })
  const organizerPage = await organizerContext.newPage()
  await organizerPage.goto(BASE_URL, { waitUntil: 'networkidle' })
  await organizerPage.waitForTimeout(800)
  if (await organizerPage.getByText('КРОК 1 З 2', { exact: false }).count()) throw new Error('Organizer session was not restored into app')
  await assertNoHorizontalOverflow(organizerPage, 'desktop authenticated home')
  await screenshot(organizerPage, '04-home-desktop.png')

  await organizerPage.goto(new URL('create', BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, 'Яку подію ви створюєте?')
  await assertNoHorizontalOverflow(organizerPage, 'desktop create event')
  await screenshot(organizerPage, '05-create-desktop.png')

  const participantContext = await contextWithSession(browser, participant.session, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 51.4982, longitude: 31.2849 },
    permissions: ['geolocation'],
  })
  const mobile = await participantContext.newPage()
  await mobile.goto(BASE_URL, { waitUntil: 'networkidle' })
  await mobile.waitForTimeout(1000)
  if (await mobile.getByText('КРОК 1 З 2', { exact: false }).count()) throw new Error('Participant session was not restored into app')
  await assertNoHorizontalOverflow(mobile, '390px authenticated home')
  await screenshot(mobile, '06-home-mobile.png')

  const mapButton = mobile.getByRole('button', { name: 'Карта' })
  if (await mapButton.count()) {
    await mapButton.click()
    await mobile.waitForTimeout(1000)
    await assertNoHorizontalOverflow(mobile, '390px discovery map')
    await screenshot(mobile, '07-map-mobile.png')
    check('mobile feed/map switch')
  } else {
    throw new Error('Mobile map switch was not found')
  }

  await mobile.goto(new URL('create', BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(mobile, 'Яку подію ви створюєте?')
  await assertNoHorizontalOverflow(mobile, '390px create event')
  await screenshot(mobile, '08-create-mobile.png')

  await mobile.goto(new URL(`event/${eventId}`, BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(mobile, `${marker}_EVENT`)
  await assertNoHorizontalOverflow(mobile, '390px event detail before join')
  await screenshot(mobile, '09-event-mobile-before-join.png')
  const join = mobile.getByRole('button', { name: 'Надіслати запит' })
  await join.waitFor({ state: 'visible', timeout: 15000 })
  await join.click()
  await waitText(mobile, 'Запит надіслано')
  check('approval join request from mobile')
  await screenshot(mobile, '10-event-mobile-pending.png')

  await organizerPage.goto(new URL(`event/${eventId}`, BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, 'Запити на участь')
  const approve = organizerPage.getByRole('button', { name: 'ПІДТВЕРДИТИ' })
  await approve.waitFor({ state: 'visible', timeout: 15000 })
  await approve.click()
  await organizerPage.getByRole('button', { name: 'ПІДТВЕРДИТИ' }).waitFor({ state: 'hidden', timeout: 15000 })
  check('organizer approval from desktop')
  await screenshot(organizerPage, '11-event-desktop-approved.png')

  await mobile.reload({ waitUntil: 'networkidle' })
  const chatButton = mobile.getByRole('button', { name: 'Перейти до чату' })
  await chatButton.waitFor({ state: 'visible', timeout: 15000 })
  await chatButton.click()
  await waitText(mobile, `${marker}_EVENT`)
  await assertNoHorizontalOverflow(mobile, '390px event chat')
  const message = `${marker}_CHAT_OK`
  await mobile.getByPlaceholder('Написати повідомлення...').fill(message)
  await mobile.getByRole('button', { name: 'Відправити повідомлення' }).click()
  await waitText(mobile, message)
  await screenshot(mobile, '12-chat-mobile.png')
  check('mobile chat send')

  await organizerPage.goto(new URL(`event/${eventId}/chat`, BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, message)
  await assertNoHorizontalOverflow(organizerPage, 'desktop event chat')
  check('desktop chat receives mobile message')

  await participantContext.close()
  await organizerContext.close()

} catch (error) {
  result.errors.push({ message: error?.message ?? String(error), stack: error?.stack ?? null })
  process.exitCode = 1
} finally {
  // No artifact/browser error can skip fixture cleanup. Attempt every resource.
  if (browser) await browser.close().catch(error => result.errors.push({ message: `Browser close: ${error.message}` }))
  for (const client of clients) {
    await client.auth.signOut({ scope: 'global' }).catch(() => {})
  }
  try {
    result.cleanupFailures = await cleanupQaFixtures(admin, registry)
    if (result.cleanupFailures.length) process.exitCode = 1
    else check('QA events, profiles and Auth users removed and verified')
  } catch (error) {
    result.cleanupFailures = [{ message: error?.message ?? String(error) }]
    process.exitCode = 1
  }
  result.cleanupEventIds = registry.eventIds
  if (result.errors.length) process.exitCode = 1
  await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
}
