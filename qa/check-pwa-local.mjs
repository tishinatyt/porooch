// Two real production builds, one origin and an intentionally stale HTTP cache. No external network.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const output = path.resolve('qa-artifacts/pwa-local')
await fs.mkdir(output, { recursive: true })
async function build(version) {
  const dir = path.join(output, version)
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', dir], {
      windowsHide: true, env: { ...process.env, PWA_BUILD_ID: version, VITE_SUPABASE_URL: 'https://offline.supabase.invalid', VITE_SUPABASE_ANON_KEY: 'offline-fixture', VITE_GA_MEASUREMENT_ID: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let log = ''; child.stdout.on('data', data => { log += data }); child.stderr.on('data', data => { log += data })
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(log)))
  })
  return dir
}
const dirs = { a: await build('qa-a'), b: await build('qa-b') }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright')
let active = 'a', browser
const cache = new Map(), requests = []
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  requests.push(url.pathname + url.search)
  const key = req.url
  if (!cache.has(key)) {
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
    const file = path.resolve(dirs[active], relative)
    if (!file.startsWith(dirs[active] + path.sep)) { res.writeHead(403).end(); return }
    try { cache.set(key, { body: await fs.readFile(file), type: types[path.extname(file)] ?? 'application/octet-stream' }) }
    catch { res.writeHead(404).end(); return }
  }
  const entry = cache.get(key)
  res.writeHead(200, { 'Content-Type': entry.type, 'Cache-Control': 'public, max-age=600' }); res.end(entry.body)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
async function workerVersion(page) {
  return page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => resolve(null), 2000)
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data.version) }
    navigator.serviceWorker.controller?.postMessage({ type: 'PORUCH_GET_VERSION' }, [channel.port2])
  }))
}
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext()
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  const page = await context.newPage(); let navigations = 0
  page.on('domcontentloaded', () => { navigations++ })
  await page.goto(base)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  assert.equal(await workerVersion(page), 'qa-a')
  await page.waitForTimeout(1800)
  assert.equal(navigations, 1, 'first installation must not reload')
  // Cache keys for unversioned HTML/SW deliberately keep A after deployment B.
  await fetch(`${base}/index.html`); await fetch(`${base}/sw.js`)
  active = 'b'
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForFunction(() => document.querySelector('meta[name="poruch-build"]')?.content === 'qa-b', null, { timeout: 30000 })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  assert.equal(await workerVersion(page), 'qa-b')
  await page.waitForLoadState('domcontentloaded')
  assert.equal(navigations, 2, 'deployment must cause exactly one reload')
  await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')) } })
  await page.waitForTimeout(2000)
  assert.equal(navigations, 2, 'same version must not reload again')
  assert.ok(requests.includes('/sw.js?version=qa-b'))
  assert.ok(requests.includes('/index.html?__poruch_build=qa-b'))
  assert.equal(cache.get('/index.html').body.toString().includes('content="qa-a"'), true, 'test really retains stale unversioned HTML')
  await context.setOffline(true)
  await page.reload()
  await page.waitForSelector('#root > *')
  assert.equal(await page.locator('meta[name="poruch-build"]').getAttribute('content'), 'qa-b')
  assert.equal(await workerVersion(page), 'qa-b')
  await page.screenshot({ path: path.join(output, 'offline-b.png') })
  const result = { browser: await browser.version(), firstInstallReloads: 0, updateReloads: 1, repeatReloads: 0, freshHtmlDespiteStaleHttpCache: true, offlineVersion: 'qa-b' }
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2))
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
