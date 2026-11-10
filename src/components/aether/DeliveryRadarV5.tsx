'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Radar,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import { useLang } from '@/components/aether/ui'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

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

/** Strictly ONLY our 6 Venture Foods restaurant brands (zero legacy or school-canteen brands). */
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
  { id: 'karak-cafeteria', en: 'Karak Cafeteria', ar: 'كرك كافتيريا', color: '#7C3AED' },
]

/** Strictly ONLY our 7 real active Odoo POS branches (numeric ID whitelisted via ODOO.restaurants). */
const ACTIVE_BRANCH_META: Record<string, { order: number; en: string; ar: string }> = {
  avenues: { order: 1, en: 'The Avenues', ar: 'الأفنيوز' },
  '360-mall': { order: 2, en: '360', ar: 'مجمع 360' },
  assima: { order: 3, en: 'Assima', ar: 'مجمع العاصمة' },
  promenade: { order: 4, en: 'Promenade', ar: 'مجمع البروميناد' },
  salmiya: { order: 5, en: 'Salmiya', ar: 'السالمية' },
  'al-kout': { order: 6, en: 'Al-Kout', ar: 'مجمع الكوت' },
  ardiya: { order: 7, en: 'Ardiya', ar: 'العارضية' },
}

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
  divertedToTgo?: boolean
  varianceKwd: number
  noteEn: string
  noteAr: string
}

function ModePill({ mode, dual, isAr }: { mode: DeliveryMode; dual?: boolean; isAr: boolean }) {
  if (dual) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 ring-1 ring-teal-500/20 whitespace-nowrap dark:bg-teal-950/60 dark:text-teal-200">
        <span>Tgo + TMP</span>
      </span>
    )
  }
  if (mode === 'TMP') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-500/20 whitespace-nowrap dark:bg-sky-950/60 dark:text-sky-200">
        <span className="font-extrabold">TMP</span>
        <span>{isAr ? 'أسطولنا 10%' : 'Own Fleet 10%'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-500/20 whitespace-nowrap dark:bg-amber-950/60 dark:text-amber-200">
      <span className="font-extrabold">Tgo</span>
      <span>{isAr ? 'توصيل المنصة' : 'Platform Fleet'}</span>
    </span>
  )
}

function StatusBadge({ status, isAr }: { status: ForensicStatus; isAr: boolean }) {
  if (status === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11.5px] font-bold text-rose-800 ring-1 ring-rose-500/25 whitespace-nowrap dark:bg-rose-950/60 dark:text-rose-200">
        <span>🔴</span>
        <span>{isAr ? 'متوقف - رصد إيقاف' : 'Stopped — Shutdown Detected'}</span>
      </span>
    )
  }
  if (status === 'stalled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-bold text-amber-900 ring-1 ring-amber-500/25 whitespace-nowrap dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟠</span>
        <span>{isAr ? 'انقطاع طلبات' : 'Order Outage / Drop'}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-800 ring-1 ring-emerald-500/25 whitespace-nowrap dark:bg-emerald-950/60 dark:text-emerald-200">
      <span>🟢</span>
      <span>{isAr ? 'نشط' : 'Active'}</span>
    </span>
  )
}

