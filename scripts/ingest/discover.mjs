import { createCrawler } from './http.mjs'
import { parseSchemaEvents } from './normalize.mjs'
export async function discover(urls, crawler = createCrawler()) {
  const results = []
  for (const url of urls) {
    try {
      const page = await crawler.get(url)
      const stats = {}
      const events = page.allowed ? parseSchemaEvents(page.text, { url: page.url, city: 'Не вказано', default_category: 'other' }, stats).filter(event => event.title && (event.place || event.address)) : []
      results.push({ url, allowed: page.allowed, eventMarkup: (stats.markupCount ?? 0) > 0, markupEvents: stats.markupCount ?? 0, events: events.length, reason: page.reason ?? null })
    } catch (error) { results.push({ url, allowed: null, eventMarkup: false, events: 0, reason: /^[a-z_0-9]+$/.test(error.message) ? error.message : 'request_failed' }) }
  }
  return results
}
if (process.argv[1] && new URL(import.meta.url).pathname.replace(/^\//, '').toLowerCase() === process.argv[1].replaceAll('\\', '/').replace(/^\//, '').toLowerCase()) {
  if (!process.argv.slice(2).length) { console.error('Usage: node scripts/ingest/discover.mjs https://example.org/events [...]'); process.exitCode = 1 }
  else console.log(JSON.stringify(await discover(process.argv.slice(2)), null, 2))
}
