// Local Chrome QA with browser-native CDP; no additional npm dependencies.
// Run with the Vite server on 127.0.0.1:5173. Auth/data are mocked in the browser.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const out = path.resolve('dist/home-qa')
fs.mkdirSync(out, { recursive: true })
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${out}/chrome-profile`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws
try {
  let target
  for (let i = 0; i < 100; i++) {
    try { target = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json(); break } catch { await pause(200) }
  }
  assert.ok(target, 'Chrome remote debugging must start')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let nextId = 0
  const pending = new Map()
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const authModule = `export function AuthProvider({children}) { return children }
    export function useAuth() {
      const loggedIn = sessionStorage.getItem('qa:auth') === 'yes';
      const user = loggedIn ? {id:'qa-user',user_metadata:{}} : null;
      return {session: loggedIn ? {user} : null, supaUser:user, loading:false,
        profile:loggedIn ? {id:'qa-user',name:'QA',city:'Київ',avatar_url:'/favicon.svg',interests:['Кава','Кіно']} : null,
        signInWithGoogle:async()=>{}, signInAnonymously:async()=>({id:'qa-user'}), refreshProfile:async()=>{}}
    }`
  const dataModule = `const result={data:[],error:null}; function chain(){const q={then:(resolve)=>Promise.resolve(result).then(resolve)};for(const k of ['select','eq','neq','in','or','order','limit','on','subscribe','maybeSingle'])q[k]=()=>q;return q}
    export const supabase={from:()=>chain(),rpc:async(name)=>({data:name==='poruch_is_admin'?false:[],error:null}),channel:()=>chain(),removeChannel:()=>{},auth:{updateUser:async()=>({error:null})}};`
  ws.onmessage = async ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const call = pending.get(message.id)
      if (!call) return
      pending.delete(message.id)
      if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result)
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params
      const body = request.url.includes('/src/contexts/AuthContext.tsx') ? authModule : dataModule
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{name:'Content-Type',value:'application/javascript'}], body: Buffer.from(body).toString('base64') })
    }
  }
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await send('Page.enable')
  await send('Fetch.enable', { patterns: [{urlPattern:'*/src/contexts/AuthContext.tsx*'}, {urlPattern:'*/src/lib/supabase.ts*'}] })
  const results = []
  for (const [width,height] of [[360,640],[360,800],[1440,900]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 360 })
    for (const mode of ['guest','home']) {
      await send('Page.navigate', { url:'http://127.0.0.1:5173/' })
      await pause(400)
      await evaluate(`sessionStorage.setItem('qa:auth', '${mode === 'home' ? 'yes' : 'no'}')`)
      await send('Page.reload', { ignoreCache: true })
      const selector = mode === 'guest' ? '.landing-hero-actions' : '.organizer-banner'
      let ready = false
      for(let i=0;i<100;i++) { if(await evaluate(`!!document.querySelector('${selector}')`)) {ready=true;break} await pause(100) }
      assert.ok(ready, `${mode} should render`)
      await evaluate('document.fonts.ready')
      await pause(200)
      const metrics = await evaluate(`(() => {
        const box = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
        return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
          ${mode==='guest' ? "title:box('.landing-hero h1'),message:box('.landing-hero-organizer'),actions:box('.landing-hero-actions'),hero:box('.landing-hero'),organizerFollowsHero:document.querySelector('.landing-hero').nextElementSibling.classList.contains('organizer-section')" : "banner:box('.organizer-banner'),feed:box('[data-home-carousel]'),cta:document.querySelector('.organizer-banner a').getAttribute('href'),bottomOrganizer:!!document.querySelector('.organizer-section')"}}
      })()`)
      assert.equal(metrics.overflow,false,`${mode} horizontal overflow`)
      const descriptions = await evaluate(`[...document.querySelectorAll('meta[name="description"],meta[property="og:description"]')].map(el=>el.content)`)
      assert.equal(descriptions.length,2)
      for(const text of descriptions) {
        assert.ok(text.length<=155)
        assert.equal(text,'Знаходь події та людей поруч. Створюй свої події та продавай на них квитки разом з Poruch.fun.')
      }
      if (mode==='guest') {
        assert.equal(await evaluate(`document.querySelector('.landing-hero h1').textContent`),'Poruch — миттєві зустрічі зі своїми!')
        assert.equal(await evaluate(`document.querySelector('.landing-hero-organizer').textContent`),'Створюй свої події та продавай на них квитки разом з Poruch.fun')
        assert.ok(metrics.title.top>=0 && metrics.message.bottom<=height && metrics.actions.bottom<=height, 'Both messages and actions must be above the fold')
        assert.equal(metrics.organizerFollowsHero,true)
        const actions = await evaluate(`[...document.querySelectorAll('.landing-hero-action')].map(el=>({text:el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))`)
        assert.deepEqual(actions.map(a=>a.text),['Знайти подію','Створити подію'])
        assert.ok(Math.abs(actions[0].width-actions[1].width)<0.5, 'Equal-width grid buttons, allowing subpixel rounding')
        assert.equal(actions[0].height,actions[1].height)
      } else {
        if(width===360) assert.ok(metrics.banner.height<=80,`Mobile banner is ${metrics.banner.height}px`)
        assert.ok(metrics.feed.top>=metrics.banner.bottom,'Banner must precede rather than cover the feed')
        assert.equal(metrics.cta,'/create'); assert.equal(metrics.bottomOrganizer,true)
      }
      const screenshot = await send('Page.captureScreenshot', { format:'png' })
      fs.writeFileSync(`${out}/${mode}-${width}x${height}.png`,Buffer.from(screenshot.data,'base64'))
      results.push({ mode, ...metrics })
      console.log(JSON.stringify(results.at(-1)))
      if(mode==='guest') {
        await evaluate(`document.querySelector('.landing-hero-actions a').click()`)
        await pause(100)
        assert.equal(await evaluate('location.pathname'),'/create')
        assert.equal(await evaluate('document.querySelector("h1").textContent'),'Увійди, щоб створити подію')
        await send('Page.navigate', { url:'http://127.0.0.1:5173/' })
        for(let i=0;i<100;i++) {if(await evaluate(`!!document.querySelector('.landing-hero-actions button')`)) break; await pause(100)}
        await evaluate(`document.querySelector('.landing-hero-actions button').click()`)
        await pause(100)
        assert.equal(await evaluate('document.querySelector("h1").textContent'),'Знайомства та події поруч')
      }
    }
  }
  fs.writeFileSync(`${out}/metrics.json`,JSON.stringify(results,null,2))
} finally { ws?.close(); chrome.kill() }
