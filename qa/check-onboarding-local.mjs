// Local browser checks only. All non-local requests are intercepted or blocked.
// Uses installed Playwright; PLAYWRIGHT_MODULE may point to an existing index.mjs.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
const base = 'http://127.0.0.1:4178'
const message = 'Створюй свої події та продавай на них квитки разом з Poruch.fun'
const outDir = 'qa-artifacts/onboarding-local'
await fs.mkdir(outDir, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  windowsHide: true,
  env: { ...process.env, VITE_SUPABASE_URL: 'https://offline.supabase.invalid', VITE_SUPABASE_ANON_KEY: 'offline-fixture', VITE_APP_URL: `${base}/`, VITE_GA_MEASUREMENT_ID: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', data => { serverLog += data })
server.stderr.on('data', data => { serverLog += data })
let browser
const checks = []
try {
  const deadline = Date.now() + 30000
  while (true) {
    if (server.exitCode !== null) throw Error(`Local server exited: ${serverLog}`)
    try { if ((await fetch(base)).ok) break } catch { /* Wait for local Vite. */ }
    if (Date.now() > deadline) throw Error(`Local Vite startup timed out: ${serverLog}`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  async function contextFor(width, mode = 'guest') {
    const context = await browser.newContext({ viewport: { width, height: width === 360 ? 800 : 900 }, serviceWorkers: 'block' })
    await context.routeWebSocket('**/*', socket => socket.close())
    const id = '10000000-0000-4000-8000-000000000001'
    const user = { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', is_anonymous: false, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { poruch_onboarding: mode === 'new' ? 'interests' : 'complete' }, created_at: '2026-01-01T00:00:00Z' }
    let profile = { id, name: 'Fixture User', age: 30, gender: 'male', city: 'Київ', avatar_url: `${base}/poruch-logo.png`, interests: ['Кава', 'Прогулянки'], profile_photos: [], google_verified: true }
    const expires = Math.floor(Date.now() / 1000) + 3600
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: expires })).toString('base64url')}.offline`
    const session = { access_token: jwt, refresh_token: 'offline-refresh', expires_in: 3600, expires_at: expires, token_type: 'bearer', user }
    if (mode === 'new') await context.addInitScript(session => localStorage.setItem('sb-offline-auth-token', JSON.stringify(session)), session)
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === base) return route.continue()
      if (url.hostname !== 'offline.supabase.invalid') return route.abort()
      if (url.pathname === '/auth/v1/authorize') {
        assert.equal(new URL(url.searchParams.get('redirect_to')).origin, base)
        const destination = url.searchParams.get('redirect_to')
        return route.fulfill({ status: 302, headers: { location: `${destination}#access_token=${jwt}&refresh_token=offline-refresh&expires_in=3600&token_type=bearer` } })
      }
      if (url.pathname === '/auth/v1/user') {
        if (request.method() === 'PUT') Object.assign(user.user_metadata, request.postDataJSON().data)
        return route.fulfill({ json: user })
      }
      if (url.pathname.startsWith('/rest/v1/users')) {
        if (request.method() === 'PATCH' || request.method() === 'POST') {
          profile = { ...profile, ...request.postDataJSON() }
          return route.fulfill({ status: 204 })
        }
        return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? profile : [profile] })
      }
      if (url.pathname.includes('/rpc/poruch_is_admin')) return route.fulfill({ json: false })
      if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
      throw Error(`Unexpected offline fixture request: ${request.method()} ${url.pathname}`)
    })
    return context
  }
  async function layout(page, label) {
    const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }))
    assert.ok(dims.scroll <= dims.viewport + 1, `${label}: overflow ${JSON.stringify(dims)}`)
    await page.screenshot({ path: `${outDir}/${label}.png` })
  }
  async function feed(page) {
    await page.getByRole('group', { name: 'Режим перегляду подій' }).waitFor()
    assert.equal(await page.locator('.organizer-section, .organizer-ticket').count(), 0)
    assert.equal(await page.getByText(message, { exact: true }).count(), 0)
    assert.equal(await page.locator('.organizer-banner').count(), 1)
  }
  for (const width of [360, 1440]) {
    const guest = await contextFor(width)
    const page = await guest.newPage()
    await page.goto(base)
    await page.locator('.landing-hero-actions').waitFor()
    assert.equal(await page.getByText(message, { exact: true }).count(), 1)
    assert.equal(await page.locator('.organizer-section, .organizer-ticket, .organizer-banner').count(), 0)
    for (const action of ['Знайти подію', 'Створити подію']) {
      const bounds = await page.locator('.landing-hero-actions').getByText(action, { exact: true }).boundingBox()
      assert.ok(bounds && bounds.y + bounds.height <= page.viewportSize().height, `${action} must fit the first screen at ${width}px`)
    }
    await layout(page, `guest-${width}`)
    await guest.close()

    const registered = await contextFor(width, 'new')
    const newPage = await registered.newPage()
    await newPage.goto(`${base}/create`)
    await newPage.getByText('КРОК 2 З 2').waitFor()
    await newPage.getByRole('button', { name: 'ГОТОВО', exact: true }).click()
    await newPage.waitForURL(`${base}/`)
    await feed(newPage)
    await layout(newPage, `new-profile-feed-${width}`)
    await registered.close()

    const existing = await contextFor(width, 'existing')
    const loginPage = await existing.newPage()
    await loginPage.goto(`${base}/create`)
    await loginPage.getByRole('button', { name: 'УВІЙТИ З GOOGLE', exact: true }).click()
    await loginPage.getByText('Яку подію ви створюєте?', { exact: true }).waitFor()
    assert.equal(new URL(loginPage.url()).pathname, '/create')
    // A separate home entry must not reuse the previous create destination.
    await loginPage.goto(`${base}/`)
    await feed(loginPage)
    assert.equal(new URL(loginPage.url()).pathname, '/')
    await layout(loginPage, `existing-profile-feed-${width}`)
    await existing.close()
    checks.push({ width, guestMessageCount: 1, organizerCards: 0, newProfileDestination: '/', existingLoginDestination: '/create', subsequentHomeDestination: '/' })
  }
  await fs.writeFile(`${outDir}/result.json`, JSON.stringify(checks, null, 2))
  console.log(JSON.stringify(checks, null, 2))
} finally {
  if (browser) await browser.close()
  server.kill()
}
