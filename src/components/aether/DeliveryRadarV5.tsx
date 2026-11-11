'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import type { OdooBucketSummary } from '@/lib/odoo/live-sync-core'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
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

type ForensicStatus = 'stopped' | 'stalled' | 'active'
type ChannelKey = 'talabat-tgo' | 'talabat-tmp' | 'keeta' | 'deliveroo' | 'jahez' | 'snoonu'
type DeliveryMode = 'Tgo' | 'TMP'
type QuickFilter = 'all' | 'stopped' | 'stalled' | 'active' | 'tgo' | 'tmp'
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

const J = JOURNEY as unknown as DeliverySnapshot

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
  { key: 'talabat-tgo', platformKey: 'Talabat', en: 'Talabat Tgo', ar: 'طلبات Tgo', defaultMode: 'Tgo', contractPct: 17.0 },
  { key: 'talabat-tmp', platformKey: 'Talabat', en: 'Talabat TMP', ar: 'طلبات TMP', defaultMode: 'TMP', contractPct: 10.0 },
  { key: 'keeta', platformKey: 'Keeta', en: 'Keeta', ar: 'كيتا', defaultMode: 'Tgo', contractPct: 12.0 },
  { key: 'deliveroo', platformKey: 'Deliveroo', en: 'Deliveroo', ar: 'ديليفرو', defaultMode: 'Tgo', contractPct: 18.0 },
  { key: 'jahez', platformKey: 'Jahez', en: 'Jahez', ar: 'جاهز', defaultMode: 'Tgo', contractPct: 15.0 },
  { key: 'snoonu', platformKey: 'Snoonu', en: 'Snoonu', ar: 'سنونو', defaultMode: 'Tgo', contractPct: 15.0 },
]

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
  status: ForensicStatus
  orders: number
  salesKwd: number
  contractPct: number
  actualPct: number | null
  netKwd: number
  divertedToTgo?: boolean
  varianceKwd: number
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
        TMP 10%
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
        <span>{isAr ? 'متوقف 🔴' : 'Stopped 🔴'}</span>
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-500/20 whitespace-nowrap dark:bg-emerald-950/60 dark:text-emerald-200">
      <span>{isAr ? 'شغال 🟢' : 'Active 🟢'}</span>
    </span>
  )
}

