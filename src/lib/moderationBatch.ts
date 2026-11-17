export type ModerationResult = { processed: number; skipped: number; reasons?: Record<string, number>; examples?: { id: string; title: string; reason: string }[] }
export function moderationErrorMessage(error: unknown): string {
  const value = error as { message?: unknown; cause?: { message?: unknown } } | null
  const message = value?.cause?.message ?? value?.message
  return typeof message === 'string' ? message : ''
}
export async function runModerationBatches(rpc: (args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>, filters: Record<string, unknown>, progress?: (result: ModerationResult) => void) {
  const total: ModerationResult = { processed: 0, skipped: 0 }
  let cursor: string | null = null, snapshot: string | null = null
  while (true) {
    const { data, error } = await rpc({ ...filters, p_after: cursor, p_snapshot: snapshot })
    if (error) throw Object.assign(new Error('moderation_failed'), { cause: error, partial: total })
    if (!data || !Number.isInteger(data.processed) || !Number.isInteger(data.skipped)) throw new Error('invalid_moderation_response')
    total.processed += data.processed; total.skipped += data.skipped
    if (data.reasons) { total.reasons = { ...total.reasons }; for (const [key, count] of Object.entries(data.reasons)) if (typeof count === 'number') total.reasons[key] = (total.reasons[key] ?? 0) + count }
    if (Array.isArray(data.examples)) total.examples = [...(total.examples ?? []), ...data.examples].slice(0, 20)
    progress?.({ ...total })
    if (data.done) return total
    if (!data.cursor || data.cursor === cursor || !data.snapshot) throw new Error('invalid_moderation_cursor')
    cursor = data.cursor; snapshot = data.snapshot
  }
}
