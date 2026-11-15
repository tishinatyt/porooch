import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validateVideoDuration, validateVideoSize, videoDimensions, recorderType, VIDEO_MAX_BYTES } from '../src/lib/videoInviteProcessing.ts'

test('video duration: finite positive duration up to exactly ten seconds', () => {
  for (const ms of [1, 9500, 10000]) assert.doesNotThrow(() => validateVideoDuration(ms))
  for (const ms of [0, -1, 10001, Infinity, NaN]) assert.throws(() => validateVideoDuration(ms))
})
test('video upload: hard eight MiB cap, no empty or invalid sizes', () => {
  for (const size of [1, 4 * 1024 ** 2, VIDEO_MAX_BYTES]) assert.doesNotThrow(() => validateVideoSize(size))
  for (const size of [0, -1, NaN, Infinity, VIDEO_MAX_BYTES + 1]) assert.throws(() => validateVideoSize(size))
})
test('portrait and landscape recording keep aspect and cap long side at 720', () => {
  assert.deepEqual(videoDimensions(1920, 1080), { width: 720, height: 404 })
  assert.deepEqual(videoDimensions(1080, 1920), { width: 404, height: 720 })
  assert.deepEqual(videoDimensions(320, 240), { width: 320, height: 240 })
  assert.throws(() => videoDimensions(0, 100))
})
test('prefer Safari-compatible MP4; fall back to WebM or unsupported', () => {
  assert.match(recorderType(() => true)!, /^video\/mp4/)
  assert.match(recorderType(mime => mime.startsWith('video/webm'))!, /^video\/webm/)
  assert.equal(recorderType(() => false), null)
})
test('manual SQL is identical and protects storage plus event metadata', () => {
  const sql = fs.readFileSync('supabase/migrations/025_event_video_invites.sql', 'utf8')
  assert.equal(sql, fs.readFileSync('docs/sql/video-invite.sql', 'utf8'))
  assert.match(sql, /'event-videos','event-videos',false,8388608/)
  assert.match(sql, /video_duration_ms is not null and video_duration_ms between 1 and 10000/)
  assert.match(sql, /poruch_guard_video_fields before insert or update/)
  assert.match(sql, /is distinct from p_expected_path/)
  assert.match(sql, /public\.is_event_participant\(e.id\)/)
  assert.doesNotMatch(sql, /tow_leads|svoya_/)
})
