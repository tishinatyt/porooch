import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.BASE_URL || 'https://tishinatyt.github.io/porooch/'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase environment')

const outDir = path.resolve('qa-artifacts')
await fs.mkdir(outDir, { recursive: true })

const stamp = Date.now()
const marker = `QA_${stamp}`
const result = { marker, baseUrl: BASE_URL, users: [], eventId: null, checks: [], errors: [] }
const check = (name, extra = {}) => result.checks.push({ name, ok: true, ...extra })

function clientForSession() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function createQaUser(name) {
  const client = clientForSession()
  const { data, error } = await client.auth.signInAnonymously()
  if (error || !data.user || !data.session) throw error ?? new Error('Anonymous auth returned no session')
  const userId = data.user.id
  const avatarUrl = `${BASE_URL}images/landing/poruch-friends.jpg`
  const { error: profileError } = await client.from('users').upsert({
    id: userId,
    name,
    city: 'Чернігів',
    avatar_url: avatarUrl,
    interests: ['Кава', 'Прогулянки'],
    age: 30,
    gender: 'any',
  })
  if (profileError) throw profileError
  result.users.push({ id: userId, name })
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
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout })
}

let browser
let organizer
let participant
let eventId
try {
  browser = await chromium.launch({ headless: true })

  // Public landing: small mobile + desktop smoke.
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
  const { data: insertedEvent, error: eventError } = await organizer.client
    .from('events')
    .insert({
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

  // Create screen should remain usable on desktop too.
  await organizerPage.goto(new URL('create', BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, 'Створити')
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

  // Feed -> map switch on mobile.
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

  // Mobile create page layout (no production write from this screen).
  await mobile.goto(new URL('create', BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(mobile, 'Створити')
  await assertNoHorizontalOverflow(mobile, '390px create event')
  await screenshot(mobile, '08-create-mobile.png')

  // Participant requests access from the real event detail page.
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

  // Organizer approves from desktop.
  await organizerPage.goto(new URL(`event/${eventId}`, BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, 'Запити на участь')
  const approve = organizerPage.getByRole('button', { name: 'ПІДТВЕРДИТИ' })
  await approve.waitFor({ state: 'visible', timeout: 15000 })
  await approve.click()
  await organizerPage.getByText('Запити на участь · 1', { exact: false }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  check('organizer approval from desktop')
  await screenshot(organizerPage, '11-event-desktop-approved.png')

  // Participant gets chat access and sends a real message on mobile.
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

  // Organizer sees the participant message.
  await organizerPage.goto(new URL(`event/${eventId}/chat`, BASE_URL).toString(), { waitUntil: 'networkidle' })
  await waitText(organizerPage, message)
  await assertNoHorizontalOverflow(organizerPage, 'desktop event chat')
  check('desktop chat receives mobile message')

  await participantContext.close()
  await organizerContext.close()

  // Remove the event with the organizer session. User rows/auth identities are cleaned by the follow-up DB cleanup.
  const { error: deleteError } = await organizer.client.from('events').delete().eq('id', eventId).eq('organizer_id', organizer.userId)
  if (deleteError) throw deleteError
  check('QA event removed')
} catch (error) {
  result.errors.push({ message: error?.message ?? String(error), stack: error?.stack ?? null })
  process.exitCode = 1
} finally {
  await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2))
  if (browser) await browser.close()
  console.log(JSON.stringify(result, null, 2))
}
