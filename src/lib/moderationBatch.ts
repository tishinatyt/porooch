export type ModerationResult = { processed: number; skipped: number }
export async function runModerationBatches(rpc: (args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>, filters: Record<string, unknown>, progress?: (result: ModerationResult) => void) {
  const total = { processed: 0, skipped: 0 }
  let cursor: string | null = null, snapshot: string | null = null
  while (true) {
    const { data, error } = await rpc({ ...filters, p_after: cursor, p_snapshot: snapshot })
    if (error) throw Object.assign(new Error('moderation_failed'), { cause: error, partial: total })
    if (!data || !Number.isInteger(data.processed) || !Number.isInteger(data.skipped)) throw new Error('invalid_moderation_response')
    total.processed += data.processed; total.skipped += data.skipped; progress?.({ ...total })
    if (data.done) return total
    if (!data.cursor || data.cursor === cursor || !data.snapshot) throw new Error('invalid_moderation_cursor')
    cursor = data.cursor; snapshot = data.snapshot
  }
}