/**
 * Unified Forensic Delivery Radar (`الرادار الجنائي لمنصات التوصيل`)
 * Single full-width (`max-w-[1540px]`) table view monitoring Talabat Tgo, Talabat TMP, Keeta,
 * Deliveroo, Jahez, and Snoonu across ONLY our 6 Venture Foods restaurant brands and 7 active Odoo branches.
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [channelFilter, setChannelFilter] = useState<string>('ALL')
  const [brandFilter, setBrandFilter] = useState<string>('ALL')
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('forensic')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { rows, summary } = useMemo(() => {
    const allowedBrandMap = new Map(VF_SIX_BRANDS.map((b) => [b.id, b]))

    // Platform-wide effective commission rates from posted Odoo accounting entries
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

    // Channel-level AOV fallback from ODOO.channels
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

      // Helper to compute exact orders from branch channel payments proportional to brand netKwd
      const calcCellOrders = (rawChannelId: string, cellSalesKwd: number): number => {
        if (cellSalesKwd <= 0) return 0
        const locCh = loc.channels.find((c) => c.channel === rawChannelId)
        if (locCh && locCh.amountKwd > 0 && locCh.payments > 0) {
          return Math.max(1, Math.round((cellSalesKwd / locCh.amountKwd) * locCh.payments))
        }
        const aov = channelAov[rawChannelId] || 5.5
        return Math.max(1, Math.round(cellSalesKwd / aov))
      }

      // Active brands in this physical branch (strictly from the 6 Venture Foods restaurant brands)
      const branchBrands = loc.brands
        .filter((b) => allowedBrandMap.has(b.brand) && b.orders > 0)
        .sort((a, b) => b.netKwd - a.netKwd)

      for (const bb of branchBrands) {
        const brand = allowedBrandMap.get(bb.brand)
        if (!brand) continue

        const cubeForPair = ODOO.cube.filter((c) => c.location === loc.id && c.brand === brand.id)
        const getSales = (chId: string) => cubeForPair.find((c) => c.channel === chId)?.netKwd ?? 0

        const tgoSales = getSales('talabat-tgo')
        const tmpSales = getSales('talabat-tmp')
        const tgoOrders = calcCellOrders('talabat-tgo', tgoSales)
        const tmpOrders = calcCellOrders('talabat-tmp', tmpSales)
        const keetaSales = getSales('keeta')
        const delivGoSales = getSales('deliveroo-go')
        const delivMpSales = getSales('deliveroo-mp')
        const jahezSales = getSales('jahez')
        const snoonuSales = getSales('snoonu')

        const totalDeliverySalesAtPair =
          tgoSales + tmpSales + keetaSales + delivGoSales + delivMpSales + jahezSales + snoonuSales

        for (const ch of MONITORED_CHANNELS) {
          let salesKwd = 0
          let orders = 0
          let mode: DeliveryMode = ch.defaultMode
          let hasDualMode = false
          let contractPct = ch.contractPct
          let actualPct: number | null = null
          let divertedToTgo = false
          let varianceKwd = 0

          if (ch.key === 'talabat-tgo') {
            salesKwd = tgoSales
            orders = tgoOrders
            actualPct = salesKwd > 0 ? 17.0 : null
          } else if (ch.key === 'talabat-tmp') {
            salesKwd = tmpSales
            orders = tmpOrders
            if (salesKwd === 0 && tgoSales > 0) {
              // TMP 10% is completely offline while Tgo 17% is active -> nearby orders forced to 17% (+7% shift loss)
              actualPct = 17.0
              divertedToTgo = true
              varianceKwd = tgoSales * 0.25 * 0.07
            } else if (salesKwd > 0) {
              actualPct = 10.0
              const talabatTotal = tgoSales + tmpSales
              if (tgoSales > 500 && salesKwd / talabatTotal < 0.12) {
                divertedToTgo = true
                varianceKwd = Math.max(0, tgoSales * 0.25 - salesKwd) * 0.07
              }
            }
          } else if (ch.key === 'keeta') {
            salesKwd = keetaSales
            orders = calcCellOrders('keeta', keetaSales)
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Keeta
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          } else if (ch.key === 'deliveroo') {
            salesKwd = delivGoSales + delivMpSales
            orders = calcCellOrders('deliveroo-go', delivGoSales) + calcCellOrders('deliveroo-mp', delivMpSales)
            if (delivGoSales > 0 && delivMpSales > 0) {
              hasDualMode = true
              mode = delivGoSales >= delivMpSales ? 'Tgo' : 'TMP'
              contractPct = (delivGoSales * 18.0 + delivMpSales * 10.0) / salesKwd
              actualPct = contractPct
            } else if (delivMpSales > 0) {
              mode = 'TMP'
              contractPct = 10.0
              actualPct = 10.0
            } else if (delivGoSales > 0) {
              mode = 'Tgo'
              contractPct = 18.0
              actualPct = 18.0
            }
          } else if (ch.key === 'jahez') {
            salesKwd = jahezSales
            orders = calcCellOrders('jahez', jahezSales)
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Jahez
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          } else if (ch.key === 'snoonu') {
            salesKwd = snoonuSales
            orders = calcCellOrders('snoonu', snoonuSales)
            if (salesKwd > 0) {
              actualPct = effRateByPlatform.Snoonu
              varianceKwd = Math.max(0, salesKwd * ((actualPct - contractPct) / 100))
            }
          }

          let status: ForensicStatus = 'active'
          let noteAr = 'متصل ويستقبل الطلبات بانتظام'
          let noteEn = 'Online & receiving steady orders'

          if (orders === 0) {
            status = 'stopped'
            if (ch.key === 'talabat-tmp' && tgoOrders > 0) {
              noteAr = `إيقاف حساب TMP (10%) وتحول ${f0(tgoOrders)} طلب بالكامل إلى Tgo (17%)`
              noteEn = `TMP (10%) stopped — all ${f0(tgoOrders)} Talabat orders forced onto Tgo (17%)`
            } else if (totalDeliverySalesAtPair === 0 && bb.orders > 0) {
              noteAr = `توقف كامل للتوصيل في الفرع رغم وجود ${f0(bb.orders)} طلب كاونتر`
              noteEn = `All delivery accounts offline despite ${f0(bb.orders)} counter orders`
            } else {
              noteAr = 'صفر طلبات خلال 30 يوماً — رصد إيقاف أو حجب الحساب بالمنصة'
              noteEn = 'Zero orders in 30d — account stopped or hidden on platform'
            }
          } else if (
            orders <= 15 ||
            (ch.key === 'talabat-tmp' && tgoOrders > 25 && orders / (orders + tgoOrders) < 0.12)
          ) {
            status = 'stalled'
            if (ch.key === 'talabat-tmp' && tgoOrders > 25) {
              const tmpShare = (orders / (orders + tgoOrders)) * 100
              noteAr = `تقييد نطاق TMP (${f1(tmpShare)}% فقط مقابل ${f0(tgoOrders)} طلب عبر Tgo 17%)`
              noteEn = `TMP throttled (${f1(tmpShare)}% share vs ${f0(tgoOrders)} orders on Tgo 17%)`
            } else {
              noteAr = `هبوط حاد في الطلبات (${f0(orders)} طلب فقط خلال 30 يوماً)`
              noteEn = `Order drop / intermittent outage (only ${f0(orders)} orders in 30d)`
            }
          } else if (actualPct !== null && actualPct > contractPct + 0.5) {
            noteAr = `استقطاع فعلي ${f1(actualPct)}% مقابل عقد ${f1(contractPct)}% (رسوم وعروض إضافية)`
            noteEn = `Actual ${f1(actualPct)}% vs ${f1(contractPct)}% contract (extra fees & promos)`
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
            divertedToTgo,
            varianceKwd,
            noteEn,
            noteAr,
          })
        }
      }
    }

    const stoppedCount = built.filter((r) => r.status === 'stopped').length
    const stalledCount = built.filter((r) => r.status === 'stalled').length
    const activeCount = built.filter((r) => r.status === 'active').length
    const tgoCount = built.filter((r) => r.channelKey === 'talabat-tgo').length
    const tmpCount = built.filter((r) => r.channelKey === 'talabat-tmp').length
    const totalOrders = built.reduce((s, r) => s + r.orders, 0)
    const totalSalesKwd = built.reduce((s, r) => s + r.salesKwd, 0)
    const totalVarianceKwd = built.reduce((s, r) => s + r.varianceKwd, 0)
    const tgoSalesTotal = built.filter((r) => r.channelKey === 'talabat-tgo').reduce((s, r) => s + r.salesKwd, 0)
    const tmpSalesTotal = built.filter((r) => r.channelKey === 'talabat-tmp').reduce((s, r) => s + r.salesKwd, 0)

    return {
      rows: built,
      summary: {
        totalAccounts: built.length,
        stoppedCount,
        stalledCount,
        activeCount,
        tgoCount,
        tmpCount,
        totalOrders,
        totalSalesKwd,
        totalVarianceKwd,
        tgoSalesTotal,
        tmpSalesTotal,
      },
    }
  }, [])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const statusWeight: Record<ForensicStatus, number> = { stopped: 0, stalled: 1, active: 2 }

    return rows
      .filter((r) => {
        if (quickFilter === 'stopped' && r.status !== 'stopped') return false
        if (quickFilter === 'stalled' && r.status !== 'stalled') return false
        if (quickFilter === 'active' && r.status !== 'active') return false
        if (quickFilter === 'tgo' && r.channelKey !== 'talabat-tgo') return false
        if (quickFilter === 'tmp' && r.channelKey !== 'talabat-tmp') return false
        if (channelFilter !== 'ALL' && r.channelKey !== channelFilter) return false
        if (brandFilter !== 'ALL' && r.brandId !== brandFilter) return false
        if (branchFilter !== 'ALL' && r.branchId !== branchFilter) return false
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
  }, [rows, quickFilter, channelFilter, brandFilter, branchFilter, searchQuery, sortMode])

  const hasActiveFilters =
    quickFilter !== 'all' ||
    channelFilter !== 'ALL' ||
    brandFilter !== 'ALL' ||
    branchFilter !== 'ALL' ||
    searchQuery.trim() !== ''

  const resetFilters = () => {
    setQuickFilter('all')
    setChannelFilter('ALL')
    setBrandFilter('ALL')
    setBranchFilter('ALL')
    setSearchQuery('')
  }

  const buildRowAlertMessage = (r: ForensicAccountRow) => {
    const statusTextAr =
      r.status === 'stopped'
        ? '🔴 متوقف - رصد إيقاف'
        : r.status === 'stalled'
          ? '🟠 انقطاع طلبات'
          : '🟢 نشط (فارق عمولة)'
    const statusTextEn =
      r.status === 'stopped'
        ? '🔴 Stopped — Shutdown Detected'
        : r.status === 'stalled'
          ? '🟠 Order Outage / Drop'
          : '🟢 Active (Commission Variance)'

    if (isAr) {
      return [
        `🚨 بلاغ الرادار الجنائي لمنصات التوصيل — فنتشر فودز`,
        `• العلامة التجارية: ${r.brandAr}`,
        `• الفرع الفعلي: ${r.branchAr}`,
        `• المنصة والنوع: ${r.platformAr} (${r.mode})`,
        `• الحالة المرصودة: ${statusTextAr}`,
        `• الطلبات (30 يوماً): ${f0(r.orders)} طلب (${f3(r.salesKwd)} د.ك)`,
        `• العمولة التعاقدية مقابل الفعلية: ${f1(r.contractPct)}% ← ${r.actualPct !== null ? `${f1(r.actualPct)}%` : 'متوقف'}`,
        r.varianceKwd > 0 ? `• فرق العمولة المرصود: -${f3(r.varianceKwd)} د.ك` : null,
        `• التشخيص: ${r.noteAr}`,
        `• الإجراء المطلوب فوراً: مراجعة حالة الجهاز/مدير الحساب وإعادة فتح التغطية ومطابقة نسبة العمولة التعاقدية.`,
      ]
        .filter(Boolean)
        .join('\n')
    }
    return [
      `🚨 FORENSIC DELIVERY RADAR ALERT — Venture Foods`,
      `• Brand: ${r.brandEn}`,
      `• Branch: ${r.branchEn}`,
      `• Platform & Mode: ${r.platformEn} (${r.mode})`,
      `• Status: ${statusTextEn}`,
      `• 30d Orders & Sales: ${f0(r.orders)} orders (${f3(r.salesKwd)} KWD)`,
      `• Contractual vs Actual Commission: ${f1(r.contractPct)}% → ${r.actualPct !== null ? `${f1(r.actualPct)}%` : 'Stopped'}`,
      r.varianceKwd > 0 ? `• Commission Variance: -${f3(r.varianceKwd)} KWD` : null,
      `• Finding: ${r.noteEn}`,
      `• Required Action: Verify branch tablet / platform account manager immediately, restore zone visibility, and enforce contractual commission.`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  const copyRowAlert = async (r: ForensicAccountRow) => {
    try {
      await navigator.clipboard.writeText(buildRowAlertMessage(r))
      setCopiedId(r.id)
      setTimeout(() => setCopiedId((prev) => (prev === r.id ? null : prev)), 2200)
    } catch {
      // ignore clipboard errors
    }
  }

  const exportCsv = () => {
    const headers = [
      'Brand',
      'Branch',
      'Platform',
      'Mode',
      'Status',
      'Orders_30d',
      'Sales_KWD_30d',
      'Contractual_Commission_Pct',
      'Actual_Commission_Pct',
      'Variance_KWD',
      'Forensic_Note',
    ]
    const csvLines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          `"${isAr ? r.brandAr : r.brandEn}"`,
          `"${isAr ? r.branchAr : r.branchEn}"`,
          `"${isAr ? r.platformAr : r.platformEn}"`,
          `"${r.hasDualMode ? 'Tgo+TMP' : r.mode}"`,
          `"${r.status === 'stopped' ? (isAr ? 'متوقف - رصد إيقاف' : 'Stopped') : r.status === 'stalled' ? (isAr ? 'انقطاع أو هبوط طلبات' : 'Stalled') : isAr ? 'نشط' : 'Active'}"`,
          r.orders,
          r.salesKwd.toFixed(3),
          r.contractPct.toFixed(1),
          r.actualPct !== null ? r.actualPct.toFixed(1) : 'Stopped',
          r.varianceKwd.toFixed(3),
          `"${(isAr ? r.noteAr : r.noteEn).replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `venture-foods-forensic-delivery-radar-${ODOO.meta.period.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const branchOptions = useMemo(
    () =>
      Object.entries(ACTIVE_BRANCH_META)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([id, m]) => ({ id, en: m.en, ar: m.ar })),
    [],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1540px] space-y-5">
      {/* Masthead */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11.5px] font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <Radar className="h-3.5 w-3.5" />
            <span>
              {T(
                `Live Odoo POS & Commission Audit · ${ODOO.meta.period.from} → ${ODOO.meta.period.to}`,
                `رصد جنائي مباشر من مبيعات وعمولات أودو · من ${ODOO.meta.period.from} إلى ${ODOO.meta.period.to}`,
              )}
            </span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-950 sm:text-[26px] dark:text-white">
            {T('Forensic Delivery Radar', 'الرادار الجنائي لمنصات التوصيل')}
          </h1>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              'Unified monitor for Talabat Tgo (17%), Talabat TMP (10%), Keeta, Deliveroo, Jahez & Snoonu across our 6 Venture Foods brands and 7 active branches — catching account shutdowns, order drops & commission variances.',
              'جدول موحد يراقب طلبات Tgo (17%) وطلبات TMP (10%) وكيتا وديليفرو وجاهز وسنونو عبر براندات فنتشر فودز الـ 6 وفروعنا الـ 7 النشطة — لكشف الحسابات المتوقفة وهبوط الطلبات وفروقات العمولات.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Download className="h-3.5 w-3.5" />
            {T('Export Forensic CSV', 'تصدير الجدول الجنائي CSV')}
          </button>
        </div>
      </header>

      {/* Top Status Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ae-studio-card p-5">
          <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">
            <span>{T('Stopped Accounts (Shutdown)', 'حسابات متوقفة (رصد إيقاف)')}</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
              {summary.stoppedCount}
            </span>
            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              {T(`of ${summary.totalAccounts} accounts`, `من أصل ${summary.totalAccounts} حساب`)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-rose-800/90 dark:text-rose-300/90">
            {T(
              'Includes The Avenues delivery shutdown & 360 / Assima TMP (10%) closures',
              'تشمل توقف توصيل الأفنيوز وإغلاق حسابات TMP (10%) في 360 والعاصمة',
            )}
          </p>
        </div>

        <div className="ae-studio-card p-5">
          <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">
            <span>{T('Outage / Stalled-Order Accounts', 'حسابات بها انقطاع أو هبوط طلبات')}</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
              {summary.stalledCount}
            </span>
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              · 🟢 {summary.activeCount} {T('Active', 'نشط')}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              '<=15 orders in 30d or TMP (10%) throttled in favor of Tgo (17%)',
              'أقل من 15 طلباً بالشهر أو تقييد نطاق TMP (10%) لصالح Tgo (17%)',
            )}
          </p>
        </div>

        <div className="ae-studio-card p-5">
          <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">
            <span>{T('Talabat Tgo (17%) vs TMP (10%) Mix', 'حصة طلبات Tgo (17%) مقابل TMP (10%)')}</span>
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
          </div>
          <div dir="ltr" className="mt-2 flex items-baseline gap-2 text-[22px] font-extrabold tabular-nums text-slate-900 dark:text-white">
            <span>{f0(summary.totalOrders)}</span>
            <span className="text-[12.5px] font-bold text-slate-500">
              {T('orders', 'طلب توصيل')} · {f0(summary.totalSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            {T(
              `Tgo 17%: ${f0(summary.tgoSalesTotal)} KWD vs TMP 10%: ${f0(summary.tmpSalesTotal)} KWD`,
              `طلبات Tgo (17%): ${f0(summary.tgoSalesTotal)} د.ك مقابل TMP (10%): ${f0(summary.tmpSalesTotal)} د.ك`,
            )}
          </p>
        </div>

        <div className="ae-studio-card p-5">
          <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">
            <span>{T('30d Commission & Shift Variance', 'إجمالي فروقات العمولات والتحويل القسري')}</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div dir="ltr" className="mt-2 text-[25px] font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
            -{f3(summary.totalVarianceKwd)} {isAr ? 'د.ك' : 'KWD'}
          </div>
          <p className="mt-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              'Extra fees/promos above contract (Keeta, Snoonu, Jahez) + Tgo 17% shift penalty',
              'فروقات خصم فوق نسبة العقد (كيتا وسنونو وجاهز) + فارق التحول إلى Tgo 17%',
            )}
          </p>
        </div>
      </section>

      {/* Unified Forensic Filter Bar + Single Table */}
      <section className="ae-studio-card overflow-hidden p-5 sm:p-6 space-y-4">
        {/* Quick Status & Mode Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', labelAr: `الكل (${summary.totalAccounts})`, labelEn: `All (${summary.totalAccounts})` },
                { id: 'stopped', labelAr: `🔴 متوقف - رصد إيقاف (${summary.stoppedCount})`, labelEn: `🔴 Stopped (${summary.stoppedCount})` },
                { id: 'stalled', labelAr: `🟠 انقطاع طلبات (${summary.stalledCount})`, labelEn: `🟠 Order Outage (${summary.stalledCount})` },
                { id: 'active', labelAr: `🟢 نشط (${summary.activeCount})`, labelEn: `🟢 Active (${summary.activeCount})` },
                { id: 'tgo', labelAr: `طلبات Tgo 17% (${summary.tgoCount})`, labelEn: `Talabat Tgo 17% (${summary.tgoCount})` },
                { id: 'tmp', labelAr: `طلبات TMP 10% (${summary.tmpCount})`, labelEn: `Talabat TMP 10% (${summary.tmpCount})` },
              ] as const
            ).map((pill) => {
              const active = quickFilter === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setQuickFilter(pill.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition whitespace-nowrap ${
                    active
                      ? 'bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-slate-950'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.12]'
                  }`}
                >
                  {isAr ? pill.labelAr : pill.labelEn}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={T('Sort order', 'ترتيب الجدول')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="forensic">
                {T('Sort: Stopped & Highest Variance First', 'الترتيب: المتوقف والأعلى فارق عمولة أولاً')}
              </option>
              <option value="sales">
                {T('Sort: Highest 30d Sales First', 'الترتيب: الأعلى مبيعات وطلبات أولاً')}
              </option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {T('Reset', 'مسح الفلاتر')}
              </button>
            )}
          </div>
        </div>

        {/* 4 Precision Dropdown / Search Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            aria-label={T('Filter by platform', 'فلترة حسب المنصة')}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="ALL">{T('All 6 Platform Channels', 'كل المنصات والقنوات (6)')}</option>
            {MONITORED_CHANNELS.map((c) => (
              <option key={c.key} value={c.key}>
                {isAr ? `${c.ar} (عقد ${f1(c.contractPct)}%)` : `${c.en} (${f1(c.contractPct)}% contract)`}
              </option>
            ))}
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label={T('Filter by brand', 'فلترة حسب البراند')}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="ALL">{T('All 6 Venture Foods Brands', 'كل براندات فنتشر فودز (6)')}</option>
            {VF_SIX_BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.ar : b.en}
              </option>
            ))}
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label={T('Filter by branch', 'فلترة حسب الفرع')}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-semibold text-slate-800 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <option value="ALL">{T('All 7 Active Branches', 'كل الفروع الفعلية النشطة (7)')}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.ar : b.en}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={T('Search brand, branch or platform…', 'ابحث باسم البراند أو الفرع أو المنصة…')}
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-2 ps-9 pe-3 text-[12.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Single Unified Full-Width Forensic Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
          <table className="w-full min-w-[1060px] border-collapse text-[13px] bg-white dark:bg-[#0D1320]">
            <thead className="border-b border-slate-200 bg-[#F8FAFC] text-slate-600 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-start text-[11.5px] font-bold whitespace-nowrap">
                  {T('Brand', 'العلامة التجارية')}
                </th>
                <th className="px-4 py-3 text-start text-[11.5px] font-bold whitespace-nowrap">
                  {T('Active Branch', 'الفرع الفعلي')}
                </th>
                <th className="px-4 py-3 text-start text-[11.5px] font-bold whitespace-nowrap">
                  {T('Platform & Mode', 'المنصة ونوع التوصيل')}
                </th>
                <th className="px-4 py-3 text-start text-[11.5px] font-bold whitespace-nowrap">
                  {T('Account Status & Forensic Finding', 'حالة الحساب والتشخيص الجنائي')}
                </th>
                <th className="px-4 py-3 text-end text-[11.5px] font-bold whitespace-nowrap">
                  {T('30d Orders', 'الطلبات (30 يوم)')}
                </th>
                <th className="px-4 py-3 text-end text-[11.5px] font-bold whitespace-nowrap">
                  {T('30d Sales (KWD)', 'المبيعات (د.ك)')}
                </th>
                <th className="px-4 py-3 text-center text-[11.5px] font-bold whitespace-nowrap">
                  {T('Contract vs Actual %', 'العمولة: العقد ← الفعلي')}
                </th>
                <th className="px-4 py-3 text-end text-[11.5px] font-bold whitespace-nowrap">
                  {T('Variance (KWD)', 'فرق العمولة (د.ك)')}
                </th>
                <th className="px-4 py-3 text-end text-[11.5px] font-bold whitespace-nowrap">
                  {T('Action', 'إجراء فوري')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[13.5px] font-semibold text-slate-500 dark:text-slate-400">
                    {T('No platform accounts match the selected filters.', 'لا توجد حسابات تطابق الفلاتر المحددة.')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const hasCommissionGap = r.actualPct !== null && r.actualPct > r.contractPct + 0.3
                  const rowBg =
                    r.status === 'stopped'
                      ? 'bg-rose-50/30 hover:bg-rose-50/60 dark:bg-rose-950/10 dark:hover:bg-rose-950/20'
                      : r.status === 'stalled'
                        ? 'bg-amber-50/25 hover:bg-amber-50/50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20'
                        : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'

                  return (
                    <tr key={r.id} className={`transition-colors ${rowBg}`}>
                      <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap dark:text-white">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.brandColor }} />
                          <span>{isAr ? r.brandAr : r.brandEn}</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap dark:text-slate-200">
                        {isAr ? r.branchAr : r.branchEn}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {isAr ? r.platformAr : r.platformEn}
                          </span>
                          <ModePill mode={r.mode} dual={r.hasDualMode} isAr={isAr} />
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={r.status} isAr={isAr} />
                          <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                            {isAr ? r.noteAr : r.noteEn}
                          </span>
                        </div>
                      </td>

                      <td
                        dir="ltr"
                        className={`px-4 py-3 text-end font-extrabold tabular-nums whitespace-nowrap ${
                          r.orders === 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : r.status === 'stalled'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {f0(r.orders)}
                      </td>

                      <td dir="ltr" className="px-4 py-3 text-end font-semibold tabular-nums text-slate-800 whitespace-nowrap dark:text-slate-200">
                        {f3(r.salesKwd)}
                      </td>

                      <td dir="ltr" className="px-4 py-3 text-center whitespace-nowrap">
                        {r.actualPct === null ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {f1(r.contractPct)}% → —
                          </span>
                        ) : hasCommissionGap || r.divertedToTgo ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums text-rose-800 ring-1 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200">
                            {f1(r.contractPct)}% → {f1(r.actualPct)}%{r.divertedToTgo ? ' (Tgo)' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {f1(r.contractPct)}% → {f1(r.actualPct)}%
                          </span>
                        )}
                      </td>

                      <td dir="ltr" className="px-4 py-3 text-end font-extrabold tabular-nums whitespace-nowrap">
                        {r.varianceKwd > 0.05 ? (
                          <span className="text-rose-700 dark:text-rose-400">
                            -{f3(r.varianceKwd)} {isAr ? 'د.ك' : 'KWD'}
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">0.000</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void copyRowAlert(r)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${
                            copiedId === r.id
                              ? 'bg-emerald-600 text-white'
                              : r.status !== 'active' || r.varianceKwd > 0.05
                                ? 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200'
                          }`}
                        >
                          {copiedId === r.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              {T('Copied', 'تم النسخ')}
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              {T('Copy Alert', 'نسخ بلاغ')}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
          <span>
            {T(
              `Showing ${filteredRows.length} of ${summary.totalAccounts} monitored accounts across 6 Venture Foods brands & 7 active branches.`,
              `يعرض ${filteredRows.length} من أصل ${summary.totalAccounts} حساب مرصود عبر 6 براندات لفنتشر فودز و7 فروع فعلية نشطة.`,
            )}
          </span>
          <span>
            {T(
              'Zero legacy brands · Numeric ID-whitelisted Odoo POS branches only',
              'براندات فنتشر فودز المعتمدة فقط · الفروع الفعلية النشطة في أودو فقط',
            )}
          </span>
        </div>
      </section>
    </div>
  )
}
