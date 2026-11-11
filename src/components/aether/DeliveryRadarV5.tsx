'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Lightbulb,
  RotateCcw,
  Search,
  Settings2,
  X,
  XCircle,
} from 'lucide-react'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import RECEIPTS_PROOF from '@/lib/odoo/delivery-receipts-proof.json'
import type { OdooBucketSummary } from '@/lib/odoo/live-sync-core'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { DualBrainPagePanel } from '@/components/aether/DualBrainPagePanel'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import type { GlobalPeriod } from '@/lib/aether/global-filter-engine'
import { useLang } from '@/components/aether/ui'

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const f0 = (n: number) => Math.round(safeNum(n)).toLocaleString('en-US')
const f1 = (n: number) =>
  safeNum(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtAmount = (n: number) => {
  const v = safeNum(n)
  if (v === 0) return '0'
  if (Math.abs(v) >= 100) return f0(v)
  return f1(v)
}

type ForensicStatus = 'stopped' | 'stalled' | 'active' | 'tgo-only'
type ChannelKey = 'talabat-tgo' | 'talabat-tmp' | 'keeta' | 'deliveroo' | 'jahez' | 'snoonu'
type DeliveryMode = 'Tgo' | 'TMP'
type QuickFilter =
  | 'all'
  | 'stopped'
  | 'stalled'
  | 'active'
  | 'tgo-only'
  | 'tmp-opp'
  | 'tgo'
  | 'tmp'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'gap'
type SortMode = 'forensic' | 'sales'

interface DeliverySnapshot {
  delivery: {
    platforms: {
      platform: string
      clearingKwd: number
      booked30Kwd: number
      postedCommission30Kwd: number
    }[]
    postedCommissions30: Record<string, number>
  }
}

interface ReceiptItem {
  orderId: number
  orderName: string
  posRef: string
  dateKuwait: string
  amountKwd: number
  posConfigId: number
  posConfigName: string
  paymentMethodId: number
  paymentMethodName: string
  brandId: string
}

interface ReceiptsProofShape {
  ytdWeeks?: number
  posConfigs: { id: number; name: string; location: string }[]
  paymentMethods: { id: number; name: string; uiChannel: string }[]
  storeLinks: Record<string, string>
  locChannelYtdOrders: Record<string, number>
  lastReceiptsByLocChannel: Record<string, ReceiptItem[]>
  lastReceiptsByLocBrandChannel: Record<string, ReceiptItem[]>
}

const J = JOURNEY as unknown as DeliverySnapshot
const PROOF = RECEIPTS_PROOF as unknown as ReceiptsProofShape

const TMP_STORAGE_KEY = 'vf_tmp_driver_branches_v1'
/** Monthly cost of 1 full-time Kuwait company driver + bike/fuel (KWD/mo) */
const TMP_DRIVER_MONTHLY_COST_KWD = 320
/** Commission savings spread when shifting orders from Talabat Tgo (27%) to Talabat TMP (15%) = 12% */
const TMP_COMMISSION_SAVING_SPREAD = 0.12

/** Strictly ONLY our 6 approved Venture Foods restaurant brands. */
const VF_SIX_BRANDS: readonly {
  id: string
  en: string
  ar: string
  color: string
}[] = [
  { id: 'china-garden', en: 'China Garden', ar: 'تشاينا جاردن', color: '#0284C7' },
  { id: 'franks', en: "Frank's", ar: 'فرانكس', color: '#059669' },
  { id: 'tahina', en: 'Tahina', ar: 'طحينة', color: '#D97706' },
  { id: 'farm-brown', en: 'Farm Brown', ar: 'فارم براون', color: '#EA580C' },
  { id: 'noodle-bar', en: 'The Noodle Bar', ar: 'ذا نودل بار', color: '#DC2626' },
  { id: 'karak-cafeteria', en: 'Karak Cafeteria', ar: 'كرك كافتيريا', color: '#0F172A' },
]

/** Strictly ONLY our 7 real active Odoo POS restaurant locations. */
const ACTIVE_BRANCH_META: Record<string, { order: number; en: string; ar: string }> = {
  avenues: { order: 1, en: 'The Avenues', ar: 'الأفنيوز' },
  '360-mall': { order: 2, en: '360', ar: 'مول 360' },
  assima: { order: 3, en: 'Assima', ar: 'العاصمة' },
  promenade: { order: 4, en: 'Promenade', ar: 'بروميناد' },
  salmiya: { order: 5, en: 'Salmiya', ar: 'السالمية' },
  'al-kout': { order: 6, en: 'Al-Kout', ar: 'الكوت' },
  ardiya: { order: 7, en: 'Ardiya', ar: 'مطبخ العارضية' },
}

const DELIVERY_APP_KEYS = new Set<string>([
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
])

const MONITORED_CHANNELS: readonly {
  key: ChannelKey
  platformKey: 'Talabat' | 'Keeta' | 'Deliveroo' | 'Jahez' | 'Snoonu'
  en: string
  ar: string
  defaultMode: DeliveryMode
  contractPct: number
}[] = [
  { key: 'talabat-tgo', platformKey: 'Talabat', en: 'Talabat Tgo', ar: 'طلبات Tgo', defaultMode: 'Tgo', contractPct: 27.0 },
  { key: 'talabat-tmp', platformKey: 'Talabat', en: 'Talabat TMP', ar: 'طلبات TMP (15%)', defaultMode: 'TMP', contractPct: 15.0 },
  { key: 'keeta', platformKey: 'Keeta', en: 'Keeta', ar: 'كيتا', defaultMode: 'Tgo', contractPct: 12.0 },
  { key: 'deliveroo', platformKey: 'Deliveroo', en: 'Deliveroo', ar: 'ديليفرو', defaultMode: 'Tgo', contractPct: 18.0 },
  { key: 'jahez', platformKey: 'Jahez', en: 'Jahez', ar: 'جاهز', defaultMode: 'Tgo', contractPct: 15.0 },
  { key: 'snoonu', platformKey: 'Snoonu', en: 'Snoonu', ar: 'سنونو', defaultMode: 'Tgo', contractPct: 15.0 },
]

/** Auto-detect active company-driver TMP branches from real 30-day Odoo TMP orders (`historicalTmpOrders > 0`). */
function detectDefaultTmpBranches(): string[] {
  const rawBuckets = (ODOO as unknown as { buckets?: Record<string, OdooBucketSummary> }).buckets
  const monthLocs = rawBuckets?.month?.byLocation ?? {}
  const detected: string[] = []
  for (const lid of Object.keys(ACTIVE_BRANCH_META)) {
    const tmpOrd30 = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.orders)
    if (tmpOrd30 > 0) detected.push(lid)
  }
  return detected.length > 0 ? detected : ['ardiya', 'promenade', 'salmiya', 'al-kout']
}

interface ForensicAccountRow {
  id: string
  branchId: string
  branchEn: string
  branchAr: string
  branchOrder: number
  brandId: string
  brandEn: string
  brandAr: string
  brandColor: string
  channelKey: ChannelKey
  platformEn: string
  platformAr: string
  mode: DeliveryMode
  hasDualMode?: boolean
  isTmpDriverBranch: boolean
  status: ForensicStatus
  orders: number
  salesKwd: number
  contractPct: number
  actualPct: number | null
  netKwd: number
  divertedToTgo?: boolean
  varianceKwd: number
  historicalOrders: number
  weeklyAvgOrders: number
  lastReceipt: ReceiptItem | null
  receiptsList: ReceiptItem[]
  tmpHireOpportunity: boolean
  tmpNetMonthlySavingKwd: number
  noteEn: string
  noteAr: string
}

