export const MANUAL_RUN_COOLDOWN_MS = 10 * 60 * 1000

export function latestManualAtMs(
  rows: readonly { createdAtMs: number; trigger: 'schedule' | 'manual' | null }[],
): number | null {
  let latest: number | null = null
  for (const row of rows) {
    if (row.trigger !== 'manual' || !Number.isFinite(row.createdAtMs)) continue
    if (latest == null || row.createdAtMs > latest) latest = row.createdAtMs
  }
  return latest
}

/** ISO time when a manual run is allowed again, or null when it is allowed now. */
export function manualRetryAt(lastManualAtMs: number | null, nowMs: number): string | null {
  if (lastManualAtMs == null || !Number.isFinite(lastManualAtMs) || !Number.isFinite(nowMs)) return null
  const readyAt = lastManualAtMs + MANUAL_RUN_COOLDOWN_MS
  if (readyAt <= nowMs) return null
  return new Date(readyAt).toISOString()
}
