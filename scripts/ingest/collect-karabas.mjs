import fs from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { createCrawler } from './http.mjs'
import { discover } from './discover.mjs'

export const targetCities = ['Київ','Львів','Харків','Одеса','Дніпро','Запоріжжя','Вінниця','Полтава','Черкаси','Суми','Житомир','Рівне','Луцьк','Тернопіль','Івано-Франківськ','Ужгород','Чернівці','Хмельницький','Кропивницький','Миколаїв','Чернігів']
const categoryFor = label => /^(Концерти|Музика|Фестивалі)$/i.test(label) ? 'music' : /^(Театри|Театр|Stand-up|Стендап)$/i.test(label) ? 'theatre' : /^(Дітям|Детям)$/i.test(label) ? 'other' : /^Спорт$/i.test(label) ? 'sport' : /^Екскурсії$/i.test(label) ? 'walk' : /^(Кіно)$/i.test(label) ? 'cinema' : /^(Виставки|Музеї)$/i.test(label) ? 'art' : null
export function cleanKarabasCatalogue(rows) {
  const seen = new Set()
  return rows.filter(row => {
    if (row.valid_events <= 0 || (row.section !== 'Усі події' && !categoryFor(row.section))) return false
    const url = new URL(row.url), key = `${row.city}:${url.origin}${url.pathname.replace(/\/+$/,'')}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
function anchors(html, base, selector = 'a[href]') {
  const dom = new JSDOM(html)
  const result = [...dom.window.document.querySelectorAll(selector)].flatMap(a => {
    try { const url = new URL(a.getAttribute('href'), base); return url.protocol === 'https:' && (url.hostname === 'karabas.com' || url.hostname.endsWith('.karabas.com')) ? [{ label: a.textContent.replace(/\s+/g,' ').trim(), url: url.href }] : [] } catch { return [] }
  })
  dom.window.close(); return result
}
export async function collectKarabas(crawler = createCrawler()) {
  const seed = 'https://chernihiv.karabas.com/concerts/' // User-supplied, not a synthesized city path.
  const pages = new Map(), proof = [], results = [], attempts = []
  const get = async url => { if (!pages.has(url)) pages.set(url, await crawler.get(url)); return pages.get(url) }
  const initial = await get(seed)
  if (!initial.allowed) throw Error('seed_disallowed')
  const links = anchors(initial.text, initial.url), cities = new Map()
  for (const city of targetCities) {
    const found = links.find(link => link.label.replace(/\s*\(Україна\)$/, '') === city)
    if (found) { cities.set(city, found.url); proof.push({ city, url: found.url, linkedFrom: seed, label: found.label }) }
  }
  for (const city of targetCities) {
    const cityUrl = cities.get(city)
    if (!cityUrl) { attempts.push({ city, reason: 'city_link_not_found' }); continue }
    try {
      const home = await get(cityUrl)
      if (!home.allowed) { attempts.push({ city, url: cityUrl, reason: home.reason }); continue }
      const candidates = [{ label: 'Усі події', url: home.url, category: 'other' }]
      for (const link of anchors(home.text, home.url, 'header a[href], nav a[href]')) {
        const category = categoryFor(link.label)
        if (category && new URL(link.url).hostname === new URL(home.url).hostname && !candidates.some(item => new URL(item.url).pathname === new URL(link.url).pathname)) candidates.push({ ...link, category })
      }
      for (const page of candidates) {
        // Reuse the same fetched snapshot for menu discovery and the existing discover utility.
        const [checked] = await discover([page.url], { get })
        attempts.push({ city, section: page.label, url: page.url, ...checked })
        if (checked.allowed && checked.events > 0) results.push({ city, section: page.label, url: page.url, default_category: page.category, valid_events: checked.events })
        proof.push({ city, section: page.label, url: page.url, linkedFrom: cityUrl, label: page.label })
        console.log(JSON.stringify({ city, section: page.label, events: checked.events, reason: checked.reason }))
      }
    } catch { attempts.push({ city, url: cityUrl, reason: 'city_request_failed' }) }
  }
  await fs.mkdir('docs/sources', { recursive: true }); await fs.mkdir('qa-artifacts/karabas', { recursive: true })
  const catalogue = cleanKarabasCatalogue(results)
  await fs.writeFile('docs/sources/karabas-sources.json', JSON.stringify(catalogue, null, 2) + '\n')
  await fs.writeFile('qa-artifacts/karabas/discovery-proof.json', JSON.stringify({ checked_at: new Date().toISOString(), proof, attempts }, null, 2))
  console.log(JSON.stringify({ pages: catalogue.length, cities: Object.fromEntries(targetCities.map(city => [city, catalogue.filter(row => row.city === city).length])) }, null, 2))
  return catalogue
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/collect-karabas.mjs')) await collectKarabas()
