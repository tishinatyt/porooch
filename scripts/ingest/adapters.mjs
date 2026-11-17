import { parseSchemaEvents } from './normalize.mjs'
import { enrichVenue } from './enrich.mjs'
export const adapters = new Map([
  ['schema_org', async (source, crawler) => {
    const page = await crawler.get(source.url)
    if (!page.allowed) throw new Error('robots_disallow')
    const rows = parseSchemaEvents(page.text, { ...source, url: page.url })
    // Bound listing enrichment so one section cannot exhaust the source deadline.
    let remaining = 3
    for (let i = 0; i < rows.length && remaining > 0; i++) if (!rows[i].place && !rows[i].address) {
      remaining--; rows[i] = await enrichVenue(rows[i], crawler)
    }
    return rows
  }],
])
// Future adapters register here and receive the same robots-aware, rate-limited crawler.
export function registerAdapter(type, adapter) { adapters.set(type, adapter) }
