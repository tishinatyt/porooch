import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement']) Object.defineProperty(globalThis, key, { value: dom.window[key as keyof typeof dom.window], configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createRoot } = await import('react-dom/client')
const { default: HomeCarousel } = await import('../src/components/home/HomeCarousel.tsx')
const container = document.getElementById('app')!
let root: ReturnType<typeof createRoot>
async function render(resetKey: string, ids: string[]) {
  await act(async () => {
    root.render(<HomeCarousel id="rail" label="Fixture events" resetKey={resetKey}>{ids.map(id => <div key={id} role="listitem">{id}</div>)}</HomeCarousel>)
  })
  await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)) })
}
after(() => dom.window.close())

test('initial authoritative data resets the demo rail before paint and preserves forward array order', async () => {
  root = createRoot(container)
  try {
    await render('pending', ['demo'])
    const rail = document.getElementById('rail')!
    rail.scrollLeft = 250
    await render('loaded', ['first', 'second', 'demo'])
    assert.equal(rail.scrollLeft, 0)
    assert.equal(rail.getAttribute('dir'), 'ltr')
    assert.deepEqual([...rail.children].map(item => item.textContent), ['first', 'second', 'demo'])
  } finally { await act(async () => root.unmount()) }
})

test('new category resets scroll while appended pages and same-category updates preserve position', async () => {
  root = createRoot(container)
  try {
    await render('cinema', ['one', 'two'])
    const rail = document.getElementById('rail')!
    rail.scrollLeft = 200
    await render('cinema', ['one', 'two', 'three'])
    assert.equal(rail.scrollLeft, 200)
    await render('theatre', ['new-first', 'new-second'])
    assert.equal(rail.scrollLeft, 0)
  } finally { await act(async () => root.unmount()) }
})
