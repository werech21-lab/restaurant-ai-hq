/**
 * Brand scope rules for the Executive Dashboard, kept out of the React tree so they can be tested.
 *
 * Every card must say what it measures. With a brand selected, a card either shows that brand's
 * exact numbers or says it cannot; it never shows company numbers under a brand title.
 */
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const SCOPE_LABELS = {
  companyWide: { ar: 'على مستوى الشركة', en: 'Company-wide' },
  allBrands: { ar: 'كل العلامات', en: 'All brands' },
  unavailableForFilter: { ar: 'غير متاح لهذا الفلتر', en: 'Not available for this filter' },
  noComparison: { ar: 'لا توجد مقارنة', en: 'No comparison' },
  productLinesBasis: { ar: 'الأساس: سطور المنتجات', en: 'Basis: product lines' },
  /** The gap is Σ all brands' product lines − order net; it is not the selected brand's own gap. */
  allBrandsBasisGap: { ar: 'الفرق بين مجموع كل العلامات وصافي الطلبات', en: 'Σ all brands vs order net' },
  multiBrandOrders: {
    ar: 'الطلب الذي يحتوي على أكثر من علامة يُحسب مرة لكل علامة',
    en: 'An order with items from several brands counts once for each brand',
  },
} as const

export const UNATTRIBUTED_KEY = 'unattributed'

const ALL = 'all'

export interface ScopedCell {
  netKwd: number
  orders: number | null
}

export type BranchScope =
  | { available: true; scope: 'all-brands' | 'brand'; rows: Record<string, ScopedCell>; unattributed: ScopedCell }
  | { available: false; reasonAr: string; reasonEn: string }

function finiteOrZero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function countOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null
}

function unavailable(): BranchScope {
  return {
    available: false,
    reasonAr: SCOPE_LABELS.unavailableForFilter.ar,
    reasonEn: SCOPE_LABELS.unavailableForFilter.en,
  }
}

/** Branch figures that match the selected brand; all-brand figures only when brand is `all`. */
export function resolveBranchScope(
  bucket: OdooBucketSummary | null | undefined,
  brand: string,
  branchIds: readonly string[],
): BranchScope {
  if (!bucket) return unavailable()
  if (brand === ALL) {
    const source = bucket.mappedByLocation ?? bucket.byLocation
    if (!source) return unavailable()
    const rows = Object.fromEntries(
      branchIds.map((lid) => [lid, { netKwd: finiteOrZero(source[lid]?.netKwd), orders: Math.round(finiteOrZero(source[lid]?.orders)) }]),
    )
    return {
      available: true,
      scope: 'all-brands',
      rows,
      unattributed: {
        netKwd: finiteOrZero(bucket.unattributedSalesKwd),
        orders: Math.round(finiteOrZero(bucket.unattributedOrders)),
      },
    }
  }
  const byLoc = bucket.byBrandByLocation
  if (!byLoc) return unavailable()
  const cellOf = (key: string): ScopedCell => ({
    netKwd: finiteOrZero(byLoc[key]?.[brand]?.netKwd),
    orders: countOrNull(byLoc[key]?.[brand]?.orders),
  })
  return {
    available: true,
    scope: 'brand',
    rows: Object.fromEntries(branchIds.map((lid) => [lid, cellOf(lid)])),
    unattributed: cellOf(UNATTRIBUTED_KEY),
  }
}

/** Share of each value in the total; `null` when the total is not positive. */
export function sharesOf(values: readonly number[]): (number | null)[] {
  const total = values.reduce((s, v) => s + v, 0)
  return values.map((v) => (total > 0 ? (v / total) * 100 : null))
}

export interface BrandHeadline {
  netKwd: number
  orders: number | null
  basis: 'order-level' | 'order-allocated' | 'product-lines'
  basisGapKwd: number | null
}

/** Σ brand line totals − order net, for payloads that predate `brandBasisGapKwd`. */
function legacyGapKwd(bucket: OdooBucketSummary): number | null {
  const orderNet = bucket.totals.restaurantNetKwd
  if (orderNet === null || !bucket.byBrand) return null
  const brandLines = Object.values(bucket.byBrand).reduce((s, b) => s + finiteOrZero(b?.netKwd), 0)
  return Math.round((brandLines - orderNet) * 1000) / 1000
}

