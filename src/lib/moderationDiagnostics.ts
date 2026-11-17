import type { ModerationResult } from './moderationBatch'
export const moderationReasons: Record<string, string> = {
  date: 'Дата вже минула або відсутня', title: 'Назва коротша за 3 символи', venue: 'Не вказано місце',
  duplicate: 'Дубль опублікованої події', category: 'Некоректна категорія', version: 'Змінилася версія',
  changed_after_start: 'Змінилася після початку операції', status: 'Вже не в черзі', missing: 'Запис не знайдено',
  event_status: 'Подію скасовано або перенесено',
}
export function formatModerationDiagnostics(result: ModerationResult) {
  const lines = Object.entries(result.reasons ?? {}).map(([key, count]) => `${moderationReasons[key] ?? key}: ${count}`)
  for (const example of (result.examples ?? []).slice(0,20)) lines.push(`${example.id} · ${example.title} · ${moderationReasons[example.reason] ?? example.reason}`)
  return lines.length ? '\n' + lines.join('\n') : ''
}
