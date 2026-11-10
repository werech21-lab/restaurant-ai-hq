/**
 * Verified reconciliation layer for the sales scorecard datasets.
 *
 * The scorecard keeps its October brand × channel seed matrices (they carry the real channel mix,
 * item counts and discount patterns). This module rebalances them onto the approved ledger:
 *   - 6 verified brands (China Garden, Frank's, Tahina, Burgerito, Chick & Dip, Crave)
 *   - 9 verified active branches (Salmiya #1 at 31,246.230 KWD)
 *   - 167,092.160 KWD net sales · 30,540 orders · 4,152 KWD discounts
 * using RAS / iterative proportional fitting so every row AND column total reconciles exactly.
 */
import { BRANCHES as LEDGER_BRANCHES, BRANDS as LEDGER_BRANDS, LEDGER, type BrandId } from '@/lib/aether/ledger'

/** Scorecard display key for each verified brand. */
export const SCORECARD_BRAND_NAME: Record<BrandId, string> = {
  'china-garden': 'China Garden',
  franks: "Frank's",
  tahina: 'Tahina',
  burgerito: 'Burgerito',
  'chick-dip': 'Chick & Dip',
  crave: 'Crave',
}

export const VERIFIED_BRAND_TOTALS: Record<string, { netSales: number; orders: number; share: number; avgOrder: number }> = Object.fromEntries(
  LEDGER_BRANDS.map((b) => [
    SCORECARD_BRAND_NAME[b.id],
    {
      netSales: b.sales,
      orders: b.orders,
      share: Math.round((b.sales / LEDGER.netSales) * 1000) / 10,
      avgOrder: Math.round((b.sales / b.orders) * 100) / 100,
    },
  ]),
)

/** Scorecard branch codes for the 9 verified active branches. */
export const BRANCH_CODE: Record<string, string> = {
  salmiya: 'SLM',
  'al-kout': 'KOT',
  sharq: 'SHQ',
  hawally: 'HWL',
  farwaniya: 'FRW',
  ardiya: 'ARD',
  mahboula: 'MHB',
  'mubarak-al-kabeer': 'QRN',
  jabriya: 'JAB',
}

export const VERIFIED_BRANCH_NET: Record<string, number> = Object.fromEntries(LEDGER_BRANCHES.map((b) => [BRANCH_CODE[b.id], b.sales]))

export const VERIFIED_BRANCH_LIST = LEDGER_BRANCHES.map((b) => ({
  code: BRANCH_CODE[b.id],
  id: b.id,
  nameEn: b.en.split(' / ')[0],
  nameAr: b.ar.split(' / ')[0],
  sales: b.sales,
  orders: b.orders,
}))

/**
 * RAS balancing: scales a non-negative seed matrix so rows sum to `rowTargets` and columns to
 * `colTargets` (targets must share the same grand total). Structural zeros stay zero.
 */
export function rasBalance(seed: number[][], rowTargets: number[], colTargets: number[], iterations = 600): number[][] {
  let m = seed.map((r) => r.map((v) => Math.max(0, v)))
  for (let it = 0; it < iterations; it++) {
    m = m.map((row, i) => {
      const t = row.reduce((a, v) => a + v, 0)
      return t > 0 ? row.map((v) => (v * rowTargets[i]) / t) : row
    })
    const col = colTargets.map((_, j) => m.reduce((a, row) => a + row[j], 0))
    m = m.map((row) => row.map((v, j) => (col[j] > 0 ? (v * colTargets[j]) / col[j] : v)))
  }
  return m
}
