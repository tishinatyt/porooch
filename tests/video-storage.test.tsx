import test, { mock, after } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
const dom = new JSDOM('<!doctype html><div id="app"></div>',{url:'http://localhost'})
for (const key of ['window','document','navigator','HTMLElement','Event','MouseEvent']) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true})
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true})
let uploads=0, failRpc=true, signs:string[]=[], removals:string[][]=[]
const rpcCalls:any[]=[]
mock.module('../src/lib/supabase.ts',{namedExports:{supabase:{
 storage:{from:()=>({
  createSignedUrl:async(path:string,expiry:number)=>{assert.equal(expiry,60); signs.push(path);return {data:{signedUrl:`https://fixture.invalid/${path}`}}},
  createSignedUploadUrl:async(path:string)=>({data:{signedUrl:`https://fixture.invalid/${path}`}}),
  remove:async(paths:string[])=>{removals.push(paths);return {error:null}},
 })},
 rpc:async(name:string,args:any)=>{rpcCalls.push({name,args});return {data:{video_path:args.p_path,video_poster_path:args.p_poster},error:failRpc?{message:'offline'}:null}},
}}})
Object.defineProperty(globalThis,'XMLHttpRequest',{configurable:true,value:class {
 status=200;responseText='';upload={onprogress:null};onload:any
 open(){}setRequestHeader(){}send(){uploads++;queueMicrotask(()=>this.onload())}
}})
const {saveEventVideo,removeEventVideo}=await import('../src/lib/eventVideo.ts')
const {default:Player}=await import('../src/components/video/VideoInvitePlayer.tsx')
const {createRoot}=await import('react-dom/client')
after(()=>dom.window.close())
test('upload retry reuses the same UUID/files and only replaces the previous pair after successful attach',async()=>{
 const prepared={blob:new Blob(['video'],{type:'video/mp4'}),poster:new Blob(['jpg'],{type:'image/jpeg'}),durationMs:9990,extension:'mp4' as const}
 const old={video_path:'event/old.mp4',video_poster_path:'event/old.jpg'}
 await assert.rejects(saveEventVideo('event',prepared,old,()=>{}))
 assert.equal(uploads,2);assert.equal(removals.length,0)
 failRpc=false;const fields=await saveEventVideo('event',prepared,old,()=>{})
 assert.equal(uploads,2);assert.equal(rpcCalls[0].args.p_path,rpcCalls[1].args.p_path)
 assert.equal(rpcCalls[1].args.p_expected_path,old.video_path);assert.deepEqual(removals,[['event/old.mp4','event/old.jpg']])
 await removeEventVideo('event',fields)
 assert.equal(rpcCalls.at(-1).name,'poruch_remove_event_video')
 assert.equal(rpcCalls.at(-1).args.p_expected_path,fields.video_path)
})
test('feed player signs only poster until clicked; video is a portal with no autoplay and preload none',async()=>{
 signs=[];const root=createRoot(document.getElementById('app')!)
 await act(async()=>root.render(<Player compact fields={{video_path:'event/video.mp4',video_poster_path:'event/video.jpg'}} />))
 assert.deepEqual(signs,['event/video.jpg']);assert.equal(document.querySelector('video'),null)
 await act(async()=>document.querySelector<HTMLButtonElement>('#app button')!.click())
 assert.deepEqual(signs,['event/video.jpg','event/video.mp4'])
 const video=document.querySelector('video')!;assert.equal(video.preload,'none');assert.equal(video.autoplay,false);assert.equal(video.controls,true);assert.equal(video.muted,false)
 assert.equal(document.querySelector('#app [role="dialog"]'),null)
 await act(async()=>document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click())
 assert.equal(document.querySelector('video'),null)
 await act(async()=>root.unmount())
})
