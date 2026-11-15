import { supabase } from '@/lib/supabase'
import { validateVideoDuration, validateVideoSize, type PreparedVideo } from './videoInviteProcessing'
import { videoText as t } from './videoInviteText'

export interface VideoFields {
  video_path?: string | null
  video_poster_path?: string | null
  video_duration_ms?: number | null
  video_updated_at?: string | null
}
export const VIDEO_BUCKET = 'event-videos'
const staged = new WeakMap<PreparedVideo, { eventId: string; fields: VideoFields; videoDone: boolean; posterDone: boolean }>()

export async function videoUrl(path: string) {
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) throw new Error(t.access)
  return data.signedUrl
}
function put(url: string, blob: Blob, onProgress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url); xhr.timeout = 120_000; xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.min(blob.size, event.loaded / event.total * blob.size)) }
    xhr.onerror = xhr.ontimeout = () => reject(new Error(t.storage))
    xhr.onload = () => {
      let duplicate = xhr.status === 409
      try { duplicate ||= String(JSON.parse(xhr.responseText).statusCode) === '409' } catch { /* Non-JSON response. */ }
      // Paths are immutable UUIDs retained only for this exact staged payload.
      if ((xhr.status >= 200 && xhr.status < 300) || duplicate) { onProgress(blob.size); resolve() }
      else reject(new Error(t.storage))
    }
    const body = new FormData(); body.append('cacheControl', '60'); body.append('', blob)
    xhr.send(body)
  })
}
export async function saveEventVideo(eventId: string, prepared: PreparedVideo, expected: VideoFields, progress: (value: number) => void): Promise<VideoFields> {
  validateVideoDuration(prepared.durationMs); validateVideoSize(prepared.blob.size)
  if (!prepared.poster.size || prepared.poster.size > 1024 * 1024 || prepared.poster.type !== 'image/jpeg') throw new Error(t.size)
  let item = staged.get(prepared)
  if (!item) {
    const uuid = crypto.randomUUID()
    item = { eventId, fields: { video_path: `${eventId}/${uuid}.${prepared.extension}`, video_poster_path: `${eventId}/${uuid}.jpg`, video_duration_ms: prepared.durationMs }, videoDone: false, posterDone: false }
    staged.set(prepared, item)
  }
  if (item.eventId !== eventId) throw new Error(t.storage)
  const total = prepared.blob.size + prepared.poster.size
  const bucket = supabase.storage.from(VIDEO_BUCKET)
  for (const [part, path, blob, before] of [
    ['videoDone', item.fields.video_path!, prepared.blob, 0],
    ['posterDone', item.fields.video_poster_path!, prepared.poster, prepared.blob.size],
  ] as const) {
    if (!item[part]) {
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false })
      if (error || !data) throw new Error(t.storage)
      await put(data.signedUrl, blob, bytes => progress(Math.round((before + bytes) / total * 95)))
      item[part] = true
    }
  }
  const { data, error } = await supabase.rpc('poruch_set_event_video', {
    p_event_id: eventId, p_path: item.fields.video_path, p_poster: item.fields.video_poster_path,
    p_duration_ms: prepared.durationMs, p_expected_path: expected.video_path ?? null,
  })
  if (error) throw new Error(t.storage) // Retain staged paths for an idempotent retry.
  progress(100)
  const fields = (data ?? item.fields) as VideoFields
  if (expected.video_path && expected.video_path !== fields.video_path) {
    // The new pair is already committed. Retry cleanup without undoing a saved invite.
    const result = await bucket.remove([expected.video_path, expected.video_poster_path!].filter(Boolean))
    if (result.error) console.error('[video] Previous private files require cleanup', result.error.message)
  }
  return fields
}
export async function removeEventVideo(eventId: string, fields: VideoFields, reason = '') {
  if (!fields.video_path) return
  const { error: fileError } = await supabase.storage.from(VIDEO_BUCKET).remove([fields.video_path, fields.video_poster_path!].filter(Boolean))
  if (fileError) throw new Error(t.failed)
  const { error } = await supabase.rpc('poruch_remove_event_video', { p_event_id: eventId, p_expected_path: fields.video_path, p_reason: reason })
  if (error) throw new Error(t.failed)
}
