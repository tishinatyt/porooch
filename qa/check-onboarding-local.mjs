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
    const context = await browser.newContext({ viewport: { width, height: ({ 360: 800, 390: 844, 430: 932 })[width] ?? 900 }, serviceWorkers: 'block' })
    let fixtureRows = []
    context.setFixtureRows = rows => { fixtureRows = rows }
    await context.routeWebSocket('**/*', socket => socket.close())
    const id = '10000000-0000-4000-8000-000000000001'
    const user = { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', is_anonymous: false, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { poruch_onboarding: mode === 'new' ? 'interests' : 'complete' }, created_at: '2026-01-01T00:00:00Z' }
    let profile = { id, name: 'Fixture User', age: 30, gender: 'male', city: 'Київ', avatar_url: `${base}/poruch-logo.png`, interests: ['Кава', 'Прогулянки'], profile_photos: [], google_verified: true }
    const expires = Math.floor(Date.now() / 1000) + 3600
    const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: expires })).toString('base64url')}.offline`
    const session = { access_token: jwt, refresh_token: 'offline-refresh', expires_in: 3600, expires_at: expires, token_type: 'bearer', user }
    if (mode === 'new' || mode === 'home') await context.addInitScript(session => localStorage.setItem('sb-offline-auth-token', JSON.stringify(session)), session)
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
      if (url.pathname.endsWith('/rpc/events_nearby')) return route.fulfill({ json: fixtureRows })
      if (url.pathname === '/rest/v1/events') return route.fulfill({ json: fixtureRows.map(row => ({ id: row.id, event_type: row.event_type, join_mode: 'open', is_public: true, bank_enabled: false })) })
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
    assert.equal(await page.locator('.organizer-banner').count(), 0)
  }
  for (const width of [360, 390, 430, 1440]) {
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
    const home = await contextFor(width, 'home')
    home.setFixtureRows(['public', 'personal'].flatMap(type => Array.from({ length: 24 }, (_, index) => ({
      id: `${type}-fixture-${index}`, title: `${type.toUpperCase()}_FIXTURE_${index}`, event_type: type,
      category: index % 2 ? 'theatre' : 'cinema', address_text: 'Київ', event_datetime: '2099-01-01T15:00:00Z',
      created_at: '2026-01-01T00:00:00Z', min_age: 18, max_age: 99, gender_filter: 'any', distance_km: 1,
      max_participants: 10, participant_count: 0, organizer_id: 'another-fixture-user', organizer: null,
    }))))
    const homePage = await home.newPage()
    await homePage.goto(base)
    await homePage.locator('#public-events-carousel > [role="listitem"]').first().waitFor()
    await homePage.waitForFunction(() => !document.querySelector('[role="status"]'))
    const visibleCreates = () => homePage.locator('a[href="/create"]').evaluateAll(links => links.filter(link => link.getClientRects().length).map(link => link.textContent))
    assert.deepEqual(await visibleCreates(), ['Створити'])
    const publicRail = homePage.locator('#public-events-carousel')
    const personalRail = homePage.locator('#personal-events-carousel')
    const publicBox = await publicRail.boundingBox(), personalBox = await personalRail.boundingBox()
    const categoryBox = await homePage.locator('[aria-label="Категорії афіші"]').boundingBox()
    assert.ok(categoryBox.height <= 48, 'Filters must occupy just one row')
    assert.ok(categoryBox.y + categoryBox.height <= publicBox.y, 'Filters precede afisha')
    assert.ok(publicBox.y < 400, 'Afisha must begin above fold')
    if (width < 640) assert.ok(publicBox.y < personalBox.y)
    else { assert.ok(publicBox.x < personalBox.x); assert.ok(Math.abs(publicBox.y - personalBox.y) <= 3) }
    assert.equal(await publicRail.locator(':scope > [role="listitem"]').count(), 10)
    assert.equal(await personalRail.locator(':scope > [role="listitem"]').count(), 10)
    await layout(homePage, `home-layout-${width}`)
    if (width < 640) {
      const navBox = await homePage.locator('nav.fixed').boundingBox()
      const headingBox = await homePage.locator('#personal-feed-title').boundingBox()
      assert.ok(headingBox.y + headingBox.height <= navBox.y, 'Personal heading must be visible above bottom nav')
      assert.ok(personalBox.y + 44 <= navBox.y, 'At least 44px of the personal rail must fit the first screen')
      assert.ok(categoryBox.height <= 32, 'Mobile chips must be compact')
      assert.equal(await homePage.locator('.home-city-summary').isVisible(), false)
      const cardMetrics = await homePage.locator('#public-events-carousel > [role="listitem"]:first-child article').evaluate(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height, padding: getComputedStyle(card).padding, cover: card.querySelector('.home-card-cover').getBoundingClientRect().width }))
      assert.ok(cardMetrics.width >= width * 0.8, 'Cards should use nearly all available width')
      assert.ok(cardMetrics.height <= 175, 'A short afisha card should be lower than the previous ~180px layout')
      assert.equal(cardMetrics.cover, 56)
      assert.equal(cardMetrics.padding, '8px')
      const smallTargets = await homePage.locator('#public-events-carousel > [role="listitem"]:first-child button, #personal-events-carousel > [role="listitem"]:first-child button').evaluateAll(buttons => buttons.filter(button => { const r = button.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).map(button => button.getAttribute('aria-label') ?? button.textContent))
      assert.deepEqual(smallTargets, [], 'Every event-card button must have a 44px target')
      const clippedChips = await homePage.locator('[aria-label="Категорії афіші"] button').evaluateAll(buttons => buttons.filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent))
      assert.deepEqual(clippedChips, [])
    } else {
      assert.equal(await homePage.locator('.home-city-summary').isVisible(), true)
      assert.equal(await homePage.locator('.home-card-cover').first().evaluate(cover => cover.getBoundingClientRect().width), 108)
    }
    for (const type of ['public', 'personal']) {
      await homePage.locator(`#${type}-events-carousel`).evaluate((element, vertical) => {
        if (vertical) element.scrollTop = element.scrollHeight
        else element.scrollLeft = element.scrollWidth
        element.dispatchEvent(new Event('scroll'))
      }, width >= 1024)
      await homePage.waitForFunction(id => document.getElementById(id).children.length >= 20, `${type}-events-carousel`)
      const other = type === 'public' ? 'personal' : 'public'
      const untouched = await homePage.locator(`#${other}-events-carousel`).evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }))
      if (type === 'public') assert.deepEqual(untouched, { x: 0, y: 0 })
    }
    if (width < 640) {
      await homePage.evaluate(() => window.scrollTo(0, 250))
      const header = await homePage.locator('header.top-bar-surface').boundingBox()
      assert.ok(Math.abs(header.y) <= 1, `Header should stick, got ${header.y}`)
      await homePage.evaluate(() => window.scrollTo(0, 0))
    }
    const beforePersonal = await personalRail.textContent()
    await homePage.locator('[aria-label="Категорії афіші"]').getByRole('button', { name: 'Кіно', exact: true }).click()
    assert.equal(await publicRail.locator(':scope > [role="listitem"]').count(), 10)
    assert.equal(await personalRail.textContent(), beforePersonal)
    assert.doesNotMatch(await publicRail.textContent(), /PUBLIC_FIXTURE_1\b/)
    await homePage.locator('[aria-label="Категорії афіші"]').getByRole('button', { name: 'Усі', exact: true }).click()
    const search = homePage.locator('input[type="search"]')
    await search.fill('PUBLIC_FIXTURE')
    await homePage.getByText('Поки немає особистих подій поруч.', { exact: true }).waitFor()
    await search.fill('PERSONAL_FIXTURE')
    await homePage.getByText('Поки немає публічних подій поруч.', { exact: true }).waitFor()
    await search.fill('NO_RESULTS')
    await homePage.getByText('Поки немає особистих подій поруч.', { exact: true }).waitFor()
    await homePage.getByText('Поки немає публічних подій поруч.', { exact: true }).waitFor()
    assert.deepEqual(await visibleCreates(), ['Створити'])
    if (width < 640) {
      // Stress wrapping with long user content and a demo badge/real cover.
      const longTitle = 'Велика зустріч друзів міста: кіно, театр і музика для всіх охочих разом у вихідні'
      home.setFixtureRows(['public', 'personal'].map(type => ({
        id: `${type}-long`, event_type: type, title: longTitle, category: 'cinema',
        address_text: 'Київ, велика пішохідна площа біля центрального театру, головний вхід',
        cover_photo_url: `${base}/poruch-logo.png`, event_datetime: '2099-01-01T15:00:00Z',
        min_age: 18, max_age: 99, gender_filter: 'any', distance_km: 1, max_participants: 10,
        participant_count: 4, organizer_id: 'another-fixture-user',
        organizer: { id: 'another-fixture-user', name: 'Організатор із довгим ім’ям та прізвищем', avatar_url: null },
      })))
      await homePage.reload()
      await homePage.locator('#public-events-carousel').getByText(longTitle, { exact: true }).waitFor()
      await homePage.locator('[data-home-carousel]').evaluateAll(elements => elements.forEach(element => element.scrollTo({ left: 0, behavior: 'instant' })))
      await homePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await layout(homePage, `home-long-content-${width}`)
      const clippedText = await homePage.locator('.home-event-card h3, .home-event-card .home-card-meta > span:last-child').evaluateAll(elements => elements.filter(element => {
        const style = getComputedStyle(element)
        return element.scrollWidth > element.clientWidth + 2 || (style.overflowY === 'hidden' && element.scrollHeight > element.clientHeight + 2)
      }).map(element => ({ text: element.textContent, scrollWidth: element.scrollWidth, width: element.clientWidth, height: element.clientHeight, scrollHeight: element.scrollHeight, overflow: getComputedStyle(element).overflow })))
      assert.deepEqual(clippedText, [], 'Long titles and addresses must wrap without clipping')
      assert.equal(await homePage.locator('#public-events-carousel h3').first().evaluate(title => getComputedStyle(title).webkitLineClamp), 'none')
      const longRail = await homePage.locator('#personal-events-carousel').boundingBox()
      const bottomNav = await homePage.locator('nav.fixed').boundingBox()
      assert.ok(longRail.y + 44 <= bottomNav.y, 'Second rail must still begin on screen with long titles')
    }
    // The sole responsive create action must still open the creation form.
    for (const link of await homePage.locator('a[href="/create"]').all()) if (await link.isVisible()) { await link.click(); break }
    await homePage.getByText('Яку подію ви створюєте?', { exact: true }).waitFor()
    await home.close()
    checks.push({ width, guestMessageCount: 1, organizerCards: 0, newProfileDestination: '/', existingLoginDestination: '/create', subsequentHomeDestination: '/', filtersHeight: categoryBox.height, publicRailTop: publicBox.y, personalRailTop: personalBox.y, compact: width < 640 })
  }
  await fs.writeFile(`${outDir}/result.json`, JSON.stringify(checks, null, 2))
  console.log(JSON.stringify(checks, null, 2))
} finally {
  if (browser) await browser.close()
  server.kill()
}
