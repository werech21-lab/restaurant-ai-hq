/**
 * Test fixture for the Phase 5 Feryal dialect suite. Shapes follow `OdooPeriodCube` exactly as the
 * live connector returns them; amounts are test values chosen so every expected answer is checkable.
 * Reference time: 2026-11-17 14:20 Asia/Kuwait (today is partial, until 14:00 complete hours).
 */
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import type { FeryalOdooDataSource } from '@/lib/feryal-odoo-agent'

export const DIALECT_NOW_MS = Date.parse('2026-11-17T11:20:00.000Z') // 14:20 Asia/Kuwait

type Ch = Record<string, { netKwd: number; orders: number }>
function channels(p: Partial<Ch> = {}): Ch {
  const base: Ch = {
    'dine-in': { netKwd: 0, orders: 0 },
    'takeaway-direct': { netKwd: 0, orders: 0 },
    'talabat-tgo': { netKwd: 0, orders: 0 },
    'talabat-tmp': { netKwd: 0, orders: 0 },
    keeta: { netKwd: 0, orders: 0 },
    deliveroo: { netKwd: 0, orders: 0 },
    jahez: { netKwd: 0, orders: 0 },
    snoonu: { netKwd: 0, orders: 0 },
  }
  return { ...base, ...p } as Ch
}

function hours(values: Record<number, number>): { hour: number; orders: number; netKwd: number }[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    netKwd: values[hour] ?? 0,
    orders: values[hour] ? Math.max(1, Math.round((values[hour] ?? 0) / 5)) : 0,
  }))
}

// Yesterday (2026-11-16): full day. Hours 9..13 = 1,150.000 (same-hours window until 14:00).
const YESTERDAY_HOURLY = hours({ 9: 120, 10: 180, 11: 230, 12: 290, 13: 330, 14: 300, 15: 220, 16: 210, 17: 260, 18: 360, 19: 430, 20: 470, 21: 400, 22: 230 })
// Today (2026-11-17) until 14:20: hours 9..13 = 1,265.000, hour 14 partial = 85.000.
const TODAY_HOURLY = hours({ 9: 140, 10: 200, 11: 250, 12: 315, 13: 360, 14: 85 })
const sum = (rows: { netKwd: number }[]) => Math.round(rows.reduce((s, r) => s + r.netKwd, 0) * 1000) / 1000

