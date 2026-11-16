// RFC 9309: combine equally specific UA groups; longest matching path wins, Allow wins ties.
function pathOctets(path) {
  return encodeURI(path).replace(/%25([0-9a-f]{2})/gi, '%$1').replace(/%([0-9a-f]{2})/gi, (_, hex) => {
    const char = String.fromCharCode(parseInt(hex, 16)); return /[A-Za-z0-9._~-]/.test(char) ? char : `%${hex.toUpperCase()}`
  })
}
export function parseRobots(text, agent = 'PoruchBot') {
  const groups = []; let group = null, rulesStarted = false
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/)
    if (!match) continue
    const name = match[1].toLowerCase(), value = match[2]
    if (name === 'user-agent') {
      if (!value) continue
      if (!group || rulesStarted) { group = { agents: [], rules: [], delay: 2 }; groups.push(group); rulesStarted = false }
      group.agents.push(value.toLowerCase())
    } else if (group) {
      if (['allow', 'disallow'].includes(name)) { rulesStarted = true; if (value && value.startsWith('/')) group.rules.push({ allow: name === 'allow', path: value }) }
      if (name === 'crawl-delay') { rulesStarted = true; if (Number.isFinite(+value)) group.delay = Math.max(2, +value) }
    }
  }
  const score = group => Math.max(-1, ...group.agents.map(ua => ua === '*' ? 0 : agent.toLowerCase().includes(ua) ? ua.length : -1))
  const best = Math.max(-1, ...groups.map(score)), selected = groups.filter(g => score(g) === best && best >= 0)
  return { delayMs: Math.max(2, ...selected.map(g => g.delay)) * 1000, allowed(url) {
    const target = pathOctets(new URL(url).pathname + new URL(url).search)
    let winner = { length: -1, allow: true }
    for (const rule of selected.flatMap(g => g.rules)) {
      const path = pathOctets(rule.path), end = path.endsWith('$')
      const escaped = (end ? path.slice(0, -1) : path).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
      const length = Buffer.byteLength(path.replace(/\*/g, '').replace(/\$$/, ''))
      if (new RegExp(`^${escaped}${end ? '$' : ''}`).test(target) && (length > winner.length || (length === winner.length && rule.allow))) winner = { length, allow: rule.allow }
    }
    return winner.allow
  } }
}