/**
 * Unified Delivery Radar (`مراقبة التوصيل`)
 * Single full-width (`max-w-[1540px]`) table monitoring Tgo, TMP, Keeta, Deliveroo, Jahez,
 * and Snoonu across ONLY our 6 Venture Foods restaurant brands and 7 active Odoo branches,
 * wired live to GlobalFilterContext (`today` / `week` / `month` / `year` + brand / branch / channel).
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const { filters, workspace, liveSummary, setChannel } = useGlobalFilter()

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('forensic')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isNonAppChannelSelected =
    filters.channel === 'dine-in' || filters.channel === 'takeaway-direct'

  const allPeriodRows = useMemo(() => {
    const allowedBrandMap = new Map(VF_SIX_BRANDS.map((b) => [b.id, b]))
    const rawBuckets = (ODOO as unknown as { buckets?: Partial<Record<GlobalPeriod, OdooBucketSummary>> }).buckets
    const monthBkt = liveSummary?.buckets?.month ?? rawBuckets?.month
    const activeBkt = liveSummary?.buckets?.[filters.period] ?? rawBuckets?.[filters.period]
    const periodScale = Math.max(0.01, safeNum(workspace.periodScale, 1))
    const periodDays = Math.max(1, safeNum(workspace.periodDays, 30))

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

      const calcCellOrders30 = (rawChannelId: string, cellSalesKwd: number): number => {
        if (cellSalesKwd <= 0) return 0
        const locCh = loc.channels.find((c) => c.channel === rawChannelId)
        if (locCh && locCh.amountKwd > 0 && locCh.payments > 0) {
          return Math.max(1, Math.round((cellSalesKwd / locCh.amountKwd) * locCh.payments))
        }
        const aov = channelAov[rawChannelId] || 5.5
        return Math.max(1, Math.round(cellSalesKwd / aov))
      }

      // Compute period scaling ratio for a specific UI channel inside this branch from real Odoo buckets
      const getLocChannelScales = (uiCh: ChannelKey): { netRatio: number; ordRatio: number } => {
        if (filters.period === 'month' && !liveSummary?.buckets?.month) {
          return { netRatio: 1, ordRatio: 1 }
        }
        const curCell = activeBkt?.byLocation?.[loc.id]?.uiChannels?.[uiCh]
        const monCell = monthBkt?.byLocation?.[loc.id]?.uiChannels?.[uiCh]
        if (curCell && monCell && monCell.netKwd > 0) {
          const netRatio = Math.max(0, safeNum(curCell.netKwd) / monCell.netKwd)
          const ordRatio =
            monCell.orders > 0
              ? Math.max(0, safeNum(curCell.orders) / monCell.orders)
              : netRatio
          return { netRatio, ordRatio }
        }
        const curGlobal = activeBkt?.uiChannels?.[uiCh]
        const monGlobal = monthBkt?.uiChannels?.[uiCh]
        if (curGlobal && monGlobal && monGlobal.netKwd > 0) {
          const netRatio = Math.max(0, safeNum(curGlobal.netKwd) / monGlobal.netKwd)
          const ordRatio =
            monGlobal.orders > 0
              ? Math.max(0, safeNum(curGlobal.orders) / monGlobal.orders)
              : netRatio
          return { netRatio, ordRatio }
        }
        return { netRatio: periodScale, ordRatio: periodScale }
      }

      const branchBrands = loc.brands
        .filter((b) => allowedBrandMap.has(b.brand) && b.orders > 0)
        .sort((a, b) => b.netKwd - a.netKwd)

      for (const bb of branchBrands) {
        const brand = allowedBrandMap.get(bb.brand)
        if (!brand) continue

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

        const totalDeliverySales30AtPair =
          tgoSales30 + tmpSales30 + keetaSales30 + delivGoSales30 + delivMpSales30 + jahezSales30 + snoonuSales30

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

          if (ch.key === 'talabat-tgo') {
            actualPct = salesKwd > 0 ? 17.0 : null
          } else if (ch.key === 'talabat-tmp') {
            if (salesKwd === 0 && tgoPeriodSales > 0) {
              actualPct = 17.0
              divertedToTgo = true
              varianceKwd = tgoPeriodSales * 0.25 * 0.07
            } else if (salesKwd > 0) {
              actualPct = 10.0
              const talabatTotal = tgoPeriodSales + salesKwd
              if (tgoPeriodSales > 500 * scales.netRatio && talabatTotal > 0 && salesKwd / talabatTotal < 0.12) {
                divertedToTgo = true
                varianceKwd = Math.max(0, tgoPeriodSales * 0.25 - salesKwd) * 0.07
              }
            }
          } else if (ch.key === 'keeta') {
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Keeta
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          } else if (ch.key === 'deliveroo') {
            if (salesKwd > 0) {
              actualPct = contractPct
            }
          } else if (ch.key === 'jahez') {
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Jahez
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          } else if (ch.key === 'snoonu') {
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Snoonu
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          }

          varianceKwd = Math.max(0, Math.round(safeNum(varianceKwd) * 1000) / 1000)
          const appliedCommissionPct = actualPct !== null ? actualPct : contractPct
          const netKwd =
            salesKwd > 0
              ? Math.max(0, Math.round(salesKwd * (1 - appliedCommissionPct / 100) * 1000) / 1000)
              : 0

          const lowOrderThreshold = Math.max(1, Math.round(0.5 * periodDays))
          let status: ForensicStatus = 'active'
          let noteAr = 'يعمل بشكل طبيعي'
          let noteEn = 'Running normally'

          if (orders === 0) {
            status = 'stopped'
            if (ch.key === 'talabat-tmp' && tgoPeriodOrders > 0) {
              noteAr = `متوقف وتحولت الطلبات إلى Tgo (17%)`
              noteEn = `Stopped — orders shifted to Tgo (17%)`
            } else if (totalDeliverySales30AtPair === 0 && bb.orders > 0) {
              noteAr = 'توصيل الفرع متوقف بالكامل'
              noteEn = 'All branch delivery offline'
            } else {
              noteAr = 'لا توجد طلبات — الحساب متوقف'
              noteEn = 'Zero orders — account offline'
            }
          } else if (
            orders <= lowOrderThreshold ||
            (ch.key === 'talabat-tmp' &&
              tgoPeriodOrders >= Math.max(2, Math.round(0.8 * periodDays)) &&
              orders / (orders + tgoPeriodOrders) < 0.12)
          ) {
            status = 'stalled'
            if (ch.key === 'talabat-tmp' && tgoPeriodOrders > 0) {
              noteAr = 'نطاق TMP مقيد لصالح Tgo الأعلى عمولة'
              noteEn = 'TMP zone restricted in favor of Tgo'
            } else {
              noteAr = `طلبات قليلة جداً (${f0(orders)} طلب)`
              noteEn = `Very few orders (${f0(orders)})`
            }
          } else if (actualPct !== null && actualPct > contractPct + 0.5) {
            noteAr = `خصم فعلي ${f1(actualPct)}% أعلى من العقد`
            noteEn = `Actual cut ${f1(actualPct)}% above contract`
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
            status,
            orders,
            salesKwd,
            contractPct,
            actualPct,
            netKwd,
            divertedToTgo,
            varianceKwd,
            noteEn,
            noteAr,
          })
        }
      }
    }

    return built
  }, [filters.period, liveSummary, workspace.periodDays, workspace.periodScale])

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
    const tgoCount = globalScopedRows.filter((r) => r.channelKey === 'talabat-tgo').length
    const tmpCount = globalScopedRows.filter((r) => r.channelKey === 'talabat-tmp').length
    const totalOrders = globalScopedRows.reduce((s, r) => s + r.orders, 0)
    const totalSalesKwd = globalScopedRows.reduce((s, r) => s + r.salesKwd, 0)
    const totalNetKwd = globalScopedRows.reduce((s, r) => s + r.netKwd, 0)
    const totalVarianceKwd = globalScopedRows.reduce((s, r) => s + r.varianceKwd, 0)

    return {
      totalAccounts: globalScopedRows.length,
      stoppedCount,
      stalledCount,
      activeCount,
      tgoCount,
      tmpCount,
      totalOrders,
      totalSalesKwd,
      totalNetKwd,
      totalVarianceKwd,
    }
  }, [globalScopedRows])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const statusWeight: Record<ForensicStatus, number> = { stopped: 0, stalled: 1, active: 2 }

    return globalScopedRows
      .filter((r) => {
        if (quickFilter === 'stopped' && r.status !== 'stopped') return false
        if (quickFilter === 'stalled' && r.status !== 'stalled') return false
        if (quickFilter === 'active' && r.status !== 'active') return false
        if (quickFilter === 'tgo' && r.channelKey !== 'talabat-tgo') return false
        if (quickFilter === 'tmp' && r.channelKey !== 'talabat-tmp') return false
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
          b.varianceKwd - a.varianceKwd ||
          a.branchOrder - b.branchOrder ||
          b.salesKwd - a.salesKwd
        )
      })
  }, [globalScopedRows, quickFilter, searchQuery, sortMode])

  const hasLocalFilters = quickFilter !== 'all' || searchQuery.trim() !== ''

  const resetLocalFilters = () => {
    setQuickFilter('all')
    setSearchQuery('')
  }

  const buildRowAlertMessage = (r: ForensicAccountRow) => {
    const statusLabelAr =
      r.status === 'stopped' ? 'متوقف 🔴' : r.status === 'stalled' ? 'ضعيف 🟠' : 'شغال 🟢'
    const statusLabelEn =
      r.status === 'stopped' ? 'Stopped 🔴' : r.status === 'stalled' ? 'Low 🟠' : 'Active 🟢'

    if (isAr) {
      return [
        `متابعة توصيل (${workspace.subtitleAr})`,
        `• الفرع: ${r.branchAr}`,
        `• المطعم: ${r.brandAr}`,
        `• التطبيق: ${r.platformAr}`,
        `• الحالة: ${statusLabelAr} (${r.noteAr})`,
        `• الطلبات: ${f0(r.orders)} | المبيعات: ${fmtAmount(r.salesKwd)} د.ك | الصافي: ${fmtAmount(r.netKwd)} د.ك`,
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
          `"${r.status === 'stopped' ? (isAr ? 'متوقف' : 'Stopped') : r.status === 'stalled' ? (isAr ? 'ضعيف' : 'Low') : isAr ? 'شغال' : 'Active'}"`,
          r.orders,
          r.salesKwd.toFixed(3),
          r.contractPct.toFixed(1),
          r.actualPct !== null ? r.actualPct.toFixed(1) : 'Stopped',
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
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1540px] space-y-5">
      {/* Ultra-Simple Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[24px] font-extrabold tracking-tight text-neutral-950 sm:text-[28px] dark:text-white">
            {T('Delivery Radar', 'مراقبة التوصيل')}
          </h1>
          <p className="text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-white px-4 text-[12.5px] font-bold text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.06] transition duration-150 hover:bg-neutral-50 sm:self-auto dark:bg-[#0F1626] dark:text-white dark:ring-white/10"
        >
          <Download className="h-3.5 w-3.5" />
          {T('Export CSV', 'تحميل الجدول')}
        </button>
      </header>

      {/* Non-App Channel Helper Banner */}
      {isNonAppChannelSelected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.05] dark:bg-[#0F1626] dark:ring-white/10">
          <p className="text-[13.5px] font-semibold text-neutral-700 dark:text-slate-200">
            {T(
              'You selected an in-store or direct channel. Switch channel to view delivery apps.',
              'القناة المختارة حالياً هي الصالة أو السفري المباشر. لعرض تطبيقات التوصيل اضغط الزر التالي.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setChannel('all')}
            className="rounded-full bg-neutral-950 px-4 py-2 text-[12.5px] font-bold text-white transition duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
          >
            {T('Show All Apps', 'عرض كل القنوات')}
          </button>
        </div>
      ) : null}

      {/* 4 Ultra-Simple Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-neutral-600 dark:text-slate-300">
            <span>{T('Stopped Accounts', 'حسابات متوقفة')}</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
              {summary.stoppedCount}
            </span>
            <span className="text-[12px] font-medium text-neutral-400 dark:text-slate-400">
              {T(`of ${summary.totalAccounts}`, `من ${summary.totalAccounts}`)}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {T('Accounts receiving zero orders right now.', 'حسابات لا تستقبل أي طلبات حالياً.')}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-neutral-600 dark:text-slate-300">
            <span>{T('Low Accounts', 'حسابات ضعيفة')}</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
              {summary.stalledCount}
            </span>
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              · {summary.activeCount} {T('Active 🟢', 'شغال 🟢')}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {T('Very few orders or restricted delivery zone.', 'طلبات قليلة جداً أو نطاق توصيل مقيد.')}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-neutral-600 dark:text-slate-300">
            <span>{T('Delivery Sales', 'مبيعات التوصيل')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div dir="ltr" className="mt-2 flex items-baseline gap-2 text-[25px] font-extrabold tabular-nums text-neutral-950 dark:text-white">
            <span>
              {fmtAmount(summary.totalSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {T(
              `${f0(summary.totalOrders)} orders · Net ${fmtAmount(summary.totalNetKwd)} KWD.`,
              `${f0(summary.totalOrders)} طلب · الصافي بعد العمولة ${fmtAmount(summary.totalNetKwd)} د.ك.`,
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]">
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-neutral-600 dark:text-slate-300">
            <span>{T('Commission Gap', 'فرق العمولات')}</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div dir="ltr" className="mt-2 text-[25px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
            -{fmtAmount(summary.totalVarianceKwd)} {isAr ? 'د.ك' : 'KWD'}
          </div>
          <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {T(
              'Extra fees above contract or Tgo 17% shift.',
              'خصومات فوق نسبة العقد أو تحول إلى Tgo الأعلى عمولة.',
            )}
          </p>
        </div>
      </section>

      {/* Single Unified Delivery Table */}
      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] sm:p-6 space-y-4 dark:bg-[#0F1626] dark:ring-white/[0.08]">
        {/* Quick Status Pills + Search + Sort */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', labelAr: `الكل (${summary.totalAccounts})`, labelEn: `All (${summary.totalAccounts})` },
                { id: 'stopped', labelAr: `متوقف 🔴 (${summary.stoppedCount})`, labelEn: `Stopped 🔴 (${summary.stoppedCount})` },
                { id: 'stalled', labelAr: `ضعيف 🟠 (${summary.stalledCount})`, labelEn: `Low 🟠 (${summary.stalledCount})` },
                { id: 'active', labelAr: `شغال 🟢 (${summary.activeCount})`, labelEn: `Active 🟢 (${summary.activeCount})` },
                { id: 'tgo', labelAr: `طلبات Tgo (${summary.tgoCount})`, labelEn: `Talabat Tgo (${summary.tgoCount})` },
                { id: 'tmp', labelAr: `طلبات TMP (${summary.tmpCount})`, labelEn: `Talabat TMP (${summary.tmpCount})` },
              ] as const
            ).map((pill) => {
              const active = quickFilter === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setQuickFilter(pill.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-neutral-950 text-white ring-1 ring-neutral-900/80 dark:bg-white dark:text-neutral-950'
                      : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12]'
                  }`}
                >
                  {isAr ? pill.labelAr : pill.labelEn}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[210px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={T('Search branch, brand, app…', 'ابحث بالفرع أو المطعم أو التطبيق…')}
                className="h-9 w-full rounded-full bg-[#F7F7F8] ps-8 pe-3 text-[12.5px] font-medium text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900/80 dark:bg-white/[0.06] dark:text-white"
              />
            </div>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={T('Sort', 'الترتيب')}
              className="h-9 rounded-full bg-[#F7F7F8] px-3.5 text-[12.5px] font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900/80 dark:bg-white/[0.06] dark:text-slate-100"
            >
              <option value="forensic">{T('Stopped First', 'المتوقف أولاً')}</option>
              <option value="sales">{T('Highest Sales', 'الأعلى مبيعات')}</option>
            </select>

            {hasLocalFilters ? (
              <button
                type="button"
                onClick={resetLocalFilters}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-neutral-900 px-3 text-[12px] font-bold text-white transition duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
              >
                <RotateCcw className="h-3 w-3" />
                {T('All', 'الكل')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Exact 9 Ultra-Simple Columns: الفرع | المطعم | التطبيق | الحالة | الطلبات | المبيعات | العمولة | الصافي | الفرق */}
        <div className="overflow-x-auto rounded-2xl ring-1 ring-neutral-950/[0.05] dark:ring-white/10">
          <table className="w-full min-w-[980px] border-collapse bg-white text-[13px] dark:bg-[#0D1320]">
            <thead className="bg-[#F7F7F8] text-neutral-600 dark:bg-slate-900/80 dark:text-slate-300">
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
                  {T('Gap', 'الفرق')}
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
                  const hasCommissionGap = r.actualPct !== null && r.actualPct > r.contractPct + 0.3
                  const rowBg =
                    r.status === 'stopped'
                      ? 'bg-rose-50/25 hover:bg-rose-50/50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20'
                      : r.status === 'stalled'
                        ? 'bg-amber-50/20 hover:bg-amber-50/45 dark:bg-amber-950/10 dark:hover:bg-amber-950/20'
                        : 'hover:bg-neutral-50/80 dark:hover:bg-white/[0.03]'

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

                      {/* 4. الحالة */}
                      <td className="px-4 py-3 min-w-[210px]">
                        <div className="flex flex-col items-start gap-0.5">
                          <StatusBadge status={r.status} isAr={isAr} />
                          <span className="text-[11.5px] font-medium text-neutral-500 dark:text-slate-400">
                            {isAr ? r.noteAr : r.noteEn}
                          </span>
                        </div>
                      </td>

                      {/* 5. الطلبات */}
                      <td
                        dir="ltr"
                        className={`px-4 py-3 text-end font-extrabold tabular-nums whitespace-nowrap ${
                          r.orders === 0
                            ? 'text-rose-700 dark:text-rose-400'
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

                      {/* 9. الفرق (+ 1-click WhatsApp copy icon) */}
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <span dir="ltr" className="font-extrabold tabular-nums">
                            {r.varianceKwd > 0.05 ? (
                              <span className="text-rose-700 dark:text-rose-400">
                                -{fmtAmount(r.varianceKwd)} {isAr ? 'د.ك' : 'KWD'}
                              </span>
                            ) : (
                              <span className="font-medium text-neutral-400 dark:text-slate-500">0</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyRowAlert(r)}
                            title={T('Copy for WhatsApp', 'نسخ للواتساب')}
                            aria-label={T('Copy for WhatsApp', 'نسخ للواتساب')}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition duration-150 ${
                              copiedId === r.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#F7F7F8] text-neutral-600 hover:bg-neutral-900 hover:text-white dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white dark:hover:text-neutral-950'
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
    </div>
  )
}