function ModePill({ mode, dual }: { mode: DeliveryMode; dual?: boolean }) {
  if (dual) {
    return (
      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-700 whitespace-nowrap dark:bg-white/10 dark:text-slate-200">
        Tgo+TMP
      </span>
    )
  }
  if (mode === 'TMP') {
    return (
      <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 whitespace-nowrap dark:bg-sky-950/60 dark:text-sky-200">
        TMP 15%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 whitespace-nowrap dark:bg-white/10 dark:text-slate-200">
      Tgo
    </span>
  )
}

function StatusBadge({ status, isAr }: { status: ForensicStatus; isAr: boolean }) {
  if (status === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-bold text-rose-800 ring-1 ring-rose-500/20 whitespace-nowrap dark:bg-rose-950/60 dark:text-rose-200">
        <span>{isAr ? 'متوقف فعلياً 🔴' : 'Verified Stopped 🔴'}</span>
      </span>
    )
  }
  if (status === 'stalled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-bold text-amber-900 ring-1 ring-amber-500/20 whitespace-nowrap dark:bg-amber-950/60 dark:text-amber-200">
        <span>{isAr ? 'ضعيف 🟠' : 'Low 🟠'}</span>
      </span>
    )
  }
  if (status === 'tgo-only') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-bold text-slate-700 ring-1 ring-slate-400/20 whitespace-nowrap dark:bg-white/10 dark:text-slate-300">
        <span>{isAr ? 'توصيل Tgo فقط ⚪' : 'Tgo Only ⚪'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-500/20 whitespace-nowrap dark:bg-emerald-950/60 dark:text-emerald-200">
      <span>{isAr ? 'شغال 🟢' : 'Active 🟢'}</span>
    </span>
  )
}