/** Headline net and orders for the brand filter, with the basis the numbers are on. */
export function resolveBrandHeadline(bucket: OdooBucketSummary | null | undefined, brand: string): BrandHeadline | null {
  if (!bucket) return null
  if (brand === ALL) {
    const net = bucket.totals.restaurantNetKwd
    const orders = bucket.totals.restaurantOrders
    if (net === null || orders === null) return null
    return { netKwd: net, orders, basis: 'order-level', basisGapKwd: 0 }
  }
  const row = bucket.byBrand?.[brand]
  if (!bucket.byBrand) return null
  // Payloads without `brandBasis` come from servers that estimated brand orders pro-rata.
  const isLegacyPayload = bucket.brandBasis === undefined
  const basis = bucket.brandBasis ?? 'product-lines'
  return {
    netKwd: finiteOrZero(row?.netKwd),
    orders: !isLegacyPayload && typeof row?.orders === 'number' ? row.orders : null,
    basis,
    basisGapKwd: basis === 'order-allocated' ? 0 : (bucket.brandBasisGapKwd ?? legacyGapKwd(bucket)),
  }
}

export interface ScopedDailyPoint {
  day: string
  orders: number
  netKwd: number
}

export interface ScopedDailySeries {
  scope: 'brand' | 'all-brands'
  series: ScopedDailyPoint[]
}

function brandDailyFrom(bucket: OdooBucketSummary | null | undefined, brand: string): ScopedDailyPoint[] | null {
  const daily = bucket?.byBrandDaily
  if (!daily) return null
  return Object.entries(daily)
    .map(([day, byBrand]) => ({ day, netKwd: finiteOrZero(byBrand?.[brand]?.netKwd), orders: Math.round(finiteOrZero(byBrand?.[brand]?.orders)) }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Daily pulse for the brand filter. Brand days exist only for the short windows read per order
 * (today, last 7 days). Anything else falls back to the company series, labelled "all brands".
 */
export function resolveDailySeriesForBrand(
  liveSummary: OdooLiveSummary | null | undefined,
  brand: string,
  window: { fromIso: string; toInclusiveIso: string },
): ScopedDailySeries {
  const inWindow = (d: ScopedDailyPoint) => d.day >= window.fromIso && d.day <= window.toInclusiveIso
  const company = (liveSummary?.dailySeries ?? []).filter(inWindow)
  if (brand === ALL) return { scope: 'all-brands', series: company }
  const weekBucket = liveSummary?.buckets?.week
  const brandSeries = brandDailyFrom(weekBucket, brand)
  const coversWindow =
    brandSeries !== null &&
    weekBucket !== undefined &&
    weekBucket.from <= window.fromIso &&
    weekBucket.to > window.toInclusiveIso
  if (brandSeries && coversWindow) return { scope: 'brand', series: brandSeries.filter(inWindow) }
  return { scope: 'all-brands', series: company }
}

export type ScopeBadgeKind = 'company-wide' | 'all-brands'

export interface ComboChartScope {
  /** Label shown on the chart; `null` when the series already matches the filter. */
  badge: ScopeBadgeKind | null
  /** The posted GL margin is company-wide; it is only drawn over a company (all-brand) series. */
  plotCompanyMargin: boolean
}

/**
 * Scope of the "POS sales & posted operating net" chart. Under a brand filter the timeline may
 * still be the company series (no brand days for that window): it is then labelled "all brands".
 * A brand-scoped series never gets the company GL margin drawn over it.
 */
export function resolveComboChartScope(input: {
  brand: string
  group: 'timeline' | 'branches'
  timelineScope: 'brand' | 'all-brands'
}): ComboChartScope {
  const companySeries = input.group === 'timeline' && (input.brand === ALL || input.timelineScope === 'all-brands')
  return {
    badge: input.brand !== ALL && companySeries ? 'all-brands' : null,
    plotCompanyMargin: companySeries,
  }
}

/** Company-wide cards (GL, commissions, AR) carry a badge whenever a brand is selected. */
export function companyWideBadgeFor(brand: string): ScopeBadgeKind | null {
  return brand === ALL ? null : 'company-wide'
}
