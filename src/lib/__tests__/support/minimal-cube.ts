/**
 * A small, fully typed Odoo period cube for brand-order tests. Every number is a test value
 * (no live data); only the brand cells matter, the rest is zero.
 */
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'

const BRANDS = ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria'] as const
const BRANCHES = ['avenues', '360-mall', 'assima', 'promenade', 'salmiya', 'al-kout', 'ardiya', 'school-canteens'] as const
const CHANNELS = ['dine-in', 'takeaway-direct', 'talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const

const zeroChannels = () =>
  Object.fromEntries(CHANNELS.map((c) => [c, { netKwd: 0, orders: 0 }])) as OdooPeriodCube['byChannel']

export interface BrandCubeCell {
  netKwd: number
  orders: number | null
  linesCount: number
}

export function buildBrandOnlyCube(range: { from: string; to: string }, cells: Partial<Record<(typeof BRANDS)[number], BrandCubeCell>>): OdooPeriodCube {
  const byBrand = Object.fromEntries(
    BRANDS.map((b) => {
      const c = cells[b] ?? { netKwd: 0, orders: 0, linesCount: 0 }
      return [b, { netKwd: c.netKwd, qty: c.linesCount, linesCount: c.linesCount, orders: c.orders, avgDiscountPct: 0, discountKwd: 0 }]
    }),
  ) as OdooPeriodCube['byBrand']
  const brandByBranch: OdooPeriodCube['brandByBranch'] = Object.fromEntries(
    BRANCHES.map((br) => [
      br,
      Object.fromEntries(
        BRANDS.map((b) => {
          const c = br === 'ardiya' ? cells[b] : undefined
          return [b, { netKwd: c?.netKwd ?? 0, qty: c?.linesCount ?? 0, linesCount: c?.linesCount ?? 0, avgDiscountPct: 0, discountKwd: 0 }]
        }),
      ),
    ]),
  ) as OdooPeriodCube['brandByBranch']
  const net = Object.values(cells).reduce((s, c) => s + (c?.netKwd ?? 0), 0)
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: null,
    isStale24h: false,
    dateRange: range,
    days: 1,
    totals: {
      netSalesKwd: net,
      orders: 0,
      aovKwd: 0,
      mappedBranchesNetKwd: net,
      mappedBranchesOrders: 0,
      unattributedSalesKwd: 0,
      unattributedOrders: 0,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch: Object.fromEntries(
      BRANCHES.map((br) => [br, { netKwd: 0, orders: 0, aovKwd: 0, channels: zeroChannels() }]),
    ) as OdooPeriodCube['byBranch'],
    unattributed: { id: 'unattributed', labelAr: '', labelEn: '', netKwd: 0, orders: 0, aovKwd: 0, channels: zeroChannels() },
    byBrand,
    brandByBranch,
    byChannel: zeroChannels(),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: [],
    hourlyByBranch: {},
    topProducts: [],
  }
}
