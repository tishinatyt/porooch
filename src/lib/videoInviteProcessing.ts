import { videoText as t } from './videoInviteText'

export const VIDEO_MAX_MS = 10_000
export const VIDEO_TARGET_BYTES = 4 * 1024 * 1024
export const VIDEO_MAX_BYTES = 8 * 1024 * 1024
export interface PreparedVideo { blob: Blob; poster: Blob; durationMs: number; extension: 'mp4' | 'webm' }

export function validateVideoDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 1 || ms > VIDEO_MAX_MS) throw new Error(t.duration)
}
export function validateVideoSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error(t.empty)
  if (bytes > VIDEO_MAX_BYTES) throw new Error(t.size)
}
export function videoDimensions(width: number, height: number) {
  if (!(width > 0 && height > 0)) throw new Error(t.decode)
  const ratio = Math.min(1, 720 / Math.max(width, height))
  return { width: Math.max(2, Math.floor(width * ratio / 2) * 2), height: Math.max(2, Math.floor(height * ratio / 2) * 2) }
}
export function recorderType(supported: (mime: string) => boolean) {
  return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(supported) ?? null
}
function mediaEvent(video: HTMLVideoElement, event: string, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => done(new Error(t.decode)), 20_000)
    const success = () => done(), fail = () => done(new Error(t.decode)), abort = () => done(new DOMException('Aborted', 'AbortError'))
    function done(error?: Error) {
      clearTimeout(timer); video.removeEventListener(event, success); video.removeEventListener('error', fail); signal?.removeEventListener('abort', abort)
      if (error) reject(error); else resolve()
    }
    video.addEventListener(event, success, { once: true }); video.addEventListener('error', fail, { once: true }); signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal) {
  if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.01) return
  const ready = mediaEvent(video, 'seeked', signal); video.currentTime = time; await ready
}
export async function inspectVideo(file: File) {
  if (!file.type.startsWith('video/')) throw new Error(t.type)
  if (!file.size) throw new Error(t.empty)
  const url = URL.createObjectURL(file), video = document.createElement('video')
  video.preload = 'metadata'; video.playsInline = true
  try {
    const loaded = mediaEvent(video, 'loadedmetadata'); video.src = url; await loaded
    // MediaRecorder-created WebM may not have a finite duration until a seek.
    if (video.duration === Infinity) { const ready = mediaEvent(video, 'durationchange'); video.currentTime = 1e10; await ready }
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error(t.decode)
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url) }
}

export async function processVideoInvite(file: File, start: number, posterTime: number, progress: (value: number) => void, signal: AbortSignal): Promise<PreparedVideo> {
  const mime = typeof MediaRecorder === 'undefined' ? null : recorderType(type => MediaRecorder.isTypeSupported(type))
  const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!mime || !Audio || !HTMLCanvasElement.prototype.captureStream) throw new Error(t.unsupported)
  // Construct/resume during the explicit Prepare click, before metadata awaits (Safari).
  const audio = new Audio()
  const video = document.createElement('video'), canvas = document.createElement('canvas')
  const url = URL.createObjectURL(file)
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, frame = 0
  let stopTimer = 0, interrupted = false
  video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous'
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0'
  document.body.append(video)
  const stop = () => { if (recorder?.state === 'recording') recorder.stop(); video.pause() }
  const onHidden = () => { if (document.hidden) { interrupted = true; stop() } }
  try {
    await audio.resume()
    const loaded = mediaEvent(video, 'loadeddata', signal); video.src = url; await loaded
    if (video.duration === Infinity) { const ready = mediaEvent(video, 'durationchange', signal); video.currentTime = 1e10; await ready }
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(start) || start < 0 || start >= video.duration) throw new Error(t.decode)
    const seconds = Math.min(10, video.duration - start)
    validateVideoDuration(Math.round(seconds * 1000))
    const size = videoDimensions(video.videoWidth, video.videoHeight); canvas.width = size.width; canvas.height = size.height
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error(t.unsupported)
    await seek(video, Math.max(start, Math.min(start + seconds - 0.01, posterTime)), signal)
    ctx.drawImage(video, 0, 0, size.width, size.height)
    const poster = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t.encode)), 'image/jpeg', 0.82))
    await seek(video, start, signal)
    ctx.drawImage(video, 0, 0, size.width, size.height)
    stream = canvas.captureStream(24)
    const source = audio.createMediaElementSource(video), destination = audio.createMediaStreamDestination()
    source.connect(destination) // Audio is captured, never monitored through speakers.
    destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track))
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 96_000 })
    const chunks: Blob[] = []
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder!.onerror = () => reject(new Error(t.encode))
      recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType.split(';')[0] }))
    })
    await video.play()
    recorder.start(200)
    const draw = () => {
      if (signal.aborted || document.hidden) { stop(); return }
      ctx.drawImage(video, 0, 0, size.width, size.height)
      progress(Math.min(99, Math.round((video.currentTime - start) / seconds * 100)))
      if (video.currentTime >= start + seconds - 0.06 || video.ended) stop()
      else frame = requestAnimationFrame(draw)
    }
    signal.addEventListener('abort', stop, { once: true }); document.addEventListener('visibilitychange', onHidden)
    video.onended = stop
    stopTimer = window.setTimeout(stop, (seconds + 2) * 1000)
    draw()
    const blob = await finished
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (interrupted || document.hidden) throw new Error(t.background)
    if (video.currentTime < start + seconds - 0.2) throw new Error(t.encode)
    validateVideoSize(blob.size)
    const extension = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
    const output = await inspectVideo(new File([blob], `invite.${extension}`, { type: blob.type }))
    const durationMs = Math.ceil(output.duration * 1000)
    validateVideoDuration(durationMs)
    progress(100)
    return { blob, poster, durationMs, extension }
  } finally {
    clearTimeout(stopTimer); cancelAnimationFrame(frame); signal.removeEventListener('abort', stop); document.removeEventListener('visibilitychange', onHidden)
    stop(); stream?.getTracks().forEach(track => track.stop()); video.removeAttribute('src'); video.load(); video.remove(); URL.revokeObjectURL(url); await audio.close().catch(() => {})
  }
}
