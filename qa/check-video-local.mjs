import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const base = 'http://127.0.0.1:4181'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4181','--strictPort'], { windowsHide: true, stdio: 'ignore' })
let browser
try {
  for (let i=0;;i++) { try { if ((await fetch(base)).ok) break } catch {} if(i>150) throw Error('Vite startup failed'); await new Promise(r=>setTimeout(r,100)) }
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  await page.route(base + '/qa-video', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto(base + '/qa-video')
  await page.evaluate(() => { document.body.innerHTML = '<button id="run">Run local recording check</button>' })
  const results = []
  for (const webm of [false, true]) {
    await page.evaluate(async webm => {
      const lib = await import('/src/lib/videoInviteProcessing.ts')
      window.result = null
      document.querySelector('#run').onclick = async () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width=1280; canvas.height=720
          const ctx=canvas.getContext('2d'); let frame=0
          const timer=setInterval(()=>{ctx.fillStyle=`hsl(${frame++*3} 70% 50%)`;ctx.fillRect(0,0,1280,720)},40)
          const audio=new AudioContext(); await audio.resume(); const osc=audio.createOscillator(), dest=audio.createMediaStreamDestination();osc.connect(dest);osc.start()
          const stream=canvas.captureStream(24);dest.stream.getTracks().forEach(t=>stream.addTrack(t))
          const mime=webm ? 'video/webm;codecs=vp8,opus' : lib.recorderType(t=>MediaRecorder.isTypeSupported(t))
          const rec=new MediaRecorder(stream,{mimeType:mime}), chunks=[]
          rec.ondataavailable=e=>chunks.push(e.data)
          const done=new Promise(r=>rec.onstop=r); rec.start(200); await new Promise(r=>setTimeout(r,11200));rec.stop();await done
          clearInterval(timer);stream.getTracks().forEach(t=>t.stop());osc.stop();await audio.close()
          const file=new File(chunks,'fixture.'+(webm?'webm':'mp4'),{type:mime})
          const input=await lib.inspectVideo(file)
          const original = MediaRecorder.isTypeSupported.bind(MediaRecorder); if(webm) MediaRecorder.isTypeSupported = mime => mime.startsWith('video/webm') && original(mime)
          const progress=[]; const output=await lib.processVideoInvite(file,0.5,1,p=>progress.push(p),new AbortController().signal)
          const metadata=await lib.inspectVideo(new File([output.blob],'output.'+output.extension,{type:output.blob.type}))
          const decoder=new AudioContext();const decoded=await decoder.decodeAudioData(await output.blob.arrayBuffer());const samples=decoded.getChannelData(0);const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);await decoder.close()
          window.result={audioRms:rms,input,metadata,bytes:output.blob.size,poster:output.poster.type,durationMs:output.durationMs,extension:output.extension,progress}
        } catch(e) {window.result={error:e.message,stack:e.stack}}
      }
    }, webm)
    await page.click('#run')
    await page.waitForFunction(()=>window.result != null,{},{timeout:65000})
    const result=await page.evaluate(()=>window.result)
    assert.ok(!result.error,JSON.stringify(result)); assert.ok(result.input.duration>10);assert.ok(result.durationMs<=10000);assert.ok(result.metadata.width<=720);assert.ok(result.metadata.height<=720);assert.ok(result.bytes<=8*1024**2);assert.ok(result.audioRms>0.01);assert.equal(result.poster,'image/jpeg');assert.equal(result.progress.at(-1),100)
    results.push({webmSource:webm,...result,progress:[result.progress[0],result.progress.at(-1)]})
  }
  await fs.mkdir('qa-artifacts/video-invite',{recursive:true})
  await fs.writeFile('qa-artifacts/video-invite/processing.json',JSON.stringify({browser:await browser.version(),results},null,2))
  console.log(JSON.stringify(results,null,2))
} finally { await browser?.close();server.kill() }
