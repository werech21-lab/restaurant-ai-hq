/**
 * Typed ledger & formatting helpers (`src/lib/aether/ledger.ts`).
 *
 * All static management estimates and snapshot numbers have been purged.
 * Live financial and operational figures come exclusively from Odoo 17 via `/api/odoo-sync`.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'

export type Lang = 'ar' | 'en'
export type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate'
export type LeverId = 'ardiya-yield' | 'chiller-overhaul' | 'keeta-cap' | 'beverage-attach' | 'menu-matrix'
export type BrandId = 'china-garden' | 'franks' | 'tahina' | 'farm-brown' | 'noodle-bar' | 'karak-cafeteria'
export type BranchId = 'promenade' | '360-mall' | 'ardiya' | 'assima' | 'salmiya' | 'al-kout' | 'avenues'
export type ChannelId =
  | 'shop'
  | 'talabat-tgo'
  | 'keeta'
  | 'deliveroo-go'
  | 'talabat-tmp'
  | 'online-link'
  | 'snoonu'
  | 'jahez'
  | 'deliveroo-mp'
  | 'staff'
export type Period = 'daily' | 'monthly' | 'annual'
export type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'
export type CategoryId =
  | 'mains'
  | 'noodles-rice'
  | 'starters'
  | 'sandwiches'
  | 'combos'
  | 'sides'
  | 'beverages'
  | 'desserts'

export const LEDGER = {
  netSales: ODOO.totals.netSalesKwd,
  orders: ODOO.totals.orders,
  aov: ODOO.totals.aovKwd,
  itemSales: ODOO.totals.itemSalesKwd,
  restaurantSales: ODOO.totals.restaurantNetKwd,
  restaurantOrders: ODOO.totals.restaurantOrders,
  revenue: ODOO.pnl.revenueKwd,
  netProfit: ODOO.pnl.operatingProfitKwd,
  marginPct: ODOO.pnl.marginPct,
  ebitda: ODOO.pnl.ebitdaKwd,
  cogs: ODOO.pnl.cogsKwd,
  cogsPct: ODOO.pnl.cogsPct,
  cogsTargetPct: 0,
  cogsEntries: 0,
  cogsRecoverable: 0,
  opex: ODOO.pnl.opexKwd,
  opexPct: ODOO.pnl.opexPct,
  depreciation: ODOO.pnl.depreciationKwd,
  opexEntries: 0,
  maintCustody: 0,
  maintEntries: 0,
  chillerRecovery: 0,
  discounts: ODOO.totals.discountsKwd,
  promoLines: ODOO.totals.promoAdjustmentsKwd,
  lineDiscounts: ODOO.totals.lineDiscountKwd,
  discountsPct: 0,
  keetaDiscounts: 0,
  keetaOrders: 0,
  keetaCapPct: 0,
  keetaCapKwd: 0,
  keetaRecovery: 0,
  keetaPromoBase: 0,
  beverageGain: 0,
  aovTarget: 0,
  menuMatrixGain: 0,
  menuDogsPurge: 0,
  menuPlowhorsesReprice: 0,
  menuItems: 0,
  topItems: 0,
  topItemsSharePct: 0,
  brands: 0,
  approvedBrands: 0,
  branches: 0,
  channels: 0,
  licence: '2021/22838',
  periodLabelEn: '',
  periodLabelAr: '',
  daysInPeriod: 1,
  syncedAt: '',
} as const

export const ROADMAP_BASELINE = { q1: 0, h1: 0, fy: 0 } as const
export const ROADMAP: readonly {
  id: string
  en: string
  ar: string
  months: number
  incremental: number
  total: number
}[] = []

export interface Lever {
  id: LeverId
  monthly: number
  tone: Tone
  kind: 'cost' | 'growth'
  en: string
  ar: string
  detailEn: string
  detailAr: string
  ownerEn: string
  ownerAr: string
  composioAction: string
}

export const LEVERS: Lever[] = []
export const LEVERS_MONTHLY_TOTAL = 0

export function leverImpact(_enabled: Record<LeverId, boolean>) {
  return {
    monthly: 0,
    share: 0,
    q1: 0,
    h1: 0,
    fy: 0,
    q1Total: 0,
    h1Total: 0,
    fyTotal: 0,
  }
}

export interface Brand {
  id: BrandId
  en: string
  ar: string
  sales: number
  orders: number
  aov: number
  color: string
  cuisineEn: string
  cuisineAr: string
}

export const BRANDS: Brand[] = []
export const INACTIVE_APPROVED_BRANDS: { id: BrandId; en: string; ar: string }[] = []

export interface Channel {
  id: ChannelId
  en: string
  ar: string
  group: 'aggregator' | 'direct' | 'store'
  sales: number
  itemSales: number
  orders: number
  commissionPct: number
  promo: number
  riderCostPerOrder: number
  mode: 'Tgo' | 'TMP' | null
  color: string
}

export const CHANNELS: Channel[] = []
export const AGGREGATOR_IDS: ChannelId[] = []

export interface Branch {
  id: BranchId
  en: string
  ar: string
  code: string
  sales: number
  orders: number
  topChannel: ChannelId
  statusEn: string
  statusAr: string
  tone: Tone
  marginPct: number
  profit: number
  revenue: number
  cogs: number
  opex: number
  depreciation: number
}

export const BRANCHES: Branch[] = []
export type BranchRow = Branch
export const OPERATING_UNITS: readonly {
  id: string
  en: string
  ar: string
  unit: string
  sales: number
  orders: number
  aov: number
  registers: readonly number[]
  pnl: unknown
}[] = []
export const EXB_UNIT = null
export const EXB_REGISTERS = ODOO.exbRegisters
export const SHARED_COSTS = ODOO.pnl.sharedCosts

export const PERIODS: { id: Period; en: string; ar: string; factor: number }[] = [
  { id: 'daily', en: 'Daily', ar: 'يومي', factor: 1 },
  { id: 'monthly', en: 'Monthly', ar: 'شهري', factor: 1 },
  { id: 'annual', en: 'Annual', ar: 'سنوي', factor: 1 },
]

export const periodFactor = (p: Period) => PERIODS.find((x) => x.id === p)?.factor ?? 1

export interface BiFilters {
  brand: BrandId | 'all'
  branch: BranchId | 'all'
  channel: ChannelId | 'all'
  period: Period
}

export const DEFAULT_FILTERS: BiFilters = {
  brand: 'all',
  branch: 'all',
  channel: 'all',
  period: 'monthly',
}

export const brandById = (id: string | null | undefined) => BRANDS.find((b) => b.id === id) ?? null
export const branchById = (id: string | null | undefined) => BRANCHES.find((b) => b.id === id) ?? null
export const channelById = (id: string | null | undefined) => CHANNELS.find((c) => c.id === id) ?? null

export function odooSlice(_f: Pick<BiFilters, 'brand' | 'branch' | 'channel'>) {
  return { net: 0, orders: 0, exact: true }
}

export function sliceShares(f: Pick<BiFilters, 'brand' | 'branch' | 'channel'>) {
  return {
    brand: f.brand === 'all' ? null : brandById(f.brand),
    branch: f.branch === 'all' ? null : branchById(f.branch),
    channel: f.channel === 'all' ? null : channelById(f.channel),
    salesShare: 0,
    ordersShare: 0,
    brandShare: 0,
    branchShare: 0,
    channelShare: 0,
    exact: true,
  }
}

export function isFiltered(f: BiFilters) {
  return f.brand !== 'all' || f.branch !== 'all' || f.channel !== 'all'
}

export function ledgerView(f: BiFilters) {
  const s = sliceShares(f)
  return {
    ...s,
    period: f.period,
    periodFactor: 1,
    filtered: isFiltered(f),
    netSales: 0,
    orders: 0,
    aov: 0,
    netProfit: 0,
    marginPct: 0,
    cogs: 0,
    cogsPct: 0,
    opex: 0,
    discounts: 0,
    custody: 0,
    levers: 0,
  }
}

export type LedgerView = ReturnType<typeof ledgerView>

export const CATEGORIES: { id: CategoryId; en: string; ar: string }[] = [
  { id: 'mains', en: 'Mains', ar: 'أطباق رئيسية' },
  { id: 'noodles-rice', en: 'Noodles & Rice', ar: 'نودلز وأرز' },
  { id: 'starters', en: 'Starters', ar: 'مقبلات' },
  { id: 'sandwiches', en: 'Sandwiches & Burgers', ar: 'ساندويتشات وبرجر' },
  { id: 'combos', en: 'Combos', ar: 'وجبات كومبو' },
  { id: 'sides', en: 'Sides', ar: 'أطباق جانبية' },
  { id: 'beverages', en: 'Beverages', ar: 'مشروبات' },
  { id: 'desserts', en: 'Desserts', ar: 'حلويات' },
]

export interface MenuItem {
  id: string
  rank: number
  en: string
  ar: string
  brand: BrandId
  category: CategoryId
  price: number
  cogsPct: number
  revenue: number
  units: number
  unitMargin: number
  totalMargin: number
  quadrant: Quadrant
  top32: boolean
  purgeCandidate: boolean
  repriceCandidate: boolean
  prepSec: number
}

export const MENU_ITEMS: MenuItem[] = []
export const MENU_COUNTS = { star: 0, plowhorse: 0, puzzle: 0, dog: 0, stars: 0, plowhorses: 0, puzzles: 0, dogs: 0 }

export type AlertCategory = 'delivery' | 'kitchen' | 'maintenance' | 'menu' | 'operations'
export type AlertSeverity = 'critical' | 'high' | 'medium'

export interface BiAlert {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  monthlyImpact: number
  exposure: number
  entries: number | null
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  askEn: string
  askAr: string
  composioAction: string
  branches: BranchId[] | 'all'
  channels: ChannelId[] | 'all'
  brands: BrandId[] | 'all'
  href: string
}

export const ALERTS: BiAlert[] = []

export function alertMatchesFilters(a: BiAlert, f: BiFilters) {
  const okBranch = f.branch === 'all' || a.branches === 'all' || a.branches.includes(f.branch)
  const okChannel = f.channel === 'all' || a.channels === 'all' || a.channels.includes(f.channel)
  const okBrand = f.brand === 'all' || a.brands === 'all' || a.brands.includes(f.brand)
  return okBranch && okChannel && okBrand
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const kwd = (n: number | null | undefined, lang: Lang, digits = 3) =>
  n == null || !Number.isFinite(n)
    ? '—'
    : lang === 'ar'
      ? `${fmt(n, digits)} د.ك`
      : `${fmt(n, digits)} KWD`

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? '—' : `${fmt(n, digits)}%`

export const T = (lang: Lang) => (en: string, ar: string) => (lang === 'ar' ? ar : en)

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}

export function feryalHref(query: string) {
  return `/erp/feryal-ai?q=${encodeURIComponent(query)}`
}