function cube(params: {
  from: string
  to: string
  days: number
  scale: number
  hourly: { hour: number; orders: number; netKwd: number }[]
}): OdooPeriodCube {
  const k = params.scale
  const byBranch = {
    '360-mall': { netKwd: 980 * k, orders: Math.round(180 * k), aovKwd: 5.444, channels: channels() },
    salmiya: { netKwd: 760 * k, orders: Math.round(150 * k), aovKwd: 5.067, channels: channels() },
    'al-kout': {
      netKwd: 690 * k,
      orders: Math.round(140 * k),
      aovKwd: 4.929,
      channels: channels({
        'dine-in': { netKwd: 300 * k, orders: Math.round(60 * k) },
        'talabat-tgo': { netKwd: 160 * k, orders: Math.round(32 * k) },
        'talabat-tmp': { netKwd: 70 * k, orders: Math.round(14 * k) },
        keeta: { netKwd: 160 * k, orders: Math.round(34 * k) },
      }),
    },
    ardiya: { netKwd: 640 * k, orders: Math.round(120 * k), aovKwd: 5.333, channels: channels() },
    promenade: { netKwd: 610 * k, orders: Math.round(118 * k), aovKwd: 5.169, channels: channels() },
    avenues: { netKwd: 590 * k, orders: Math.round(104 * k), aovKwd: 5.673, channels: channels() },
    assima: { netKwd: 420 * k, orders: Math.round(80 * k), aovKwd: 5.25, channels: channels() },
    'school-canteens': { netKwd: 95 * k, orders: Math.round(60 * k), aovKwd: 1.583, channels: channels() },
  }
  const mapped = Object.values(byBranch).reduce((s, b) => s + b.netKwd, 0)
  const unattributed = 105 * k
  const total = mapped + unattributed
  return {
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    odooCompanyId: 1,
    lastSyncAt: '2026-11-17T11:15:00.000Z',
    isStale24h: false,
    dateRange: { from: params.from, to: params.to },
    days: params.days,
    totals: {
      netSalesKwd: total,
      orders: 1100,
      aovKwd: 4.9,
      mappedBranchesNetKwd: mapped,
      mappedBranchesOrders: 1000,
      unattributedSalesKwd: unattributed,
      unattributedOrders: 100,
      excludedEntitiesKwd: 0,
      excludedEntitiesOrders: 0,
      totalDiscountKwd: 0,
      avgDiscountPct: 0,
      discountedLinesCount: 0,
    },
    byBranch,
    unattributed: { id: 'unattributed', labelAr: 'غير منسوب لفرع', labelEn: 'Unattributed to Branch', netKwd: unattributed, orders: 20, aovKwd: 5.25, channels: channels() },
    byBrand: {
      'china-garden': { netKwd: 1500 * k, qty: 300, linesCount: 290, orders: 250, avgDiscountPct: 0, discountKwd: 0 },
      franks: { netKwd: 1100 * k, qty: 260, linesCount: 250, orders: 200, avgDiscountPct: 0, discountKwd: 0 },
      'farm-brown': { netKwd: 900 * k, qty: 200, linesCount: 190, orders: 160, avgDiscountPct: 0, discountKwd: 0 },
      tahina: { netKwd: 700 * k, qty: 180, linesCount: 170, orders: 140, avgDiscountPct: 0, discountKwd: 0 },
      'noodle-bar': { netKwd: 500 * k, qty: 120, linesCount: 110, orders: 90, avgDiscountPct: 0, discountKwd: 0 },
      'karak-cafeteria': { netKwd: 300 * k, qty: 260, linesCount: 240, orders: 80, avgDiscountPct: 0, discountKwd: 0 },
    },
    brandByBranch: {},
    byChannel: channels({
      'talabat-tgo': { netKwd: 900 * k, orders: Math.round(180 * k) },
      'talabat-tmp': { netKwd: 400 * k, orders: Math.round(80 * k) },
      keeta: { netKwd: 650 * k, orders: Math.round(130 * k) },
    }),
    dailySeries: [],
    dailyByBranch: {},
    dailyUnattributed: {},
    hourlySeries: params.hourly,
    hourlyByBranch: {},
    topProducts: [
      { productId: 301, name: 'وجبة تشاينا جاردن العائلية', brandId: 'china-garden', netKwd: 420 * k, qty: 84, linesCount: 80, avgDiscountPct: 0, discountKwd: 0 },
      { productId: 302, name: 'بوكس فرانكس ميني سلايدرز', brandId: 'franks', netKwd: 310 * k, qty: 70, linesCount: 66, avgDiscountPct: 0, discountKwd: 0 },
    ],
    accounting: {
      available: true,
      from: params.from,
      to: params.to,
      sourceModel: 'account.move.line',
      lineCount: 300,
      income: total,
      otherIncome: 0,
      totalRevenue: total,
      cogs: 0.32 * total,
      expense: 0.41 * total,
      depreciation: 0.04 * total,
      operatingProfit: 0.23 * total,
      completeAccrualPosted: true,
      glIncomplete: false,
      glClosedThroughDate: '2026-10-31',
    },
  } as unknown as OdooPeriodCube
}

export function yesterdayCube(): OdooPeriodCube {
  return cube({ from: '2026-11-16', to: '2026-11-16', days: 1, scale: 1, hourly: YESTERDAY_HOURLY })
}
export function todayCube(): OdooPeriodCube {
  const c = cube({ from: '2026-11-17', to: '2026-11-17', days: 1, scale: 0.3, hourly: TODAY_HOURLY })
  c.totals.netSalesKwd = sum(TODAY_HOURLY)
  return c
}
export function monthCube(): OdooPeriodCube {
  return cube({ from: '2026-11-01', to: '2026-11-17', days: 17, scale: 16, hourly: YESTERDAY_HOURLY })
}

export const SAME_HOURS = {
  cutoffLabel: '14:00',
  todayKwd: 1265,
  yesterdayKwd: 1150,
}

export function createDialectDataSource(): FeryalOdooDataSource {
  return {
    fetchPeriodCube: async (from, to) => {
      if (from === '2026-11-16' && to === '2026-11-16') return yesterdayCube()
      if (from === '2026-11-17' && to === '2026-11-17') return todayCube()
      return monthCube()
    },
    fetchPurchaseOrders: async () => null,
    fetchWarehouseChain: async () => null,
    fetchReceivablesSummary: async () => ({ readable: true, openReceivableKwd: 0, openLinesCount: 0, sourceModel: 'account.move.line' }) as never,
    fetchBranchTopProducts: async () => null,
    fetchHrEmployees: async () => null,
    getLastSyncAt: async () => '2026-11-17T11:15:00.000Z',
  } as FeryalOdooDataSource
}
