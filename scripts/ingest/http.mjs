import https from 'node:https'
import dns from 'node:dns'
import { isIP } from 'node:net'
import { parseRobots } from './robots.mjs'
export const USER_AGENT = 'PoruchBot (+https://poruch.fun)'
export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19].includes(b)))
  }
  // Conservative IPv6 global-unicast only; reject IPv4-mapped/private/link-local addresses.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address)
}
export function request(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443')) return reject(new Error('unsafe_url'))
    if (isIP(target.hostname.replace(/^\[|\]$/g, '')) && !publicAddress(target.hostname.replace(/^\[|\]$/g, ''))) return reject(new Error('unsafe_address'))
    const req = https.get(target, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/ld+json,text/plain;q=0.9' }, lookup(host, options, callback) {
      dns.lookup(host, { all: true }, (error, addresses) => {
        if (error) return callback(error)
        const safe = addresses.filter(item => publicAddress(item.address))
        if (!safe.length || safe.length !== addresses.length) return callback(new Error('unsafe_address'))
        if (options.all) callback(null, safe); else callback(null, safe[0].address, safe[0].family)
      })
    } }, response => {
      const chunks = []; let bytes = 0
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 5 * 1024 * 1024) response.destroy(new Error('response_too_large')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.setTimeout(15000, () => req.destroy(new Error('request_timeout'))); req.on('error', reject)
  })
}
export function createCrawler({ transport = request, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const cache = new Map(); let last = -Infinity, delay = 2000, queue = Promise.resolve()
  async function spaced(url) {
    const wait = last + delay - now(); if (wait > 0) await sleep(wait)
    last = now()
    try { return await transport(url) } finally { last = now() }
  }
  async function rules(origin) {
    if (cache.has(origin)) return cache.get(origin)
    let url = `${origin}/robots.txt`, response
    for (let i = 0; i < 6; i++) {
      response = await spaced(url)
      if (response.status >= 300 && response.status < 400 && response.location) { url = new URL(response.location, url).href; continue }
      break
    }
    if (!response || !([200, 404, 410].includes(response.status))) throw new Error('robots_unavailable')
    const parsed = parseRobots(response.status === 200 ? response.text : '')
    delay = Math.max(delay, parsed.delayMs); cache.set(origin, parsed); return parsed
  }
  async function inspect(url, fetchPage) {
    let current = new URL(url).href
    for (let i = 0; i < 6; i++) {
      const target = new URL(current)
      if (target.protocol !== 'https:' || target.username || target.password) throw new Error('unsafe_url')
      const policy = await rules(target.origin)
      if (!policy.allowed(current)) return { allowed: false, url: current, text: '', reason: 'robots_disallow' }
      if (!fetchPage) return { allowed: true, url: current }
      const response = await spaced(current)
      if (response.status >= 300 && response.status < 400 && response.location) { current = new URL(response.location, current).href; continue }
      if (response.status !== 200) throw new Error(`http_${response.status}`)
      return { allowed: true, url: current, text: response.text }
    }
    throw new Error('redirect_limit')
  }
  return { get(url, fetchPage = true) {
    const result = queue.then(() => inspect(url, fetchPage)); queue = result.catch(() => {}); return result
  } }
}
