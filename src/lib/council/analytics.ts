/**
 * Decision analytics — pure, deterministic math shared by the strategic advisors.
 *
 * - Sales-change decomposition (orders effect vs basket effect, exact: the two parts add up to Δ).
 * - Robust statistics (median / MAD / robust z) for "is this day unusual for this branch?".
 * - Same-weekday baselines and a backtested seasonal-naive forecast (accuracy reported, never hidden).
 * - Share profiles (weekday / hour) compared with the peer median.
 *
 * Money is handled in fils (integers) wherever it is summed, so totals reconcile to the fils.
 */
import { median, shiftIso, weekdayOf } from './helpers'
import type { CompletedDaily } from './series'

/** Scaled MAD (×1.4826 ≈ σ for normal data). 0 when fewer than 3 values. */
export function scaledMad(values: readonly number[]): number {
  if (values.length < 3) return 0
  const m = median(values)
  return 1.4826 * median(values.map((v) => Math.abs(v - m)))
}

/** Robust z-score of `x` against `baseline`; null when the baseline has no spread or < 4 points. */
export function robustZ(x: number, baseline: readonly number[]): number | null {
  if (baseline.length < 4) return null
  const mad = scaledMad(baseline)
  if (!(mad > 0)) return null
  return (x - median(baseline)) / mad
}

export interface OrdersAovSplit {
  /** Δ net (A − B), fils. */
  deltaFils: number
  /** Part explained by the change in order count (at the average basket of both periods). */
  ordersEffectFils: number
  /** Part explained by the change in basket size (at the average order count of both periods). */
  basketEffectFils: number
}

/**
 * Symmetric (midpoint) split of a sales change into orders × basket. Exact:
 * ordersEffect + basketEffect = Δ, rounded so the parts still add up to the fils.
 */
export function splitOrdersAov(a: { netFils: number; orders: number }, b: { netFils: number; orders: number }): OrdersAovSplit | null {
  if (a.orders <= 0 || b.orders <= 0) return null
  const aovA = a.netFils / a.orders
  const aovB = b.netFils / b.orders
  const deltaFils = a.netFils - b.netFils
  const ordersEffectFils = Math.round((a.orders - b.orders) * ((aovA + aovB) / 2))
  return { deltaFils, ordersEffectFils, basketEffectFils: deltaFils - ordersEffectFils }
}

/** Branch net (fils) per completed day. */
export function branchDayFils(d: CompletedDaily, branch: string, day: string): number | null {
  const row = d.byDay[day]
  if (!row) return null
  return row[branch]?.netFils ?? 0
}

/**
 * Same-weekday values before `day` (most recent first), up to `weeks`, from completed days only.
 * Days missing from the payload are skipped, never read as 0.
 */
export function sameWeekdayHistory(d: CompletedDaily, branch: string | null, day: string, weeks: number): number[] {
  const out: number[] = []
  const first = d.days[0]
  for (let k = 1; k <= weeks; k++) {
    const prior = shiftIso(day, -7 * k)
    if (prior < first) break
    if (!d.byDay[prior]) continue
    out.push(branch ? (d.byDay[prior][branch]?.netFils ?? 0) : Object.values(d.byDay[prior]).reduce((s, c) => s + c.netFils, 0))
  }
  return out
}

function dayFils(d: CompletedDaily, branch: string | null, day: string): number {
  const row = d.byDay[day]
  if (!row) return 0
  return branch ? (row[branch]?.netFils ?? 0) : Object.values(row).reduce((s, c) => s + c.netFils, 0)
}

/** Sum of fils over the `n` completed days ending at `to` (inclusive) that exist in the payload. */
function windowFils(d: CompletedDaily, branch: string | null, to: string, n: number): { fils: number; days: number } {
  let fils = 0
  let days = 0
  for (let k = 0; k < n; k++) {
    const day = shiftIso(to, -k)
    if (!d.byDay[day]) continue
    fils += dayFils(d, branch, day)
    days++
  }
  return { fils, days }
}

export const FORECAST_WEEKS = 6
export const TREND_CLAMP = { min: 0.8, max: 1.2 } as const

/**
 * Seasonal-naive forecast for `day` using only data strictly before `asOf` (the forecast origin):
 * median of the last {@link FORECAST_WEEKS} same weekdays × a damped 28-day trend ratio.
 * Null when fewer than 3 same-weekday points exist.
 */
export function forecastDay(d: CompletedDaily, branch: string | null, day: string, asOf: string): number | null {
  // Same-weekday points strictly before the origin (missing days skipped, never read as 0).
  let x = day
  while (x >= asOf) x = shiftIso(x, -7)
  const hist: number[] = []
  for (let k = 0; k < FORECAST_WEEKS && x >= d.days[0]; k++, x = shiftIso(x, -7)) {
    if (d.byDay[x]) hist.push(dayFils(d, branch, x))
  }
  if (hist.length < 3) return null
  const base = median(hist)
  const lastDay = shiftIso(asOf, -1)
  const recent = windowFils(d, branch, lastDay, 28)
  const prior = windowFils(d, branch, shiftIso(lastDay, -28), 28)
  let trend = 1
  if (recent.days >= 21 && prior.days >= 21 && prior.fils > 0) {
    const raw = recent.fils / recent.days / (prior.fils / prior.days)
    // Damped (square root) and clamped: a forecast must not extrapolate a short burst.
    trend = Math.min(TREND_CLAMP.max, Math.max(TREND_CLAMP.min, Math.sqrt(raw)))
  }
  return Math.round(base * trend)
}

