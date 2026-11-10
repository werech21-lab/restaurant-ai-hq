/**
 * Odoo reconciliation layer for the sales scorecard datasets.
 *
 * Every figure comes from the live Odoo sync (src/lib/odoo/odoo-dataset.ts):
 *   - approved Venture Foods brands (root POS categories) — real item sales and real order counts
 *   - permanent restaurant locations from the positive pos.config whitelist, plus the
 *     Exhibitions & Booths (EXB) unit and the school-canteen unit reported separately
 * No proportional fitting is applied.
 */
import { ODOO } from '@/lib/odoo/odoo-dataset'

/** Scorecard display name for each approved brand id. */
export const SCORECARD_BRAND_NAME: Record<string, string> = Object.fromEntries(ODOO.brands.map((b) => [b.id, b.en]))
export const SCORECARD_BRAND_ID: Record<string, string> = Object.fromEntries(ODOO.brands.map((b) => [b.en, b.id]))

export const VERIFIED_BRAND_TOTALS: Record<string, { netSales: number; orders: number; share: number; avgOrder: number }> = Object.fromEntries(
  ODOO.brands.filter((b) => b.active).map((b) => [b.en, { netSales: b.netKwd, orders: b.orders, share: b.sharePct, avgOrder: b.aovKwd }]),
)

export interface OdooLocationRow {
  id: string
  code: string
  nameEn: string
  nameAr: string
  unit: 'restaurant' | 'exhibition' | 'canteen'
  sales: number
  orders: number
  registers: readonly number[]
}

const toRow = (l: (typeof ODOO.restaurants)[number] | (typeof ODOO.exhibitions)[number] | (typeof ODOO.canteens)[number]): OdooLocationRow => ({
  id: l.id,
  code: l.code,
  nameEn: l.en,
  nameAr: l.ar,
  unit: l.unit as OdooLocationRow['unit'],
  sales: l.netKwd,
  orders: l.orders,
  registers: l.registers,
})

/** Permanent restaurant locations (the branch layer). */
export const VERIFIED_BRANCH_LIST: OdooLocationRow[] = ODOO.restaurants.map(toRow)
/** Exhibitions & Booths (EXB) and school canteens — operating units outside the branch rankings. */
export const OPERATING_UNIT_LIST: OdooLocationRow[] = [...ODOO.exhibitions, ...ODOO.canteens].map(toRow)
export const ALL_LOCATION_LIST: OdooLocationRow[] = [...VERIFIED_BRANCH_LIST, ...OPERATING_UNIT_LIST]

export const VERIFIED_BRANCH_NET: Record<string, number> = Object.fromEntries(ALL_LOCATION_LIST.map((l) => [l.id, l.sales]))