/**
 * Dual `TMP (15%) + Tgo` Receipt-Verified Forensic Delivery Radar (`مراقبة التوصيل`)
 * - Auto-detects active company-driver TMP branches from historical Odoo TMP orders + `فروع سائقي الشركة (TMP) ⚙️` modal.
 * - Flags `متوقف فعلياً 🔴` ONLY when a channel had real historical Odoo orders (showing exact last receipt date + #POS + weekly avg) and dropped to 0.
 * - Classifies non-TMP branches cleanly as `توصيل Tgo فقط ⚪` (excluded from red Stopped count & ZERO fake negative commission gaps on 0 KWD rows).
 * - Shows `فرصة تعيين سائق TMP 💡` badge where 12% commission savings > monthly driver cost (320 KWD).
 * - Provides `توثيق السطر من أودو 🔍` proof drawer (`pos.config`, `pos.payment.method`, last 5 receipts, live store link).
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const { filters, workspace, liveSummary, setChannel } = useGlobalFilter()

  const defaultTmpBranches = useMemo(() => detectDefaultTmpBranches(), [])
  const [tmpBranches, setTmpBranches] = useState<string[]>(defaultTmpBranches)
  const [tmpModalOpen, setTmpModalOpen] = useState(false)
  const [proofRowId, setProofRowId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('forensic')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = window.localStorage.getItem(TMP_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((x): x is string => typeof x === 'string' && Boolean(ACTIVE_BRANCH_META[x]))
          setTmpBranches(valid)
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  // Sync quickFilter when user clicks global Profit Lens (`bleed` or `delivery-audit`)
  useEffect(() => {
    if (filters.lens === 'bleed') {
      setQuickFilter('stopped')
    } else if (filters.lens === 'delivery-audit') {
      setQuickFilter('gap')
    } else if (filters.lens === 'all' && (quickFilter === 'stopped' || quickFilter === 'gap')) {
      setQuickFilter('all')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.lens])

  const toggleTmpBranch = (branchId: string) => {
    setTmpBranches((prev) => {
      const next = prev.includes(branchId) ? prev.filter((x) => x !== branchId) : [...prev, branchId]
      try {
        window.localStorage.setItem(TMP_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const resetTmpBranchesToAuto = () => {
    setTmpBranches(defaultTmpBranches)
    try {
      window.localStorage.removeItem(TMP_STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
  }

  const activeTmpSet = useMemo(() => new Set(tmpBranches), [tmpBranches])

  const isNonAppChannelSelected =
    filters.channel === 'dine-in' || filters.channel === 'takeaway-direct'

  // Branch-level 30d Tgo & TMP summary for the `فروع سائقي الشركة (TMP) ⚙️` modal & opportunity badges
  const branchTmpEconomics = useMemo(() => {
    const rawBuckets = (ODOO as unknown as { buckets?: Record<string, OdooBucketSummary> }).buckets
    const monthLocs = rawBuckets?.month?.byLocation ?? {}
    const map: Record<
      string,
      {
        tgoSales30Kwd: number
        tmpSales30Kwd: number
        tmpOrders30: number
        potentialSaving12PctKwd: number
        netAfterDriverKwd: number
        recommendHireDriver: boolean
      }
    > = {}

    for (const lid of Object.keys(ACTIVE_BRANCH_META)) {
      const tgoSales30Kwd = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tgo']?.netKwd)
      const tmpSales30Kwd = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.netKwd)
      const tmpOrders30 = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.orders)
      // Realistic nearby-zone shiftable share ~65% of branch Tgo volume * 12% spread (or 12% spread on Tgo pool)
      const grossSpread12Pct = Math.round(tgoSales30Kwd * TMP_COMMISSION_SAVING_SPREAD)
      const netAfterDriverKwd = grossSpread12Pct - TMP_DRIVER_MONTHLY_COST_KWD
      map[lid] = {
        tgoSales30Kwd,
        tmpSales30Kwd,
        tmpOrders30,
        potentialSaving12PctKwd: grossSpread12Pct,
        netAfterDriverKwd,
        recommendHireDriver: !activeTmpSet.has(lid) && grossSpread12Pct > TMP_DRIVER_MONTHLY_COST_KWD,
      }
    }
    return map
  }, [activeTmpSet])

  const allPeriodRows = useMemo(() => {
    const allowedBrandMap = new Map(VF_SIX_BRANDS.map((b) => [b.id, b]))
    const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<GlobalPeriod, OdooBucketSummary>> }).buckets
    const monthBkt = liveSummary?.buckets?.month ?? rawBuckets?.month
    let activeBkt = liveSummary?.buckets?.[filters.period] ?? rawBuckets?.[filters.period]
    if (filters.period === 'today' && safeNum(activeBkt?.totals?.restaurantOrders) <= 0 && rawBuckets?.today) {
      activeBkt = rawBuckets.today
    }

    const periodScale = Math.max(0.005, safeNum(workspace.periodScale, 1))
    const periodDays = Math.max(1, safeNum(workspace.periodDays, 30))
    const ytdWeeks = Math.max(12, safeNum(PROOF.ytdWeeks, 44.9))

    // Real posted commission rates from Odoo accounting entries
    const effRateByPlatform: Record<string, number> = {
      Keeta: 12.0,
      Jahez: 15.0,
      Snoonu: 15.0,
    }
    for (const pName of ['Keeta', 'Jahez', 'Snoonu'] as const) {
      const pRow = J.delivery.platforms.find((p) => p.platform === pName)
      const posted = J.delivery.postedCommissions30[pName] ?? pRow?.postedCommission30Kwd ?? 0
      const booked = pRow?.booked30Kwd ?? 0
      if (booked > 0 && posted > 0) {
        effRateByPlatform[pName] = (posted / booked) * 100
      }
    }

    const channelAov: Record<string, number> = {}
    for (const ch of ODOO.channels) {
      channelAov[ch.id] = ch.orders > 0 ? ch.netKwd / ch.orders : 5.5
    }

    const built: ForensicAccountRow[] = []

    const activeLocations = ODOO.restaurants
      .filter((loc) => Boolean(ACTIVE_BRANCH_META[loc.id]))
      .sort((a, b) => (ACTIVE_BRANCH_META[a.id]?.order ?? 99) - (ACTIVE_BRANCH_META[b.id]?.order ?? 99))

    for (const loc of activeLocations) {
      const bMeta = ACTIVE_BRANCH_META[loc.id]
      if (!bMeta) continue
      const isTmpBranch = activeTmpSet.has(loc.id)
      const locEcon = branchTmpEconomics[loc.id]

      const calcCellOrders30 = (rawChannelId: string, cellSalesKwd: number): number => {
        if (cellSalesKwd <= 0) return 0
        const locCh = loc.channels.find((c) => c.channel === rawChannelId)
        if (locCh && locCh.amountKwd > 0 && locCh.payments > 0) {
          return Math.max(1, Math.round((cellSalesKwd / locCh.amountKwd) * locCh.payments))
        }
        const aov = channelAov[rawChannelId] || 5.5
        return Math.max(1, Math.round(cellSalesKwd / aov))
      }

      const getLocChannelScales = (uiCh: ChannelKey): { netRatio: number; ordRatio: number } => {
        if (filters.period === 'month' && filters.kuwaitSlice === 'all' && !liveSummary?.buckets?.month) {
          return { netRatio: 1, ordRatio: 1 }
        }
        const curCell = activeBkt?.byLocation?.[loc.id]?.uiChannels?.[uiCh]
        const monCell = monthBkt?.byLocation?.[loc.id]?.uiChannels?.[uiCh]
        // Incorporate Kuwait Slice factor relative to raw period
        const rawPeriodNet = safeNum(activeBkt?.totals?.restaurantNetKwd, 1)
        const sliceAdjustment =
          filters.kuwaitSlice === 'all'
            ? 1
            : Math.min(1.5, Math.max(0.12, safeNum(workspace.salesKwd) / Math.max(1, rawPeriodNet * Math.max(0.05, workspace.dimensionShare))))
        if (curCell && monCell && monCell.netKwd > 0) {
          const netRatio = Math.max(0, (safeNum(curCell.netKwd) / monCell.netKwd) * sliceAdjustment)
          const ordRatio =
            monCell.orders > 0
              ? Math.max(0, (safeNum(curCell.orders) / monCell.orders) * sliceAdjustment)
              : netRatio
          return { netRatio, ordRatio }
        }
        const curGlobal = activeBkt?.uiChannels?.[uiCh]
        const monGlobal = monthBkt?.uiChannels?.[uiCh]
        if (curGlobal && monGlobal && monGlobal.netKwd > 0) {
          const netRatio = Math.max(0, (safeNum(curGlobal.netKwd) / monGlobal.netKwd) * sliceAdjustment)
          const ordRatio =
            monGlobal.orders > 0
              ? Math.max(0, (safeNum(curGlobal.orders) / monGlobal.orders) * sliceAdjustment)
              : netRatio
          return { netRatio, ordRatio }
        }
        return { netRatio: periodScale, ordRatio: periodScale }
      }

      const branchBrands = loc.brands
        .filter((b) => allowedBrandMap.has(b.brand) && b.orders > 0)
        .sort((a, b) => b.netKwd - a.netKwd)

      const totalLocOrders30 = Math.max(1, branchBrands.reduce((s, x) => s + x.orders, 0))

      for (const bb of branchBrands) {
        const brand = allowedBrandMap.get(bb.brand)
        if (!brand) continue
        const brandOrderShare = bb.orders / totalLocOrders30

        const cubeForPair = ODOO.cube.filter((c) => c.location === loc.id && c.brand === brand.id)
        const getSales30 = (chId: string) => safeNum(cubeForPair.find((c) => c.channel === chId)?.netKwd)

        const tgoSales30 = getSales30('talabat-tgo')
        const tmpSales30 = getSales30('talabat-tmp')
        const tgoOrders30 = calcCellOrders30('talabat-tgo', tgoSales30)
        const tmpOrders30 = calcCellOrders30('talabat-tmp', tmpSales30)
        const keetaSales30 = getSales30('keeta')
        const delivGoSales30 = getSales30('deliveroo-go')
        const delivMpSales30 = getSales30('deliveroo-mp')
        const jahezSales30 = getSales30('jahez')
        const snoonuSales30 = getSales30('snoonu')

        const tgoScales = getLocChannelScales('talabat-tgo')
        const tgoPeriodSales = tgoSales30 * tgoScales.netRatio
        const tgoPeriodOrders =
          tgoPeriodSales > 0.05 ? Math.max(1, Math.round(tgoOrders30 * tgoScales.ordRatio)) : 0

        for (const ch of MONITORED_CHANNELS) {
          const scales = getLocChannelScales(ch.key)
          let sales30 = 0
          let orders30 = 0
          let mode: DeliveryMode = ch.defaultMode
          let hasDualMode = false
          let contractPct = ch.contractPct
          let actualPct: number | null = null
          let divertedToTgo = false
          let varianceKwd = 0

          if (ch.key === 'talabat-tgo') {
            sales30 = tgoSales30
            orders30 = tgoOrders30
          } else if (ch.key === 'talabat-tmp') {
            sales30 = tmpSales30
            orders30 = tmpOrders30
          } else if (ch.key === 'keeta') {
            sales30 = keetaSales30
            orders30 = calcCellOrders30('keeta', keetaSales30)
          } else if (ch.key === 'deliveroo') {
            sales30 = delivGoSales30 + delivMpSales30
            orders30 =
              calcCellOrders30('deliveroo-go', delivGoSales30) +
              calcCellOrders30('deliveroo-mp', delivMpSales30)
            if (delivGoSales30 > 0 && delivMpSales30 > 0) {
              hasDualMode = true
              mode = delivGoSales30 >= delivMpSales30 ? 'Tgo' : 'TMP'
              contractPct = (delivGoSales30 * 18.0 + delivMpSales30 * 10.0) / sales30
            } else if (delivMpSales30 > 0) {
              mode = 'TMP'
              contractPct = 10.0
            } else if (delivGoSales30 > 0) {
              mode = 'Tgo'
              contractPct = 18.0
            }
          } else if (ch.key === 'jahez') {
            sales30 = jahezSales30
            orders30 = calcCellOrders30('jahez', jahezSales30)
          } else if (ch.key === 'snoonu') {
            sales30 = snoonuSales30
            orders30 = calcCellOrders30('snoonu', snoonuSales30)
          }

          const salesKwd = Math.max(0, Math.round(sales30 * scales.netRatio * 1000) / 1000)
          const orders =
            salesKwd > 0.05 && orders30 > 0
              ? Math.max(1, Math.round(orders30 * scales.ordRatio))
              : 0

          // Lookup real historical Odoo receipts for this exact (branch, brand, channel)
          const tripleKey = `${loc.id}|${brand.id}|${ch.key}`
          const pairKey = `${loc.id}|${ch.key}`
          const brandReceipts = PROOF.lastReceiptsByLocBrandChannel?.[tripleKey] ?? []
          const locReceipts = PROOF.lastReceiptsByLocChannel?.[pairKey] ?? []
          const ytdLocOrders = safeNum(PROOF.locChannelYtdOrders?.[pairKey])

          const historicalOrders =
            orders30 > 0
              ? Math.max(orders30, brandReceipts.length)
              : brandReceipts.length > 0
                ? Math.max(brandReceipts.length, Math.round(ytdLocOrders * brandOrderShare))
                : 0

          const lastReceipt: ReceiptItem | null = brandReceipts[0] ?? null
          const receiptsList: ReceiptItem[] = brandReceipts.length > 0 ? brandReceipts : locReceipts

          const weeklyAvgOrders =
            orders30 > 0
              ? Math.max(0.5, Math.round((orders30 / 4.3) * 10) / 10)
              : historicalOrders > 0
                ? Math.max(0.2, Math.round((historicalOrders / ytdWeeks) * 10) / 10)
                : 0

          // Commission & Variance Rules — STRICTLY ZERO fake negative commission gaps on 0 KWD rows!
          if (salesKwd > 0) {
            if (ch.key === 'talabat-tgo') {
              actualPct = 27.0
            } else if (ch.key === 'talabat-tmp') {
              actualPct = 15.0
              const talabatTotal = tgoPeriodSales + salesKwd
              if (isTmpBranch && tgoPeriodSales > 500 * scales.netRatio && talabatTotal > 0 && salesKwd / talabatTotal < 0.12) {
                divertedToTgo = true
                // Only compute variance against actual positive TMP/Talabat flow when active
                varianceKwd = Math.max(0, tgoPeriodSales * 0.25 - salesKwd) * TMP_COMMISSION_SAVING_SPREAD
              }
            } else if (ch.key === 'keeta') {
              actualPct = effRateByPlatform.Keeta
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            } else if (ch.key === 'deliveroo') {
              actualPct = contractPct
            } else if (ch.key === 'jahez') {
              actualPct = effRateByPlatform.Jahez
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            } else if (ch.key === 'snoonu') {
              actualPct = effRateByPlatform.Snoonu
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          } else {
            // 0 KWD row -> strictly ZERO variance and null actualPct!
            actualPct = null
            varianceKwd = 0
            divertedToTgo = false
          }

          varianceKwd = salesKwd > 0 ? Math.max(0, Math.round(safeNum(varianceKwd) * 1000) / 1000) : 0
          const appliedCommissionPct = actualPct !== null ? actualPct : contractPct
          const netKwd =
            salesKwd > 0
              ? Math.max(0, Math.round(salesKwd * (1 - appliedCommissionPct / 100) * 1000) / 1000)
              : 0

          // Separate `فرصة تعيين سائق TMP 💡` badge where 12% savings on Tgo > 320 KWD driver cost
          const pairMonthlyTgoSaving12Pct = Math.round(tgoSales30 * TMP_COMMISSION_SAVING_SPREAD)
          const branchQualifiesForTmpHire = Boolean(locEcon?.recommendHireDriver)
          const tmpHireOpportunity =
            ch.key === 'talabat-tmp' &&
            !isTmpBranch &&
            branchQualifiesForTmpHire &&
            tgoSales30 >= 1200

          const tmpNetMonthlySavingKwd = tmpHireOpportunity
            ? Math.max(40, locEcon?.netAfterDriverKwd ?? pairMonthlyTgoSaving12Pct - TMP_DRIVER_MONTHLY_COST_KWD)
            : 0

          // Forensic Status Classification:
          // Flag `متوقف فعلياً 🔴` ONLY when channel had real historical Odoo orders AND dropped to 0!
          // Non-TMP branches on `talabat-tmp` (and 0-history uncontracted channels) -> `توصيل Tgo فقط ⚪`!
          const lowOrderThreshold = Math.max(1, Math.round(0.45 * periodDays))
          let status: ForensicStatus = 'active'
          let noteAr = 'يعمل بشكل طبيعي'
          let noteEn = 'Running normally'

          if (orders === 0) {
            if (ch.key === 'talabat-tmp' && !isTmpBranch) {
              status = 'tgo-only'
              if (loc.id === 'avenues') {
                noteAr = 'فرع صالة فقط بالأفنيوز — بدون توصيل'
                noteEn = 'Dine-in food court branch — no delivery'
              } else {
                noteAr = 'الفرع يعمل بنظام توصيل Tgo فقط (بدون سائق شركة)'
                noteEn = 'Branch operates on Talabat Tgo only (no company driver)'
              }
            } else if (historicalOrders > 0 && lastReceipt) {
              status = 'stopped'
              noteAr = `آخر فاتورة في أودو: ${lastReceipt.dateKuwait} • #${lastReceipt.orderName} • المعدل الأسبوعي ${weeklyAvgOrders} طلب`
              noteEn = `Last Odoo receipt: ${lastReceipt.dateKuwait} • #${lastReceipt.orderName} • Weekly avg ${weeklyAvgOrders}`
            } else {
              // Channel never had historical Odoo orders for this brand×branch (e.g., Avenues or uncontracted brand-app)
              status = 'tgo-only'
              if (loc.id === 'avenues') {
                noteAr = 'فرع صالة فقط بالأفنيوز — 0 طلبات تاريخية'
                noteEn = 'Dine-in only at The Avenues — 0 historical orders'
              } else {
                noteAr = 'غير مفعل تاريخياً بأودو — توصيل عبر القنوات النشطة'
                noteEn = 'Never activated in Odoo — served via active channels'
              }
            }
          } else if (
            orders <= lowOrderThreshold ||
            (ch.key === 'talabat-tmp' &&
              isTmpBranch &&
              tgoPeriodOrders >= Math.max(2, Math.round(0.8 * periodDays)) &&
              orders / (orders + tgoPeriodOrders) < 0.12)
          ) {
            status = 'stalled'
            if (ch.key === 'talabat-tmp' && isTmpBranch && tgoPeriodOrders > 0) {
              noteAr = 'نطاق سائق الشركة TMP مقيد لصالح Tgo الأعلى عمولة'
              noteEn = 'Company-driver TMP zone restricted in favor of Tgo'
            } else {
              noteAr = `طلبات قليلة (${f0(orders)} طلب) — المعدل الأسبوعي ${weeklyAvgOrders}`
              noteEn = `Low volume (${f0(orders)} orders) — weekly avg ${weeklyAvgOrders}`
            }
          } else if (actualPct !== null && actualPct > contractPct + 0.5) {
            noteAr = `خصم فعلي ${f1(actualPct)}% أعلى من نسبة العقد`
            noteEn = `Actual cut ${f1(actualPct)}% above contract rate`
          }

          built.push({
            id: `${loc.id}__${brand.id}__${ch.key}`,
            branchId: loc.id,
            branchEn: bMeta.en,
            branchAr: bMeta.ar,
            branchOrder: bMeta.order,
            brandId: brand.id,
            brandEn: brand.en,
            brandAr: brand.ar,
            brandColor: brand.color,
            channelKey: ch.key,
            platformEn: ch.en,
            platformAr: ch.ar,
            mode,
            hasDualMode,
            isTmpDriverBranch: isTmpBranch,
            status,
            orders,
            salesKwd,
            contractPct,
            actualPct,
            netKwd,
            divertedToTgo,
            varianceKwd,
            historicalOrders,
            weeklyAvgOrders,
            lastReceipt,
            receiptsList,
            tmpHireOpportunity,
            tmpNetMonthlySavingKwd,
            noteEn,
            noteAr,
          })
        }
      }
    }

    return built
  }, [
    activeTmpSet,
    branchTmpEconomics,
    filters.kuwaitSlice,
    filters.period,
    liveSummary,
    workspace.dimensionShare,
    workspace.periodDays,
    workspace.periodScale,
    workspace.salesKwd,
  ])

  // Apply global TopFilterBar filters (brand, branch, channel)
  const globalScopedRows = useMemo(() => {
    if (isNonAppChannelSelected) return []
    return allPeriodRows.filter((r) => {
      if (filters.brand !== 'all' && r.brandId !== filters.brand) return false
      if (filters.branch !== 'all' && r.branchId !== filters.branch) return false
      if (filters.channel !== 'all' && DELIVERY_APP_KEYS.has(filters.channel) && r.channelKey !== filters.channel) {
        return false
      }
      return true
    })
  }, [allPeriodRows, filters.brand, filters.branch, filters.channel, isNonAppChannelSelected])

  const summary = useMemo(() => {
    const stoppedCount = globalScopedRows.filter((r) => r.status === 'stopped').length
    const stalledCount = globalScopedRows.filter((r) => r.status === 'stalled').length
    const activeCount = globalScopedRows.filter((r) => r.status === 'active').length
    const tgoOnlyCount = globalScopedRows.filter((r) => r.status === 'tgo-only').length
    const tmpOppCount = globalScopedRows.filter((r) => r.tmpHireOpportunity).length
    const tgoCount = globalScopedRows.filter((r) => r.channelKey === 'talabat-tgo').length
    const tmpCount = globalScopedRows.filter((r) => r.channelKey === 'talabat-tmp').length
    const keetaCount = globalScopedRows.filter((r) => r.channelKey === 'keeta').length
    const deliverooCount = globalScopedRows.filter((r) => r.channelKey === 'deliveroo').length
    const jahezCount = globalScopedRows.filter((r) => r.channelKey === 'jahez').length
    const gapCount = globalScopedRows.filter(
      (r) => r.salesKwd > 0 && (r.varianceKwd > 0.05 || r.divertedToTgo || (r.actualPct !== null && r.actualPct > r.contractPct + 0.3)),
    ).length
    const totalOrders = globalScopedRows.reduce((s, r) => s + r.orders, 0)
    const totalSalesKwd = globalScopedRows.reduce((s, r) => s + r.salesKwd, 0)
    const totalNetKwd = globalScopedRows.reduce((s, r) => s + r.netKwd, 0)
    const totalVarianceKwd = globalScopedRows.reduce((s, r) => s + r.varianceKwd, 0)

    return {
      totalAccounts: globalScopedRows.length,
      stoppedCount,
      stalledCount,
      activeCount,
      tgoOnlyCount,
      tmpOppCount,
      tgoCount,
      tmpCount,
      keetaCount,
      deliverooCount,
      jahezCount,
      gapCount,
      totalOrders,
      totalSalesKwd,
      totalNetKwd,
      totalVarianceKwd,
    }
  }, [globalScopedRows])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const statusWeight: Record<ForensicStatus, number> = {
      stopped: 0,
      stalled: 1,
      active: 2,
      'tgo-only': 3,
    }

    return globalScopedRows
      .filter((r) => {
        if (quickFilter === 'stopped' && r.status !== 'stopped') return false
        if (quickFilter === 'stalled' && r.status !== 'stalled') return false
        if (quickFilter === 'active' && r.status !== 'active') return false
        if (quickFilter === 'tgo-only' && r.status !== 'tgo-only') return false
        if (quickFilter === 'tmp-opp' && !r.tmpHireOpportunity) return false
        if (quickFilter === 'tgo' && r.channelKey !== 'talabat-tgo') return false
        if (quickFilter === 'tmp' && r.channelKey !== 'talabat-tmp') return false
        if (quickFilter === 'keeta' && r.channelKey !== 'keeta') return false
        if (quickFilter === 'deliveroo' && r.channelKey !== 'deliveroo') return false
        if (quickFilter === 'jahez' && r.channelKey !== 'jahez') return false
        if (
          quickFilter === 'gap' &&
          !(r.salesKwd > 0 && (r.varianceKwd > 0.05 || r.divertedToTgo || (r.actualPct !== null && r.actualPct > r.contractPct + 0.3)))
        ) {
          return false
        }
        if (!q) return true
        const hay = `${r.brandEn} ${r.brandAr} ${r.branchEn} ${r.branchAr} ${r.platformEn} ${r.platformAr} ${r.noteEn} ${r.noteAr}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        if (sortMode === 'sales') {
          return b.salesKwd - a.salesKwd || b.varianceKwd - a.varianceKwd
        }
        return (
          statusWeight[a.status] - statusWeight[b.status] ||
          Number(b.tmpHireOpportunity) - Number(a.tmpHireOpportunity) ||
          b.varianceKwd - a.varianceKwd ||
          a.branchOrder - b.branchOrder ||
          b.salesKwd - a.salesKwd
        )
      })
  }, [globalScopedRows, quickFilter, searchQuery, sortMode])

  const proofRow = useMemo(
    () => (proofRowId ? allPeriodRows.find((r) => r.id === proofRowId) ?? null : null),
    [allPeriodRows, proofRowId],
  )

  const proofPosConfigs = useMemo(() => {
    if (!proofRow) return []
    return (PROOF.posConfigs ?? []).filter((c) => c.location === proofRow.branchId)
  }, [proofRow])

  const proofPaymentMethods = useMemo(() => {
    if (!proofRow) return []
    return (PROOF.paymentMethods ?? []).filter((pm) => pm.uiChannel === proofRow.channelKey)
  }, [proofRow])

  const hasLocalFilters = quickFilter !== 'all' || searchQuery.trim() !== ''

  const resetLocalFilters = () => {
    setQuickFilter('all')
    setSearchQuery('')
  }

  const buildRowAlertMessage = (r: ForensicAccountRow) => {
    const statusLabelAr =
      r.status === 'stopped'
        ? 'متوقف فعلياً 🔴'
        : r.status === 'stalled'
          ? 'ضعيف 🟠'
          : r.status === 'tgo-only'
            ? 'توصيل Tgo فقط ⚪'
            : 'شغال 🟢'
    const statusLabelEn =
      r.status === 'stopped'
        ? 'Verified Stopped 🔴'
        : r.status === 'stalled'
          ? 'Low 🟠'
          : r.status === 'tgo-only'
            ? 'Tgo Only ⚪'
            : 'Active 🟢'

    if (isAr) {
      return [
        `متابعة توصيل (${workspace.subtitleAr})`,
        `• الفرع: ${r.branchAr}`,
        `• المطعم: ${r.brandAr}`,
        `• التطبيق: ${r.platformAr}`,
        `• الحالة: ${statusLabelAr} (${r.noteAr})`,
        `• الطلبات: ${f0(r.orders)} | المبيعات: ${fmtAmount(r.salesKwd)} د.ك | الصافي: ${fmtAmount(r.netKwd)} د.ك`,
        r.tmpHireOpportunity ? `• فرصة تعيين سائق TMP 💡: وفر صافي +${f0(r.tmpNetMonthlySavingKwd)} د.ك/شهر` : null,
        r.varianceKwd > 0.05 ? `• الفرق: -${fmtAmount(r.varianceKwd)} د.ك` : null,
      ]
        .filter(Boolean)
        .join('\n')
    }
    return [
      `Delivery Check (${workspace.subtitleEn})`,
      `• Branch: ${r.branchEn}`,
      `• Brand: ${r.brandEn}`,
      `• App: ${r.platformEn}`,
      `• Status: ${statusLabelEn} (${r.noteEn})`,
      `• Orders: ${f0(r.orders)} | Sales: ${fmtAmount(r.salesKwd)} KWD | Net: ${fmtAmount(r.netKwd)} KWD`,
      r.tmpHireOpportunity ? `• TMP Driver Opportunity 💡: +${f0(r.tmpNetMonthlySavingKwd)} KWD/mo net saving` : null,
      r.varianceKwd > 0.05 ? `• Gap: -${fmtAmount(r.varianceKwd)} KWD` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  const copyRowAlert = async (r: ForensicAccountRow) => {
    try {
      await navigator.clipboard.writeText(buildRowAlertMessage(r))
      setCopiedId(r.id)
      setTimeout(() => setCopiedId((prev) => (prev === r.id ? null : prev)), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const exportCsv = () => {
    const headers = [
      'Branch',
      'Brand',
      'App',
      'Status',
      'Historical_Orders',
      'Orders',
      'Sales_KWD',
      'Contract_Pct',
      'Actual_Pct',
      'Net_KWD',
      'Variance_KWD',
      'Note',
    ]
    const csvLines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          `"${isAr ? r.branchAr : r.branchEn}"`,
          `"${isAr ? r.brandAr : r.brandEn}"`,
          `"${isAr ? r.platformAr : r.platformEn}"`,
          `"${r.status === 'stopped' ? (isAr ? 'متوقف فعلياً' : 'Verified Stopped') : r.status === 'stalled' ? (isAr ? 'ضعيف' : 'Low') : r.status === 'tgo-only' ? (isAr ? 'توصيل Tgo فقط' : 'Tgo Only') : isAr ? 'شغال' : 'Active'}"`,
          r.historicalOrders,
          r.orders,
          r.salesKwd.toFixed(3),
          r.contractPct.toFixed(1),
          r.actualPct !== null ? r.actualPct.toFixed(1) : '0.0',
          r.netKwd.toFixed(3),
          r.varianceKwd.toFixed(3),
          `"${(isAr ? r.noteAr : r.noteEn).replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `delivery-radar-${filters.period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* Finance V2 Executive Masthead */}
      <header className="ae-bento-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
            {T('Delivery Radar', 'مراقبة التوصيل')}
          </h1>
          <p className="text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTmpModalOpen(true)}
            className="ae-bento-subcard inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[12.5px] font-extrabold text-sky-900 ring-1 ring-sky-500/20 transition duration-150 hover:bg-sky-50 dark:text-sky-200 dark:ring-sky-400/25 dark:hover:bg-sky-950/40"
          >
            <Settings2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>{T('Company Driver Branches (TMP) ⚙️', 'فروع سائقي الشركة (TMP) ⚙️')}</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-black tabular-nums text-sky-900 dark:bg-sky-900/70 dark:text-sky-100">
              {tmpBranches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="ae-bento-subcard inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[12.5px] font-bold text-slate-900 transition duration-150 hover:opacity-90 dark:text-white"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {T('Export CSV', 'تحميل الجدول')}
          </button>
        </div>
      </header>

      {/* 1-Click Dual-Brain Delivery Radar Readout */}
      <DualBrainPagePanel
        pageTitleAr="مراقبة التوصيل"
        pageTitleEn="Delivery Radar"
        promptAr="راجع الحسابات المتوقفة فعلياً (بإثبات آخر فاتورة أودو) وفرص تعيين سائق TMP (15%) مقابل Tgo، وعطني خطة فورية."
        promptEn="Audit verified stopped delivery accounts (with Odoo receipt proof) and TMP (15%) company-driver opportunities vs Tgo."
        pageContext={`حسابات التوصيل (${summary.totalAccounts} سطر): متوقف فعلياً بإثبات فاتورة أودو 🔴 (${summary.stoppedCount}) | ضعيف 🟠 (${summary.stalledCount}) | شغال 🟢 (${summary.activeCount}) | توصيل Tgo فقط ⚪ (${summary.tgoOnlyCount}) | فرص تعيين سائق TMP 💡 (${summary.tmpOppCount}). مبيعات التوصيل: ${fmtAmount(summary.totalSalesKwd)} د.ك (${f0(summary.totalOrders)} طلب) | الصافي بعد العمولة: ${fmtAmount(summary.totalNetKwd)} د.ك | فروقات عمولة فعلية: ${fmtAmount(summary.totalVarianceKwd)} د.ك.`}
      />

      {/* Non-App Channel Helper Banner */}
      {isNonAppChannelSelected ? (
        <div className="ae-bento-card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">
            {T(
              'You selected an in-store or direct channel. Switch channel to view delivery apps.',
              'القناة المختارة حالياً هي الصالة أو السفري المباشر. لعرض تطبيقات التوصيل اضغط الزر التالي.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setChannel('all')}
            className="ae-btn-primary rounded-full px-4 py-2 text-[12.5px] font-bold transition duration-150 hover:opacity-95"
          >
            {T('Show All Apps', 'عرض كل القنوات')}
          </button>
        </div>
      ) : null}

      {/* 4 Top Status KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ae-kpi-card p-5">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-slate-600 dark:text-slate-300">
            <span>{T('Verified Stopped', 'متوقف فعلياً 🔴')}</span>
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
              {summary.stoppedCount}
            </span>
            <span className="text-[12px] font-medium text-slate-400 dark:text-slate-400">
              · {summary.tgoOnlyCount} {T('Tgo Only ⚪', 'توصيل Tgo فقط ⚪')}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            {T(
              'Had real Odoo receipts and dropped to zero (Tgo-only excluded).',
              'كان عليها فواتير فعلية بأودو وتوقفت إلى صفر (مع عزل Tgo فقط).',
            )}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-slate-600 dark:text-slate-300">
            <span>{T('Low & TMP Upside', 'حسابات ضعيفة وفرص TMP')}</span>
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
              {summary.stalledCount}
            </span>
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              · {summary.tmpOppCount} {T('TMP Driver 💡', 'فرصة سائق TMP 💡')}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            {T(
              `${summary.activeCount} active 🟢 · 12% TMP spread beats driver cost.`,
              `${summary.activeCount} شغال 🟢 · وفر ١٢٪ بـ TMP يغطي راتب السائق.`,
            )}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-slate-600 dark:text-slate-300">
            <span>{T('Delivery Sales', 'مبيعات التوصيل')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div dir="ltr" className="mt-2 flex items-baseline gap-2 text-[26px] font-extrabold tabular-nums text-slate-950 dark:text-white">
            <span>
              {fmtAmount(summary.totalSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            {T(
              `${f0(summary.totalOrders)} orders · Net ${fmtAmount(summary.totalNetKwd)} KWD.`,
              `${f0(summary.totalOrders)} طلب · الصافي بعد العمولة ${fmtAmount(summary.totalNetKwd)} د.ك.`,
            )}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-slate-600 dark:text-slate-300">
            <span>{T('Commission Gap', 'فرق العمولات الفعلي')}</span>
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div dir="ltr" className="mt-2 text-[26px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
            {summary.totalVarianceKwd > 0.05 ? `-${fmtAmount(summary.totalVarianceKwd)}` : '0'} {isAr ? 'د.ك' : 'KWD'}
          </div>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            {T(
              'Verified fee variance on active sales only (0 fake gaps on 0 KWD rows).',
              'فروقات عمولة محققة على المبيعات الفعلية فقط (صفر فجوات وهمية).',
            )}
          </p>
        </div>
      </section>

      {/* Single Unified Forensic Delivery Radar Table */}
      <section className="ae-bento-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="overflow-x-auto pb-0.5">
            <SlidingPillTabs<QuickFilter>
              value={quickFilter}
              onChange={setQuickFilter}
              size="sm"
              ariaLabel={T('Delivery Quick Filter', 'فلتر سريع للتوصيل')}
              options={[
                { id: 'all', label: isAr ? 'الكل' : 'All', badge: summary.totalAccounts },
                { id: 'stopped', label: isAr ? 'متوقف فعلياً 🔴' : 'Stopped 🔴', badge: summary.stoppedCount },
                { id: 'stalled', label: isAr ? 'ضعيف 🟠' : 'Low 🟠', badge: summary.stalledCount },
                { id: 'active', label: isAr ? 'شغال 🟢' : 'Active 🟢', badge: summary.activeCount },
                { id: 'tgo-only', label: isAr ? 'توصيل Tgo فقط ⚪' : 'Tgo Only ⚪', badge: summary.tgoOnlyCount },
                { id: 'tmp-opp', label: isAr ? 'فرصة سائق TMP 💡' : 'TMP Hire 💡', badge: summary.tmpOppCount },
                { id: 'tgo', label: isAr ? 'طلبات Tgo' : 'Talabat Tgo', badge: summary.tgoCount },
                { id: 'tmp', label: isAr ? 'طلبات TMP' : 'Talabat TMP', badge: summary.tmpCount },
                { id: 'keeta', label: isAr ? 'كيتا' : 'Keeta', badge: summary.keetaCount },
                { id: 'gap', label: isAr ? 'فروقات عمولة' : 'Fee Gaps', badge: summary.gapCount },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[205px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={T('Search branch, brand, app…', 'ابحث بالفرع أو المطعم أو التطبيق…')}
                className="ae-bento-subcard h-9 w-full rounded-full ps-8 pe-3 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-white"
              />
            </div>

            <SlidingPillTabs<SortMode>
              value={sortMode}
              onChange={setSortMode}
              size="sm"
              ariaLabel={T('Sort', 'الترتيب')}
              options={[
                { id: 'forensic', label: T('Stopped First', 'المتوقف أولاً') },
                { id: 'sales', label: T('Highest Sales', 'الأعلى مبيعات') },
              ]}
            />

            {hasLocalFilters ? (
              <button
                type="button"
                onClick={resetLocalFilters}
                className="ae-btn-primary inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-bold transition duration-150 hover:opacity-95"
              >
                <RotateCcw className="h-3 w-3" />
                {T('All', 'الكل')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Forensic Table: الفرع | المطعم | التطبيق | الحالة | الطلبات | المبيعات | العمولة | الصافي | الفرق والتوثيق */}
        <div className="max-h-[680px] overflow-auto rounded-2xl ring-1 ring-slate-950/[0.04] dark:ring-white/[0.06]">
          <table className="w-full min-w-[1040px] border-collapse bg-white text-[13px] dark:bg-[#111A22]">
            <thead className="sticky top-0 z-10 bg-[#F4F6F9] text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:bg-[#0C141B] dark:text-slate-300 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
              <tr>
                <th className="px-4 py-3 text-start text-[12px] font-bold whitespace-nowrap">
                  {T('Branch', 'الفرع')}
                </th>
                <th className="px-4 py-3 text-start text-[12px] font-bold whitespace-nowrap">
                  {T('Brand', 'المطعم')}
                </th>
                <th className="px-4 py-3 text-start text-[12px] font-bold whitespace-nowrap">
                  {T('App', 'التطبيق')}
                </th>
                <th className="px-4 py-3 text-start text-[12px] font-bold whitespace-nowrap">
                  {T('Status', 'الحالة')}
                </th>
                <th className="px-4 py-3 text-end text-[12px] font-bold whitespace-nowrap">
                  {T('Orders', 'الطلبات')}
                </th>
                <th className="px-4 py-3 text-end text-[12px] font-bold whitespace-nowrap">
                  {T('Sales', 'المبيعات')}
                </th>
                <th className="px-4 py-3 text-center text-[12px] font-bold whitespace-nowrap">
                  {T('Commission', 'العمولة')}
                </th>
                <th className="px-4 py-3 text-end text-[12px] font-bold whitespace-nowrap">
                  {T('Net', 'الصافي')}
                </th>
                <th className="px-4 py-3 text-end text-[12px] font-bold whitespace-nowrap">
                  {T('Gap & Proof', 'الفرق والتوثيق')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                    {T('No accounts match your filter.', 'لا توجد حسابات تطابق الاختيار الحالي.')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const hasCommissionGap =
                    r.salesKwd > 0 && r.actualPct !== null && r.actualPct > r.contractPct + 0.3
                  const rowBg =
                    r.status === 'stopped'
                      ? 'bg-rose-50/30 hover:bg-rose-50/55 dark:bg-rose-950/15 dark:hover:bg-rose-950/25'
                      : r.status === 'stalled'
                        ? 'bg-amber-50/20 hover:bg-amber-50/45 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
                        : r.status === 'tgo-only'
                          ? 'bg-slate-50/45 hover:bg-slate-100/60 dark:bg-white/[0.015] dark:hover:bg-white/[0.04]'
                          : 'hover:bg-emerald-50/30 dark:hover:bg-emerald-500/[0.05]'

                  return (
                    <tr key={r.id} className={`transition-colors duration-150 ${rowBg}`}>
                      {/* 1. الفرع */}
                      <td className="px-4 py-3 font-bold text-neutral-900 whitespace-nowrap dark:text-white">
                        {isAr ? r.branchAr : r.branchEn}
                      </td>

                      {/* 2. المطعم */}
                      <td className="px-4 py-3 font-semibold text-neutral-800 whitespace-nowrap dark:text-slate-200">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.brandColor }} />
                          <span>{isAr ? r.brandAr : r.brandEn}</span>
                        </span>
                      </td>

                      {/* 3. التطبيق */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {isAr ? r.platformAr : r.platformEn}
                          </span>
                          <ModePill mode={r.mode} dual={r.hasDualMode} />
                        </div>
                      </td>

                      {/* 4. الحالة + فرصة تعيين سائق TMP 💡 */}
                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={r.status} isAr={isAr} />
                            {r.tmpHireOpportunity ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-950 ring-1 ring-amber-500/30 whitespace-nowrap dark:bg-amber-500/20 dark:text-amber-200">
                                <span>
                                  {isAr
                                    ? `فرصة تعيين سائق TMP 💡 (+${f0(r.tmpNetMonthlySavingKwd)} د.ك/ش)`
                                    : `Hire TMP Driver 💡 (+${f0(r.tmpNetMonthlySavingKwd)} KWD/mo)`}
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11.5px] font-medium text-neutral-500 dark:text-slate-400">
                            {isAr ? r.noteAr : r.noteEn}
                          </span>
                        </div>
                      </td>

                      {/* 5. الطلبات */}
                      <td
                        dir="ltr"
                        className={`px-4 py-3 text-end font-extrabold tabular-nums whitespace-nowrap ${
                          r.status === 'stopped'
                            ? 'text-rose-700 dark:text-rose-400'
                            : r.status === 'tgo-only'
                              ? 'text-slate-400 dark:text-slate-500'
                              : r.status === 'stalled'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-neutral-900 dark:text-white'
                        }`}
                      >
                        {f0(r.orders)}
                      </td>

                      {/* 6. المبيعات */}
                      <td dir="ltr" className="px-4 py-3 text-end font-semibold tabular-nums text-neutral-800 whitespace-nowrap dark:text-slate-200">
                        {fmtAmount(r.salesKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </td>

                      {/* 7. العمولة */}
                      <td dir="ltr" className="px-4 py-3 text-center whitespace-nowrap">
                        {r.actualPct === null ? (
                          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-slate-300">
                            {f1(r.contractPct)}%
                          </span>
                        ) : hasCommissionGap || r.divertedToTgo ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums text-rose-800 ring-1 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200">
                            {f1(r.contractPct)}% → {f1(r.actualPct)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {f1(r.actualPct)}%
                          </span>
                        )}
                      </td>

                      {/* 8. الصافي */}
                      <td dir="ltr" className="px-4 py-3 text-end font-bold tabular-nums text-emerald-800 whitespace-nowrap dark:text-emerald-300">
                        {fmtAmount(r.netKwd)} {isAr ? 'د.ك' : 'KWD'}
                      </td>

                      {/* 9. الفرق + توثيق السطر من أودو 🔍 + نسخ للواتساب */}
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span dir="ltr" className="me-1 font-extrabold tabular-nums">
                            {r.salesKwd > 0 && r.varianceKwd > 0.05 ? (
                              <span className="text-rose-700 dark:text-rose-400">
                                -{fmtAmount(r.varianceKwd)} {isAr ? 'د.ك' : 'KWD'}
                              </span>
                            ) : (
                              <span className="font-medium text-neutral-400 dark:text-slate-500">0</span>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => setProofRowId(r.id)}
                            title={T('Verify Row in Odoo 🔍', 'توثيق السطر من أودو 🔍')}
                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-sky-50 px-2.5 text-[11px] font-extrabold text-sky-900 ring-1 ring-sky-500/20 transition duration-150 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-400/25"
                          >
                            <FileSearch className="h-3 w-3" />
                            <span>{T('Odoo Proof 🔍', 'توثيق السطر من أودو 🔍')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void copyRowAlert(r)}
                            title={T('Copy for WhatsApp', 'نسخ للواتساب')}
                            aria-label={T('Copy for WhatsApp', 'نسخ للواتساب')}
                            className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition duration-150 ${
                              copiedId === r.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#F4F6F9] text-slate-600 hover:bg-[#0B1220] hover:text-white dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#10B981] dark:hover:text-[#04130D]'
                            }`}
                          >
                            {copiedId === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal 1: `فروع سائقي الشركة (TMP) ⚙️` Toggle Modal (localStorage) */}
      {mounted && tmpModalOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={T('Company Driver Branches (TMP)', 'فروع سائقي الشركة (TMP)')}
              dir={isAr ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
              onClick={() => setTmpModalOpen(false)}
            >
              <div
                className="ae-bento-card max-h-[88vh] w-full max-w-xl overflow-y-auto p-5 shadow-2xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
                  <div className="space-y-1">
                    <h2 className="text-[18px] font-extrabold text-slate-950 dark:text-white">
                      {T('Company Driver Branches (TMP 15%) ⚙️', 'فروع سائقي الشركة (TMP 15%) ⚙️')}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {T(
                        'Designate branches running in-house TMP drivers. Non-TMP branches are cleanly classified as Tgo Only ⚪.',
                        'حدد الفروع التي يعمل بها سائقو الشركة على نظام TMP (15%). الفروع غير المحددة تُصنف تلقائياً «توصيل Tgo فقط ⚪».',
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTmpModalOpen(false)}
                    className="ae-bento-subcard inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 dark:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {Object.entries(ACTIVE_BRANCH_META)
                    .sort((a, b) => a[1].order - b[1].order)
                    .map(([lid, meta]) => {
                      const checked = activeTmpSet.has(lid)
                      const econ = branchTmpEconomics[lid]
                      return (
                        <label
                          key={lid}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3 ring-1 transition ${
                            checked
                              ? 'bg-emerald-50/70 ring-emerald-500/35 dark:bg-emerald-950/35 dark:ring-emerald-400/30'
                              : 'ae-bento-subcard ring-slate-900/[0.06] dark:ring-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTmpBranch(lid)}
                              className="h-4 w-4 accent-emerald-600"
                            />
                            <div>
                              <div className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                                {isAr ? meta.ar : meta.en}
                              </div>
                              <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                {isAr
                                  ? `طلبات TMP آخر ٣٠ يوم: ${f0(econ?.tmpOrders30 ?? 0)} • مبيعات Tgo: ${f0(econ?.tgoSales30Kwd ?? 0)} د.ك`
                                  : `30d TMP orders: ${f0(econ?.tmpOrders30 ?? 0)} • Tgo sales: ${f0(econ?.tgoSales30Kwd ?? 0)} KWD`}
                              </div>
                            </div>
                          </div>

                          {checked ? (
                            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                              {isAr ? 'سائق شركة نشط' : 'Active TMP'}
                            </span>
                          ) : econ?.recommendHireDriver ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-950 dark:bg-amber-500/20 dark:text-amber-200">
                              {isAr
                                ? `فرصة سائق 💡 (+${f0(econ.netAfterDriverKwd)} د.ك)`
                                : `Hire Driver 💡 (+${f0(econ.netAfterDriverKwd)} KWD)`}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                              {isAr ? 'Tgo فقط ⚪' : 'Tgo Only ⚪'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={resetTmpBranchesToAuto}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{T('Auto-Detect from Odoo', 'اكتشاف تلقائي من أودو')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTmpModalOpen(false)}
                    className="ae-btn-primary inline-flex h-9 cursor-pointer items-center rounded-full px-4 text-[12.5px] font-bold"
                  >
                    {T('Save & Close', 'حفظ وإغلاق')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Modal 2: `توثيق السطر من أودو 🔍` Proof Drawer (`pos.config`, `pos.payment.method`, last 5 receipts, live store link) */}
      {mounted && proofRow
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={T('Odoo Row Proof', 'توثيق السطر من أودو')}
              dir={isAr ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[125] flex justify-end bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setProofRowId(null)}
            >
              <div
                className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-6 dark:bg-[#0E161E]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={proofRow.status} isAr={isAr} />
                      <ModePill mode={proofRow.mode} dual={proofRow.hasDualMode} />
                    </div>
                    <h2 className="text-[18px] font-extrabold text-slate-950 dark:text-white">
                      {isAr
                        ? `${proofRow.branchAr} • ${proofRow.brandAr} • ${proofRow.platformAr}`
                        : `${proofRow.branchEn} • ${proofRow.brandEn} • ${proofRow.platformEn}`}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {isAr ? proofRow.noteAr : proofRow.noteEn}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProofRowId(null)}
                    className="ae-bento-subcard inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 dark:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* 1. Odoo pos.config Registers */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '١. نقاط الكاشير المعتمدة (pos.config)' : '1. Whitelisted POS Registers (pos.config)'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proofPosConfigs.map((cfg) => (
                      <span
                        key={cfg.id}
                        dir="ltr"
                        className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11.5px] font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200"
                      >
                        #{cfg.id} {cfg.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. Odoo pos.payment.method */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '٢. طرق الدفع والربط (pos.payment.method)' : '2. Payment Methods (pos.payment.method)'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proofPaymentMethods.map((pm) => (
                      <span
                        key={pm.id}
                        dir="ltr"
                        className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-[11.5px] font-bold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-200"
                      >
                        #{pm.id} {pm.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. Last 5 Verified Odoo Receipts */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '٣. آخر ٥ إيصالات فعلية في أودو (pos.order)' : '3. Last 5 Real Odoo Receipts (pos.order)'}
                  </div>
                  {proofRow.receiptsList.length === 0 ? (
                    <div className="ae-bento-subcard rounded-2xl p-4 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                      {isAr
                        ? 'لا توجد أي إيصالات مسجلة لهذه القناة في هذا الفرع منذ بداية السنة (صفر طلبات تاريخية).'
                        : 'Zero receipts recorded for this channel in this branch YTD (never activated).'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {proofRow.receiptsList.slice(0, 5).map((rc) => (
                        <div
                          key={rc.orderId}
                          className="ae-bento-subcard flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[12px]"
                        >
                          <div className="space-y-0.5">
                            <div dir="ltr" className="font-mono font-extrabold text-slate-900 dark:text-white">
                              #{rc.orderName}
                            </div>
                            <div dir="ltr" className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {rc.dateKuwait} • {rc.posRef || rc.posConfigName}
                            </div>
                          </div>
                          <div dir="ltr" className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                            {rc.amountKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Live Store Link */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                  <a
                    href={PROOF.storeLinks?.[proofRow.channelKey] ?? 'https://www.talabat.com/kuwait'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ae-btn-primary inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold"
                  >
                    <span>{isAr ? 'فتح رابط المتجر الحي' : 'Open Live Store Link'}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => setProofRowId(null)}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center rounded-full px-4 text-[12.5px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    {T('Close', 'إغلاق')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