export interface BacktestResult {
  /** Mean absolute percentage error over the held-out days (0–100+), one decimal. */
  mapePct: number
  /** Days scored (actual > 0). */
  scoredDays: number
  /** Σ|error| / Σ actual, as a percentage (weighted, robust to tiny days). */
  wapePct: number
}

/**
 * Rolling-origin backtest: for each of the last `weeks` completed weeks, forecast its 7 days from
 * data before that week only, then score against the actual days.
 */
export function backtestForecast(d: CompletedDaily, branch: string | null, weeks = 4): BacktestResult | null {
  const last = d.days[d.days.length - 1]
  let absPctSum = 0
  let scored = 0
  let absErr = 0
  let actualSum = 0
  for (let w = weeks; w >= 1; w--) {
    const origin = shiftIso(last, -(7 * w) + 1)
    for (let k = 0; k < 7; k++) {
      const day = shiftIso(origin, k)
      if (!d.byDay[day] || day > last) continue
      const actual = dayFils(d, branch, day)
      const f = forecastDay(d, branch, day, origin)
      if (f === null || actual <= 0) continue
      absPctSum += Math.abs(f - actual) / actual
      absErr += Math.abs(f - actual)
      actualSum += actual
      scored++
    }
  }
  if (scored < 7 || actualSum <= 0) return null
  return {
    mapePct: Math.round((absPctSum / scored) * 1000) / 10,
    scoredDays: scored,
    wapePct: Math.round((absErr / actualSum) * 1000) / 10,
  }
}

/** Share (0–1) of a branch's net by weekday over the given completed days. */
export function weekdayShares(d: CompletedDaily, branch: string, days: readonly string[]): number[] | null {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  for (const day of days) sums[weekdayOf(day)] += d.byDay[day]?.[branch]?.netFils ?? 0
  const total = sums.reduce((s, v) => s + v, 0)
  if (total <= 0) return null
  return sums.map((v) => v / total)
}

/** Share (0–1) of net by hour from an hourly series; null when the series has no positive total. */
export function hourShares(series: readonly { hour: number; netKwd: number }[]): number[] | null {
  const sums = new Array<number>(24).fill(0)
  for (const h of series) if (h.hour >= 0 && h.hour < 24) sums[h.hour] += Math.max(0, Number(h.netKwd) || 0)
  const total = sums.reduce((s, v) => s + v, 0)
  if (total <= 0) return null
  return sums.map((v) => v / total)
}

/** Element-wise median of several share profiles. */
export function peerMedianProfile(profiles: readonly (readonly number[])[]): number[] {
  if (profiles.length === 0) return []
  return profiles[0].map((_, i) => median(profiles.map((p) => p[i])))
}

export type MenuClass = 'star' | 'plowhorse' | 'puzzle' | 'dog'

export interface MenuItemInput {
  productId: number
  name: string
  brandId: string
  qty: number
  netKwd: number
  discountKwd: number
  /** Unit cost when Odoo holds one (standard price / valuation layer / purchase price); else null. */
  unitCostKwd: number | null
}

export interface MenuItemResult extends MenuItemInput {
  qtyShare: number
  avgPriceKwd: number
  /** Contribution per unit (price − cost) when the cost is known; null otherwise. */
  unitMarginKwd: number | null
  /** Discount ÷ (net + discount): how much of the list value was given away. */
  discountShare: number
  cls: MenuClass
}

export interface MenuAnalysis {
  /** 'margin' when every classified item has a known cost; otherwise 'price' (never mixed). */
  basis: 'margin' | 'price'
  popularityThreshold: number
  valueThresholdKwd: number
  items: MenuItemResult[]
  costCoveragePct: number
}

/**
 * Kasavana–Smith menu engineering within one brand: popularity = quantity share against 70% of a
 * fair share (1/n); value = unit contribution margin when every item has a cost, otherwise average
 * selling price — labelled by `basis`, never a mix of the two.
 */
export function engineerMenu(rows: readonly MenuItemInput[]): MenuAnalysis | null {
  const items = rows.filter((r) => r.qty > 0 && r.netKwd > 0)
  if (items.length < 4) return null
  const totalQty = items.reduce((s, r) => s + r.qty, 0)
  const costed = items.filter((r) => r.unitCostKwd !== null && r.unitCostKwd > 0)
  const basis: MenuAnalysis['basis'] = costed.length === items.length ? 'margin' : 'price'
  const popularityThreshold = (1 / items.length) * 0.7
  const value = (r: MenuItemInput) => (basis === 'margin' ? r.netKwd / r.qty - (r.unitCostKwd as number) : r.netKwd / r.qty)
  // Weighted average value per unit sold (Σ value × qty ÷ Σ qty).
  const valueThresholdKwd = items.reduce((s, r) => s + value(r) * r.qty, 0) / totalQty
  return {
    basis,
    popularityThreshold,
    valueThresholdKwd,
    costCoveragePct: Math.round((costed.length / items.length) * 1000) / 10,
    items: items.map((r) => {
      const qtyShare = r.qty / totalQty
      const v = value(r)
      const popular = qtyShare >= popularityThreshold
      const high = v >= valueThresholdKwd
      return {
        ...r,
        qtyShare,
        avgPriceKwd: r.netKwd / r.qty,
        unitMarginKwd: r.unitCostKwd !== null && r.unitCostKwd > 0 ? r.netKwd / r.qty - r.unitCostKwd : null,
        discountShare: r.netKwd + r.discountKwd > 0 ? r.discountKwd / (r.netKwd + r.discountKwd) : 0,
        cls: popular ? (high ? 'star' : 'plowhorse') : high ? 'puzzle' : 'dog',
      }
    }),
  }
}
