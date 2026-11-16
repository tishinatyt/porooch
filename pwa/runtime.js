// Imported by the generated worker. The build plugin replaces this token.
const PORUCH_VERSION = '__PORUCH_BUILD_ID__'
const htmlCache = 'poruch-html-v1'
const entry = new URL('index.html', self.registration.scope)
const freshEntry = new URL(entry)
freshEntry.searchParams.set('__poruch_build', PORUCH_VERSION)

async function freshHtml() {
  const response = await fetch(freshEntry, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('html_unavailable')
  try {
    const cache = await caches.open(htmlCache)
    await cache.put(entry, response.clone())
  } catch { /* A denied/full cache must not hide fresh online HTML. */ }
  return response
}

// A worker cannot activate with new assets but an unavailable HTML shell.
self.addEventListener('install', event => event.waitUntil(freshHtml()))
self.addEventListener('message', event => {
  if (event.data?.type === 'PORUCH_GET_VERSION') event.ports[0]?.postMessage({ version: PORUCH_VERSION })
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const scope = new URL(self.registration.scope)
  const documentPath = !/\.[a-z0-9]{1,8}$/i.test(url.pathname) || /\.html$/i.test(url.pathname)
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || !documentPath) return
  event.respondWith(freshHtml().catch(async () => {
    const cached = await (await caches.open(htmlCache)).match(entry)
    if (cached) return cached
    return new Response('Немає з’єднання. Спробуйте ще раз.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }))
})
