/**
 * Typed empty Odoo dataset interfaces (`src/lib/odoo/odoo-dataset.ts`).
 *
 * All static snapshot arrays and hardcoded numbers have been purged.
 * Live POS, GL, procurement, inventory, and HR figures are fetched exclusively
 * from Odoo 17 via `/api/odoo-sync` and `/api/erp/*` endpoints.
 */

export type OdooBrandId =
  | 'china-garden'
  | 'franks'
  | 'tahina'
  | 'farm-brown'
  | 'noodle-bar'
  | 'karak-cafeteria'

export type OdooLocationId =
  | 'promenade'
  | '360-mall'
  | 'ardiya'
  | 'assima'
  | 'salmiya'
  | 'al-kout'
  | 'avenues'

export type OdooChannelId =
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

export interface OdooLocationPnl {
  income: number
  otherIncome: number
  cogs: number
  expense: number
  depreciation: number
  operatingProfit: number
}

export interface OdooBrandRecord {
  id: OdooBrandId
  en: string
  ar: string
  posRoot: string
  color: string
  cuisineEn: string
  cuisineAr: string
  active: boolean
  netKwd: number
  itemSalesKwd: number
  orders: number
  aovKwd: number
  qty: number
  itemsPerOrder: number
  sharePct: number
  discountKwd: number
  drinksPct: number
  bestSeller: { name: string; qty: number; netKwd: number } | null
}

export interface OdooLocationRecord {
  id: OdooLocationId | string
  en: string
  ar: string
  code: string
  unit: 'restaurant' | 'exhibition' | 'canteen'
  netKwd: number
  orders: number
  aovKwd: number
  sharePct: number
  registers: readonly number[]
  brands: readonly { brand: OdooBrandId; netKwd: number; orders: number }[]
  channels: readonly { channel: OdooChannelId; amountKwd: number; payments: number }[]
  pnl: OdooLocationPnl | null
}

export interface OdooChannelRecord {
  id: OdooChannelId
  odooName: string
  en: string
  ar: string
  group: 'aggregator' | 'direct' | 'store'
  mode: 'Tgo' | 'TMP' | null
  color: string
  commissionPct: number
  riderCostPerOrder: number
  netKwd: number
  itemSalesKwd: number
  promoKwd: number
  orders: number
  sharePct: number
}

export interface OdooMenuRecord {
  name: string
  code: string | null
  brand: OdooBrandId
  category: string
  qty: number
  netKwd: number
  priceKwd: number
  listPriceKwd: number
  unitCostKwd: number
}

export interface OdooDatasetShape {
  meta: {
    source: string
    database: string
    serverVersion: string
    syncedAt: string
    period: { from: string; to: string }
    allowedPosConfigIds: readonly number[]
  }
  totals: {
    netSalesKwd: number
    orders: number
    aovKwd: number
    itemSalesKwd: number
    promoAdjustmentsKwd: number
    lineDiscountKwd: number
    discountsKwd: number
    productsSold: number
    restaurantNetKwd: number
    restaurantOrders: number
  }
  buckets: null
  pnl: {
    revenueKwd: number
    incomeKwd: number
    otherIncomeKwd: number
    cogsKwd: number
    opexKwd: number
    depreciationKwd: number
    ebitdaKwd: number
    operatingProfitKwd: number
    marginPct: number
    cogsPct: number
    opexPct: number
    depreciationPct: number
    postedCompany: Record<string, number>
    excludedLocations: Record<string, number>
    incomeByJournal: readonly { journal: string; amountKwd: number }[]
    saleOrders: { count: number; amountKwd: number }
    sharedCosts: {
      headOffice: OdooLocationPnl | null
      centralKitchen: OdooLocationPnl | null
    }
  }
  brands: readonly OdooBrandRecord[]
  restaurants: readonly OdooLocationRecord[]
  exhibitions: readonly OdooLocationRecord[]
  canteens: readonly OdooLocationRecord[]
  exbRegisters: readonly { id: number; name: string; location: string; netKwd: number; orders: number }[]
  channels: readonly OdooChannelRecord[]
  brandLocation: readonly { brand: OdooBrandId; location: string; netKwd: number; orders: number }[]
  brandChannel: readonly { brand: OdooBrandId; channel: OdooChannelId; netKwd: number; orders: number }[]
  cube: readonly { brand: OdooBrandId; location: string; channel: OdooChannelId; netKwd: number }[]
  topProducts: Record<string, readonly { name: string; code: string | null; qty: number; netKwd: number; avgPrice: number }[]>
  categories: Record<string, readonly { name: string; qty: number; netKwd: number }[]>
  menu: readonly OdooMenuRecord[]
  shopTender: Record<'knet' | 'card' | 'cash' | 'other', { amountKwd: number; pct: number }>
  timeProfile: {
    daily: readonly { day: string; netKwd: number; orders: number }[]
    hourly: readonly { hour: number; netKwd: number; orders: number }[]
    weekHour: readonly (readonly [number, number])[][]
  }
}

export const ODOO: OdooDatasetShape = {
  meta: {
    source: 'unlinked',
    database: '',
    serverVersion: '',
    syncedAt: '',
    period: { from: '', to: '' },
    allowedPosConfigIds: [],
  },
  totals: {
    netSalesKwd: 0,
    orders: 0,
    aovKwd: 0,
    itemSalesKwd: 0,
    promoAdjustmentsKwd: 0,
    lineDiscountKwd: 0,
    discountsKwd: 0,
    productsSold: 0,
    restaurantNetKwd: 0,
    restaurantOrders: 0,
  },
  buckets: null,
  pnl: {
    revenueKwd: 0,
    incomeKwd: 0,
    otherIncomeKwd: 0,
    cogsKwd: 0,
    opexKwd: 0,
    depreciationKwd: 0,
    ebitdaKwd: 0,
    operatingProfitKwd: 0,
    marginPct: 0,
    cogsPct: 0,
    opexPct: 0,
    depreciationPct: 0,
    postedCompany: {},
    excludedLocations: {},
    incomeByJournal: [],
    saleOrders: { count: 0, amountKwd: 0 },
    sharedCosts: { headOffice: null, centralKitchen: null },
  },
  brands: [],
  restaurants: [],
  exhibitions: [],
  canteens: [],
  exbRegisters: [],
  channels: [],
  brandLocation: [],
  brandChannel: [],
  cube: [],
  topProducts: {},
  categories: {},
  menu: [],
  shopTender: {
    knet: { amountKwd: 0, pct: 0 },
    card: { amountKwd: 0, pct: 0 },
    cash: { amountKwd: 0, pct: 0 },
    other: { amountKwd: 0, pct: 0 },
  },
  timeProfile: {
    daily: [],
    hourly: [],
    weekHour: [],
  },
}
