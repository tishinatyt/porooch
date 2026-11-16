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
  env: { ...process.env, VITE_SUPABASE_URL: 'https://offline.supabase.invalid', VITE_SUPABASE_ANON_KEY: 'offline-fixture', VITE_APP_URL: `${base}/`, VITE_GA_MEASUREMENT_ID: '', VITE_SHOW_DEMO_EVENTS: 'false' },
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
    const context = await browser.newContext({ viewport: { width, height: ({ 360: 800, 390: 844, 430: 932 })[width] ?? 900 }, ...(width < 640 ? { isMobile: true, hasTouch: true } : {}), serviceWorkers: 'block' })
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
      if (url.pathname.endsWith('/rpc/events_nearby')) {
        if (mode === 'home') await new Promise(resolve => setTimeout(resolve, 350))
        return route.fulfill({ json: fixtureRows })
      }
      if (url.pathname === '/rest/v1/events') return route.fulfill({ json: fixtureRows.map(row => ({ id: row.id, event_type: row.event_type, description: row.description ?? '', join_mode: 'open', is_public: true, bank_enabled: false })) })
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
  async function firstCards(page) {
    await page.waitForFunction(() => ['public', 'personal'].every(type => {
      const rail = document.getElementById(`${type}-events-carousel`)
      if (!rail?.firstElementChild) return false
      return Math.abs(rail.scrollLeft) <= 1 && rail.firstElementChild.getBoundingClientRect().left >= rail.getBoundingClientRect().left - 1
    }))
  }
  async function uniformCards(page) {
    for (const [type, expectedHeight] of [['public', 236], ['personal', 296]]) {
      const metrics = await page.locator(`#${type}-events-carousel article`).evaluateAll(cards => cards.map(card => {
        const title = card.querySelector('h3'), description = card.querySelector('.home-card-description')
        return { height: card.getBoundingClientRect().height, width: card.getBoundingClientRect().width, titleHeight: title.clientHeight, descriptionHeight: description.clientHeight, titleClamp: getComputedStyle(title).webkitLineClamp, descriptionClamp: getComputedStyle(description).webkitLineClamp }
      }))
      assert.ok(metrics.length >= 1)
      for (const metric of metrics) {
        assert.equal(metric.height, expectedHeight)
        assert.ok(Math.abs(metric.width - metrics[0].width) < 1)
        assert.equal(metric.titleHeight, 36)
        assert.equal(metric.descriptionHeight, 28)
        assert.equal(metric.titleClamp, '2')
        assert.equal(metric.descriptionClamp, '2')
      }
    }
  }
  async function swipeForward(context, page, type) {
    const rail = page.locator(`#${type}-events-carousel`)
    await rail.scrollIntoViewIfNeeded()
    const box = await rail.boundingBox()
    const y = Math.min(box.y + 90, page.viewportSize().height - 100)
    const cdp = await context.newCDPSession(page)
    const start = box.x + box.width - 25, end = box.x + 35
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 12, y }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForFunction(id => {
      const rail = document.getElementById(id)
      const step = rail.children[1].offsetLeft - rail.children[0].offsetLeft
      return step > 0 && rail.scrollLeft >= step - 2
    }, `${type}-events-carousel`)
    await cdp.detach()
  }
  for (const width of process.env.CHECK_INGEST_ONLY ? [] : [360, 390, 430, 1440]) {
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
      id: `${type}-fixture-${index}`, title: `${type.toUpperCase()}_FIXTURE_${index}${index % 3 === 1 ? ' — довга назва зустрічі, концерту та вистави для всіх друзів міста разом у вихідні' : ''}`, event_type: type,
      description: index % 3 === 0 ? '' : index % 3 === 1 ? 'Довгий опис зустрічі з багатьма подробицями, програмою та додатковою інформацією. '.repeat(5) : 'Короткий опис.',
      category: index % 2 ? 'theatre' : 'cinema', address_text: 'Київ', event_datetime: '2099-01-01T15:00:00Z',
      created_at: '2026-01-01T00:00:00Z', min_age: 18, max_age: 99, gender_filter: 'any', distance_km: 1,
      max_participants: 10, participant_count: 0, organizer_id: 'another-fixture-user', organizer: null,
    }))))
    const homePage = await home.newPage()
    await homePage.goto(base)
    await homePage.locator('#public-events-carousel > [role="listitem"]').first().waitFor()
    await homePage.waitForFunction(() => !document.querySelector('[role="status"]'))
    if (width < 640) await firstCards(homePage)
    const visibleCreates = () => homePage.locator('a[href="/create"]').evaluateAll(links => links.filter(link => link.getClientRects().length).map(link => link.textContent))
    assert.deepEqual(await visibleCreates(), ['Створити'])
    for (const [id, title] of [['public-feed-title', 'Публічні події'], ['personal-feed-title', 'Особисті події']]) {
      const heading = homePage.locator('#' + id)
      assert.equal(await heading.textContent(), title)
      const size = await heading.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el)
        return { lines: range.getClientRects().length, width: el.scrollWidth, available: el.parentElement.clientWidth }
      })
      assert.equal(size.lines, 1, title + ': one line')
      assert.ok(size.width <= size.available, title + ': fits container')
    }
    const publicRail = homePage.locator('#public-events-carousel')
    const personalRail = homePage.locator('#personal-events-carousel')
    const publicBox = await publicRail.boundingBox(), personalBox = await personalRail.boundingBox()
    const categoryBox = await homePage.locator('[aria-label="Категорії публічних подій"]').boundingBox()
    assert.ok(categoryBox.height <= 48, 'Filters must occupy just one row')
    assert.equal(await homePage.locator('.home-city-summary').count(), 0)
    assert.equal(await homePage.locator('.home-card-demo').count(), 0)
    const switcher = homePage.getByRole('group', { name: 'Режим перегляду подій' })
    const switcherBefore = await switcher.boundingBox()
    const toolbarBox = await homePage.locator('.home-toolbar').boundingBox()
    assert.ok(toolbarBox.height <= 48)
    assert.ok(categoryBox.x + categoryBox.width + 4 <= switcherBefore.x, 'Category viewport must end before switcher')
    assert.ok(Math.abs(categoryBox.y + categoryBox.height / 2 - switcherBefore.y - switcherBefore.height / 2) <= 1, 'Controls share one row')
    await homePage.locator('[aria-label="Категорії подій"]').evaluate(strip => { strip.scrollLeft = strip.scrollWidth })
    assert.deepEqual(await switcher.boundingBox(), switcherBefore, 'Switcher does not move when categories scroll')
    await homePage.locator('[aria-label="Категорії подій"]').evaluate(strip => { strip.scrollLeft = 0 })
    const toolbarTargets = await homePage.locator('.home-toolbar button').evaluateAll(buttons => buttons.filter(button => { const r = button.getBoundingClientRect(); return r.width < 44 || r.height < 44 || button.scrollWidth > button.clientWidth + 1 }).map(button => button.textContent))
    assert.deepEqual(toolbarTargets, [], 'Toolbar hit areas must be >=44px with full labels')
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
      assert.equal(categoryBox.height, 44)
      assert.equal(await homePage.locator('.home-city-summary').isVisible(), false)
      const cardMetrics = await homePage.locator('#public-events-carousel > [role="listitem"]:first-child article').evaluate(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height, padding: getComputedStyle(card).padding, cover: card.querySelector('.home-card-cover').getBoundingClientRect().width }))
      assert.ok(cardMetrics.width >= width * 0.8, 'Cards should use nearly all available width')
      assert.equal(cardMetrics.height, 236)
      assert.equal(cardMetrics.cover, 56)
      assert.equal(cardMetrics.padding, '8px')
      const smallTargets = await homePage.locator('#public-events-carousel > [role="listitem"]:first-child button, #personal-events-carousel > [role="listitem"]:first-child button').evaluateAll(buttons => buttons.filter(button => { const r = button.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).map(button => button.getAttribute('aria-label') ?? button.textContent))
      assert.deepEqual(smallTargets, [], 'Every event-card button must have a 44px target')
      const clippedChips = await homePage.locator('[aria-label="Категорії публічних подій"] button').evaluateAll(buttons => buttons.filter(button => button.scrollWidth > button.clientWidth + 1).map(button => button.textContent))
      assert.deepEqual(clippedChips, [])
      await uniformCards(homePage)
      for (const type of ['public', 'personal']) {
        const geometry = await homePage.locator(`#${type}-events-carousel`).evaluate(rail => {
          const r = rail.getBoundingClientRect(), first = rail.children[0].getBoundingClientRect(), second = rail.children[1].getBoundingClientRect()
          return { direction: getComputedStyle(rail).direction, layout: getComputedStyle(rail).flexDirection, firstLeft: first.left - r.left, firstRight: first.right - r.right, peek: r.right - second.left, inOrder: first.left < second.left }
        })
        assert.equal(geometry.direction, 'ltr'); assert.equal(geometry.layout, 'row')
        assert.ok(geometry.firstLeft >= -1 && geometry.firstLeft <= 1)
        assert.ok(geometry.firstRight <= 1)
        assert.ok(geometry.peek > 0 && geometry.peek < 40)
        assert.ok(geometry.inOrder)
        await swipeForward(home, homePage, type)
      }
      await homePage.reload()
      await homePage.waitForFunction(() => !document.querySelector('[role="status"]') && document.getElementById('public-events-carousel')?.textContent.includes('PUBLIC_FIXTURE_0'))
      await firstCards(homePage)
    } else {
      assert.equal(await homePage.locator('.home-city-summary').count(), 0)
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
    await homePage.locator('[aria-label="Категорії публічних подій"]').getByRole('button', { name: 'Кіно', exact: true }).click()
    if (width < 640) await homePage.waitForFunction(() => document.getElementById('public-events-carousel').scrollLeft === 0)
    assert.equal(await publicRail.locator(':scope > [role="listitem"]').count(), 10)
    assert.equal(await personalRail.textContent(), beforePersonal)
    assert.doesNotMatch(await publicRail.textContent(), /PUBLIC_FIXTURE_1\b/)
    await homePage.locator('[aria-label="Категорії публічних подій"]').getByRole('button', { name: 'Усі', exact: true }).click()
    const search = homePage.locator('input[type="search"]')
    await search.fill('PUBLIC_FIXTURE')
    await homePage.getByText('Поки немає особистих подій', { exact: true }).waitFor()
    await search.fill('PERSONAL_FIXTURE')
    await homePage.getByText('Поки немає публічних подій', { exact: true }).waitFor()
    await search.fill('NO_RESULTS')
    await homePage.getByText('Поки немає особистих подій', { exact: true }).waitFor()
    await homePage.getByText('Поки немає публічних подій', { exact: true }).waitFor()
    assert.deepEqual(await visibleCreates(), ['Створити'])
    if (width < 640) {
      // Long/empty descriptions, long titles and demo badges must share slots.
      const longTitle = 'Велика зустріч друзів міста: кіно, театр і музика для всіх охочих разом у вихідні'
      home.setFixtureRows(['public', 'personal'].map(type => ({
        id: `${type}-long`, event_type: type, title: longTitle, category: 'cinema',
        description: 'Довгий опис із програмою зустрічі та важливими подробицями. '.repeat(8),
        address_text: 'Київ, велика пішохідна площа біля центрального театру, головний вхід',
        cover_photo_url: `${base}/poruch-logo.png`, event_datetime: '2099-01-01T15:00:00Z',
        min_age: 18, max_age: 99, gender_filter: 'any', distance_km: 1, max_participants: 10,
        participant_count: 4, organizer_id: 'another-fixture-user',
        organizer: { id: 'another-fixture-user', name: 'Організатор із довгим ім’ям та прізвищем', avatar_url: null },
      })))
      await homePage.reload()
      await homePage.locator('#public-events-carousel').getByText(longTitle, { exact: true }).waitFor()
      await firstCards(homePage)
      await layout(homePage, `home-long-content-${width}`)
      await uniformCards(homePage)
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
  for (const width of [360, 1440]) {
    const context = await contextFor(width, 'home')
    const posterRequests = []
    await context.route('https://posters.example.test/**', route => { posterRequests.push(route.request().url()); return route.fulfill({ status: 404, body: '' }) })
    await context.route('**/rest/v1/rpc/poruch_ingest_feed', route => route.fulfill({ json: [0, 1, 2].map(index => ({
      id: `external-${index}`, title: `Концерт · ${index}`, starts_at: '2099-01-01T18:00:00Z',
      place: 'Міська зала', address: 'вул. Миру, 1', city: 'Київ', category: 'music', latitude: null, longitude: null,
      price_from: 200, currency: 'UAH', source_url: `https://tickets.example.test/event/${index}`,
      cover_url: index === 2 ? `${base}/poruch-logo.png` : `https://posters.example.test/${index === 0 ? 'disabled' : 'broken'}.jpg`, use_source_images: index !== 0,
      description: 'Короткі факти про подію', source_name: 'Міська афіша', partner_params: 'utm_source=poruch',
    })) }))
    const page = await context.newPage()
    await page.goto(base)
    await page.locator('.home-public-card').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('[role="status"]'))
    const cards = page.locator('.home-public-card')
    assert.equal(await cards.count(), 3)
    assert.equal(await cards.locator('button').count(), 0)
    assert.equal(await cards.getByText('Купити квиток', { exact: true }).count(), 3)
    await page.waitForFunction(() => { const images = document.querySelectorAll('.home-public-card img'); return images.length === 1 && images[0].complete && images[0].naturalWidth > 0 })
    assert.deepEqual(posterRequests, ['https://posters.example.test/broken.jpg'])
    assert.equal(await cards.nth(0).locator('img').count(), 0)
    assert.equal(await cards.nth(1).locator('img').count(), 0)
    const links = await cards.locator('a').evaluateAll(items => items.map(item => ({ href: item.href, rel: item.rel })))
    assert.ok(links.every(link => new URL(link.href).searchParams.get('utm_source') === 'poruch' && link.rel.includes('noopener')))
    if (width === 360) for (const card of await cards.all()) assert.equal(Math.round((await card.boundingBox()).height), 236)
    await layout(page, `ingested-events-${width}`)
    checks.push({ width, externalCards: 3, participationButtons: 0, partnerLinks: true, sourceImages: 'consent, loaded and failed verified', disabledPosterRequests: 0 })
    await context.close()
  }
  await fs.writeFile(`${outDir}/${process.env.CHECK_INGEST_ONLY ? 'ingest-result' : 'result'}.json`, JSON.stringify(checks, null, 2))
  console.log(JSON.stringify(checks, null, 2))
} finally {
  if (browser) await browser.close()
  server.kill()
}
