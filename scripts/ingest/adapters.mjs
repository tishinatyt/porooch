import { parseSchemaEvents } from './normalize.mjs'
export const adapters = new Map([
  ['schema_org', async (source, crawler) => {
    const page = await crawler.get(source.url)
    if (!page.allowed) throw new Error('robots_disallow')
    return parseSchemaEvents(page.text, { ...source, url: page.url })
  }],
])
// Future adapters register here and receive the same robots-aware, rate-limited crawler.
export function registerAdapter(type, adapter) { adapters.set(type, adapter) }
