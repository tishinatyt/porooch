const reloadKey = 'poruch:pwa:last-reload-version'
const versionPattern = /^[a-zA-Z0-9_-]{1,80}$/

function workerVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise(resolve => {
    const channel = new MessageChannel()
    const finish = (version: string | null) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(version) }
    const timer = setTimeout(() => finish(null), 1500)
    channel.port1.onmessage = event => finish(typeof event.data?.version === 'string' && versionPattern.test(event.data.version) ? event.data.version : null)
    try { worker.postMessage({ type: 'PORUCH_GET_VERSION' }, [channel.port2]) } catch { finish(null) }
  })
}

export function shouldReload(build: string, worker: string | null, lastReload: string | null, historyReload: string | null = null) {
  return Boolean(worker && worker !== build && worker !== lastReload && worker !== historyReload)
}

// Native registration avoids a second reload listener in virtual:pwa-register.
export async function registerPwaUpdates(buildId: string, base = '/') {
  if (!('serviceWorker' in navigator)) return () => {}
  const container = navigator.serviceWorker
  const scope = new URL(base, window.location.origin)
  let previous = container.controller, reloading = false, disposed = false, checking = false
  let registration: ServiceWorkerRegistration | undefined
  async function reconcile(changed = false) {
    const controller = container.controller
    if (!controller) return
    const version = await workerVersion(controller) ?? (changed ? `legacy-${buildId}` : null)
    if (disposed || container.controller !== controller || reloading) return
    let last: string | null = null, historyReload: string | null = null
    try { last = sessionStorage.getItem(reloadKey) } catch { /* Private mode can deny storage. */ }
    try { historyReload = window.history.state?.poruchReloadVersion ?? null } catch { /* Guard below requires at least one persistent store. */ }
    if (!shouldReload(buildId, version, last, historyReload)) return
    let persisted = false
    try { sessionStorage.setItem(reloadKey, version!); persisted = true } catch { /* History is a same-tab fallback. */ }
    try { window.history.replaceState({ ...window.history.state, poruchReloadVersion: version }, '', window.location.href); persisted = true } catch { /* Never risk a reload loop if both stores are denied. */ }
    if (!persisted) return
    reloading = true
    window.location.reload()
  }
  const onController = () => {
    const changed = Boolean(previous && previous !== container.controller)
    previous = container.controller
    void reconcile(changed)
  }
  container.addEventListener('controllerchange', onController)
  void reconcile()
  async function check() {
    if (checking || disposed || !navigator.onLine || document.visibilityState === 'hidden') return
    checking = true
    try {
      // The nonce bypasses the hosting CDN's ten-minute freshness window.
      const marker = new URL('version.json', scope); marker.searchParams.set('t', String(Date.now()))
      const response = await fetch(marker, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('version_unavailable')
      const { version } = await response.json()
      if (typeof version !== 'string' || !versionPattern.test(version)) throw new Error('invalid_version')
      if (disposed) return
      const url = new URL('sw.js', scope); url.searchParams.set('version', version)
      registration = await container.register(url.href, { scope: scope.pathname, updateViaCache: 'none' })
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      await registration.update()
      void reconcile()
    } catch {
      // Offline/older deployments without a marker still use the standard update algorithm.
      if (!disposed) await registration?.update().catch(() => {})
    } finally { checking = false }
  }
  const onVisible = () => { if (document.visibilityState === 'visible') void check() }
  window.addEventListener('online', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(() => void check(), 60000)
  const dispose = () => { disposed = true; clearInterval(timer); container.removeEventListener('controllerchange', onController); window.removeEventListener('online', onVisible); document.removeEventListener('visibilitychange', onVisible) }
  try {
    const url = new URL('sw.js', scope); url.searchParams.set('version', buildId)
    registration = await container.register(url.href, { scope: scope.pathname, updateViaCache: 'none' })
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    void check()
  } catch { console.error('Service worker registration failed') }
  return dispose
}
