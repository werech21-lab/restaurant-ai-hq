/**
 * Phase 5 · Item 4 — percentage shares that always total exactly 100.0%.
 *
 * Shares are rounded to one decimal with the largest-remainder (Hamilton) method on integer
 * tenths of a percent, so displayed brand shares never sum to 99.9% or 100.1%.
 */

export const BRAND_SHARE_BASIS = {
  en: 'Share basis: each brand’s net product-line sales (pos.order.line price_subtotal, excl. tax) ÷ the sum of the six active brands for the same filters; rounded so shares total 100.0%.',
  ar: 'أساس الحصة: صافي مبيعات أصناف العلامة (pos.order.line ‏price_subtotal بدون ضريبة) ÷ مجموع العلامات الست النشطة لنفس الفلاتر؛ مقرّبة بحيث يكون المجموع 100.0%.',
} as const

/** Returns one-decimal percentages (same order as `values`) that sum to exactly 100.0. */
export function normalizeSharesTo100(values: readonly number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = clean.reduce((s, v) => s + v, 0)
  if (total <= 0) return clean.map(() => 0)
  const TOTAL_TENTHS = 1000
  const exact = clean.map((v) => (v / total) * TOTAL_TENTHS)
  const floors = exact.map((x) => Math.floor(x))
  let remaining = TOTAL_TENTHS - floors.reduce((s, v) => s + v, 0)
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x) }))
    .sort((a, b) => b.rem - a.rem || clean[b.i] - clean[a.i] || a.i - b.i)
  for (const { i } of order) {
    if (remaining <= 0) break
    if (clean[i] <= 0) continue
    floors[i] += 1
    remaining -= 1
  }
  return floors.map((t) => t / 10)
}

/** Sum of one-decimal shares computed in integer tenths (avoids float drift like 99.99999). */
export function sumShares(shares: readonly number[]): number {
  return shares.reduce((s, v) => s + Math.round(v * 10), 0) / 10
}
