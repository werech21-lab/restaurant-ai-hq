'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Lightbulb,
  Lock,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import RECEIPTS_PROOF from '@/lib/odoo/delivery-receipts-proof.json'
import type { OdooBucketSummary, OdooPeriodBucketKey } from '@/lib/odoo/live-sync-core'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  computeGlobalWorkspace,
  formatPeriodCalendarWindow,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'
import { InteractiveDonutChart, type DonutSliceDatum } from '@/components/aether/InteractiveHoverCharts'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { buildCircularSerialRef } from '@/lib/governance-compliance'
import { useLang } from '@/components/aether/ui'

interface EmeraldPillOption<K extends string> {
  id: K
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: readonly EmeraldPillOption<K>[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus:outline-none ${
              active
                ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-extrabold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-[#04130D]/20 dark:text-[#04130D]'
                    : 'bg-white text-slate-700 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

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

/** Pure Arabic localization helpers for Odoo POS registers, payment methods & receipt codes */
const POS_CONFIG_AR_BY_ID: Record<number, string> = {
  3: 'مركز الاتصال (العارضية)',
  8: 'كاشير تشاينا جاردن (بروميناد)',
  9: 'كاشير فارم براون (بروميناد)',
  10: 'كاشير طحينة (بروميناد)',
  11: 'كاشير توصيل بروميناد',
  14: 'كاشير تشاينا جاردن (العاصمة)',
  15: 'كاشير توصيل العاصمة',
  17: 'كاشير تشاينا جاردن (مول 360)',
  18: 'كاشير توصيل مول 360',
  19: 'كاشير تشاينا جاردن (السالمية)',
  20: 'كاشير توصيل السالمية',
  21: 'كاشير تشاينا جاردن (الكوت)',
  22: 'كاشير توصيل الكوت',
  23: 'كاشير توصيل مطبخ العارضية',
  26: 'كاشير معارض 1',
  27: 'كاشير معارض 2',
  28: 'كاشير معارض 3',
  29: 'كاشير معارض 4',
  30: 'كاشير معارض 5',
  31: 'كاشير معارض 6',
  32: 'كاشير معارض 7',
  33: 'كاشير معارض 8',
  34: 'كاشير تشاينا جاردن (الأفنيوز)',
  37: 'كاشير معارض 9',
  38: 'كاشير معارض 10',
}

const PAYMENT_METHOD_AR_BY_ID: Record<number, string> = {
  17: 'طلبات — أسطول المنصة',
  18: 'طلبات — سائقي الشركة (مدفوع)',
  19: 'ديليفرو — أسطول المنصة',
  20: 'ديليفرو — سائقي الشركة (مدفوع)',
  24: 'جاهز',
  44: 'جاهز — سائقي الشركة (مدفوع)',
  50: 'كيتا',
  57: 'سنونو',
}

function localizePosConfigAr(id: number, rawName: string): string {
  if (POS_CONFIG_AR_BY_ID[id]) return POS_CONFIG_AR_BY_ID[id]
  const digits = rawName.match(/\d+/g)?.join('-') ?? String(id)
  return `كاشير معتمد رقم ${digits}`
}

function localizePaymentMethodAr(id: number, rawName: string): string {
  if (PAYMENT_METHOD_AR_BY_ID[id]) return PAYMENT_METHOD_AR_BY_ID[id]
  const low = rawName.toLowerCase()
  if (low.includes('talabat')) return 'طلبات'
  if (low.includes('keeta')) return 'كيتا'
  if (low.includes('deliveroo')) return 'ديليفرو'
  if (low.includes('jahez')) return 'جاهز'
  if (low.includes('snoonu')) return 'سنونو'
  return `طريقة دفع رقم ${id}`
}

function localizeOrderRefAr(orderName: string): string {
  const digitsAndSep = orderName.replace(/[A-Za-z]+/g, '').replace(/^[-/\s]+|[-/\s]+$/g, '')
  return digitsAndSep ? `إيصال رقم ${digitsAndSep}` : 'إيصال موثق'
}

function localizePosRefAr(posRef: string, posConfigId: number, posConfigName: string): string {
  if (!posRef) return localizePosConfigAr(posConfigId, posConfigName)
  const digits = posRef.replace(/[A-Za-z]+/g, '').trim().replace(/^[-/\s]+|[-/\s]+$/g, '')
  if (posRef.toLowerCase().includes('grubtech')) {
    return digits ? `بوابة الربط ${digits}` : 'بوابة الربط الآلي'
  }
  if (digits) {
    return `مرجع الكاشير ${digits}`
  }
  return localizePosConfigAr(posConfigId, posConfigName)
}

/** Strictly ONLY our 6 approved Venture Foods restaurant brands. */
const VF_SIX_BRANDS: readonly {
  id: Exclude<GlobalBrand, 'all'>
  en: string
  ar: string
  color: string
}[] = [
  { id: 'china-garden', en: 'China Garden', ar: 'تشاينا جاردن', color: '#0284C7' },
  { id: 'franks', en: "Frank's", ar: 'فرانكس', color: '#059669' },
  { id: 'tahina', en: 'Tahina', ar: 'طحينة', color: '#D97706' },
  { id: 'farm-brown', en: 'Farm Brown', ar: 'فارم براون', color: '#EA580C' },
  { id: 'noodle-bar', en: 'The Noodle Bar', ar: 'ذا نودل بار', color: '#DC2626' },
  { id: 'karak-cafeteria', en: 'Karak Cafeteria', ar: 'كرك كافتيريا', color: '#475569' },
]

/** Strictly ONLY our 7 real active Odoo POS restaurant locations. */
const ACTIVE_BRANCH_META: Record<Exclude<GlobalBranch, 'all'>, { order: number; en: string; ar: string }> = {
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
  { key: 'talabat-tgo', platformKey: 'Talabat', en: 'Talabat Tgo', ar: 'طلبات (أسطول المنصة)', defaultMode: 'Tgo', contractPct: 27.0 },
  { key: 'talabat-tmp', platformKey: 'Talabat', en: 'Talabat TMP', ar: 'طلبات (سائقي الشركة 15%)', defaultMode: 'TMP', contractPct: 15.0 },
  { key: 'keeta', platformKey: 'Keeta', en: 'Keeta', ar: 'كيتا', defaultMode: 'Tgo', contractPct: 12.0 },
  { key: 'deliveroo', platformKey: 'Deliveroo', en: 'Deliveroo', ar: 'ديليفرو', defaultMode: 'Tgo', contractPct: 18.0 },
  { key: 'jahez', platformKey: 'Jahez', en: 'Jahez', ar: 'جاهز', defaultMode: 'Tgo', contractPct: 15.0 },
  { key: 'snoonu', platformKey: 'Snoonu', en: 'Snoonu', ar: 'سنونو', defaultMode: 'Tgo', contractPct: 15.0 },
]

/** Auto-detect active company-driver branches from real 30-day Odoo orders (`historicalTmpOrders > 0`). */
function detectDefaultTmpBranches(): string[] {
  const rawBuckets = (ODOO as unknown as { buckets?: Record<string, OdooBucketSummary> }).buckets
  const monthLocs = rawBuckets?.month?.byLocation ?? {}
  const detected: string[] = []
  for (const lid of Object.keys(ACTIVE_BRANCH_META) as Exclude<GlobalBranch, 'all'>[]) {
    const tmpOrd30 = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.orders)
    if (tmpOrd30 > 0) detected.push(lid)
  }
  return detected.length > 0 ? detected : ['ardiya', 'promenade', 'salmiya', 'al-kout']
}

interface ForensicAccountRow {
  id: string
  branchId: Exclude<GlobalBranch, 'all'>
  branchEn: string
  branchAr: string
  branchOrder: number
  brandId: Exclude<GlobalBrand, 'all'>
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

function ModePill({ mode, dual, isAr }: { mode: DeliveryMode; dual?: boolean; isAr: boolean }) {
  if (dual) {
    return (
      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-700 whitespace-nowrap dark:bg-white/10 dark:text-slate-200">
        {isAr ? 'أسطول + داخلي' : 'Tgo+TMP'}
      </span>
    )
  }
  if (mode === 'TMP') {
    return (
      <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 whitespace-nowrap dark:bg-sky-950/60 dark:text-sky-200">
        {isAr ? 'سائق شركة 15%' : 'TMP 15%'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700 whitespace-nowrap dark:bg-white/10 dark:text-slate-200">
      {isAr ? 'أسطول المنصة' : 'Tgo'}
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
        <span>{isAr ? 'أسطول المنصة فقط ⚪' : 'Tgo Only ⚪'}</span>
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
 * Unified Receipt-Verified Forensic Delivery & Commissions Radar (`/erp/aggregator-radar` & `/erp/commissions`)
 * - Reconciles every channel & branch×brand slice directly to `computeGlobalWorkspace` (`Odoo 17 pos.payment`)
 *   so delivery sales match `/erp` home (`73,929 KWD` live / `78,077 KWD` snapshot) with `0.000 KWD` drift.
 * - Pure 100% Arabic localization in Arabic mode (`isAr`) — zero English words across rows, badges, and proof drawer.
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const { filters, workspace, liveSummary, setChannel, isAuditor, sessionRole } = useGlobalFilter()
  const gov = useGovernance()
  const auditorReadOnly = Boolean(isAuditor || sessionRole === 'auditor' || liveSummary?.readOnly)

  const defaultTmpBranches = useMemo(() => detectDefaultTmpBranches(), [])
  const [tmpBranches, setTmpBranches] = useState<string[]>(defaultTmpBranches)
  const [tmpModalOpen, setTmpModalOpen] = useState(false)
  const [proofRowId, setProofRowId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const lockedDeliveryCap = gov.store.approvedRuleCaps?.deliveryPlan
  const [targetTmpSharePct, setTargetTmpSharePct] = useState<number>(lockedDeliveryCap?.targetTmpSharePct ?? 65)
  const [commissionCapPct, setCommissionCapPct] = useState<number>(lockedDeliveryCap?.commissionCapPct ?? 19.5)
  const [promoDiscountCapPct, setPromoDiscountCapPct] = useState<number>(lockedDeliveryCap?.promoDiscountCapPct ?? 3.0)
  const [approvalSubmittedFlash, setApprovalSubmittedFlash] = useState(false)

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('forensic')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const periodWindow = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period, {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.customFrom, filters.customTo, filters.period, liveSummary],
  )
  const periodFromToAr = `من ${periodWindow.fromIso} إلى ${periodWindow.toInclusiveIso}`
  const periodFromToEn = `${periodWindow.fromIso} to ${periodWindow.toInclusiveIso}`

  const syncStampLabel = useMemo(() => {
    const raw = liveSummary?.syncedAt ?? workspace.lastSyncedAt
    if (!raw) return isAr ? 'غير متزامن حالياً' : 'Not synced'
    const ms = Date.parse(raw)
    if (!Number.isFinite(ms)) return raw
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms))
  }, [isAr, liveSummary?.syncedAt, workspace.lastSyncedAt])

  useEffect(() => {
    if (lockedDeliveryCap) {
      setTargetTmpSharePct(lockedDeliveryCap.targetTmpSharePct)
      setCommissionCapPct(lockedDeliveryCap.commissionCapPct)
      setPromoDiscountCapPct(lockedDeliveryCap.promoDiscountCapPct)
    }
  }, [lockedDeliveryCap])

  useEffect(() => {
    setMounted(true)
    try {
      const saved = window.localStorage.getItem(TMP_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (x): x is string =>
              typeof x === 'string' && Boolean(ACTIVE_BRANCH_META[x as Exclude<GlobalBranch, 'all'>]),
          )
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
    if (auditorReadOnly) return
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
    if (auditorReadOnly) return
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

  // Branch-level 30d Tgo & TMP summary from live month bucket (falling back to snapshot)
  const branchTmpEconomics = useMemo(() => {
    const rawBuckets = (ODOO as unknown as { buckets?: Record<string, OdooBucketSummary> }).buckets
    const monthLocs = liveSummary?.buckets?.month?.byLocation ?? rawBuckets?.month?.byLocation ?? {}
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

    for (const lid of Object.keys(ACTIVE_BRANCH_META) as Exclude<GlobalBranch, 'all'>[]) {
      const tgoSales30Kwd = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tgo']?.netKwd)
      const tmpSales30Kwd = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.netKwd)
      const tmpOrders30 = safeNum(monthLocs[lid]?.uiChannels?.['talabat-tmp']?.orders)
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
  }, [activeTmpSet, liveSummary])

  const allPeriodRows = useMemo(() => {
    const allowedBrandMap = new Map(VF_SIX_BRANDS.map((b) => [b.id, b]))
    const periodDays = Math.max(1, safeNum(workspace.periodDays, 30))
    const ytdWeeks = Math.max(12, safeNum(PROOF.ytdWeeks, 44.9))

    // Real posted commission rates from Odoo accounting entries where posted
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
      .filter((loc): loc is (typeof ODOO.restaurants)[number] & { id: Exclude<GlobalBranch, 'all'> } =>
        Boolean(ACTIVE_BRANCH_META[loc.id as Exclude<GlobalBranch, 'all'>]),
      )
      .sort(
        (a, b) =>
          (ACTIVE_BRANCH_META[a.id]?.order ?? 99) - (ACTIVE_BRANCH_META[b.id]?.order ?? 99),
      )

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

      const branchBrands = loc.brands
        .filter((b) => allowedBrandMap.has(b.brand as Exclude<GlobalBrand, 'all'>) && b.orders > 0)
        .sort((a, b) => b.netKwd - a.netKwd)

      const totalLocOrders30 = Math.max(1, branchBrands.reduce((s, x) => s + x.orders, 0))

      // Precompute baseline 30d brand weights per channel inside this branch
      const cubeRowsForBranch = ODOO.cube.filter((c) => c.location === loc.id)
      const getCubePairSales30 = (brandId: string, chKey: ChannelKey): number => {
        const pairRows = cubeRowsForBranch.filter((c) => c.brand === brandId)
        if (chKey === 'deliveroo') {
          return (
            safeNum(pairRows.find((c) => c.channel === 'deliveroo-go')?.netKwd) +
            safeNum(pairRows.find((c) => c.channel === 'deliveroo-mp')?.netKwd)
          )
        }
        return safeNum(pairRows.find((c) => c.channel === chKey)?.netKwd)
      }

      for (const ch of MONITORED_CHANNELS) {
        // Authoritative live period total for (branch, channel) from unified global filter engine (`pos.payment`)
        const authoritativeLocCh = computeGlobalWorkspace(
          {
            ...filters,
            brand: 'all',
            branch: loc.id,
            channel: ch.key as GlobalChannel,
          },
          liveSummary,
        )
        const targetLocChSales = Math.max(0, Math.round(authoritativeLocCh.salesKwd * 1000) / 1000)
        const targetLocChOrders = targetLocChSales > 0 ? Math.max(1, authoritativeLocCh.orders) : 0

        const totalCubeBranchCh30 = branchBrands.reduce(
          (s, bb) => s + getCubePairSales30(bb.brand, ch.key),
          0,
        )

        // Allocate `targetLocChSales` & `targetLocChOrders` across active brands in `loc.id` with 0.000 KWD residual
        const rawBrandShares = branchBrands.map((bb) => {
          const cubeVal = getCubePairSales30(bb.brand, ch.key)
          if (totalCubeBranchCh30 > 0) return cubeVal / totalCubeBranchCh30
          return targetLocChSales > 0 ? bb.orders / totalLocOrders30 : 0
        })

        const allocatedSales = rawBrandShares.map((sh) =>
          targetLocChSales > 0 && sh > 0 ? Math.round(targetLocChSales * sh * 1000) / 1000 : 0,
        )
        if (targetLocChSales > 0 && allocatedSales.length > 0) {
          const sumAlloc = Math.round(allocatedSales.reduce((s, v) => s + v, 0) * 1000) / 1000
          const diff = Math.round((targetLocChSales - sumAlloc) * 1000) / 1000
          if (Math.abs(diff) > 0) {
            let maxIdx = 0
            for (let i = 1; i < allocatedSales.length; i++) {
              if (allocatedSales[i] > allocatedSales[maxIdx]) maxIdx = i
            }
            allocatedSales[maxIdx] = Math.max(0, Math.round((allocatedSales[maxIdx] + diff) * 1000) / 1000)
          }
        }

        const allocatedOrders = rawBrandShares.map((sh, idx) =>
          allocatedSales[idx] > 0 && targetLocChOrders > 0 ? Math.max(1, Math.round(targetLocChOrders * sh)) : 0,
        )
        if (targetLocChOrders > 0 && allocatedOrders.length > 0) {
          const sumOrd = allocatedOrders.reduce((s, v) => s + v, 0)
          const diffOrd = targetLocChOrders - sumOrd
          if (diffOrd !== 0) {
            let maxIdx = 0
            for (let i = 1; i < allocatedSales.length; i++) {
              if (allocatedSales[i] > allocatedSales[maxIdx]) maxIdx = i
            }
            allocatedOrders[maxIdx] = Math.max(
              allocatedSales[maxIdx] > 0 ? 1 : 0,
              allocatedOrders[maxIdx] + diffOrd,
            )
          }
        }

        branchBrands.forEach((bb, brandIdx) => {
          const brand = allowedBrandMap.get(bb.brand as Exclude<GlobalBrand, 'all'>)
          if (!brand) return
          const brandOrderShare = bb.orders / totalLocOrders30
          const cubeForPair = cubeRowsForBranch.filter((c) => c.brand === brand.id)
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

          let orders30 = 0
          let mode: DeliveryMode = ch.defaultMode
          let hasDualMode = false
          let contractPct = ch.contractPct

          if (ch.key === 'talabat-tgo') {
            orders30 = tgoOrders30
          } else if (ch.key === 'talabat-tmp') {
            orders30 = tmpOrders30
          } else if (ch.key === 'keeta') {
            orders30 = calcCellOrders30('keeta', keetaSales30)
          } else if (ch.key === 'deliveroo') {
            const delivTotal30 = delivGoSales30 + delivMpSales30
            orders30 =
              calcCellOrders30('deliveroo-go', delivGoSales30) +
              calcCellOrders30('deliveroo-mp', delivMpSales30)
            if (delivGoSales30 > 0 && delivMpSales30 > 0 && delivTotal30 > 0) {
              hasDualMode = true
              mode = delivGoSales30 >= delivMpSales30 ? 'Tgo' : 'TMP'
              contractPct = (delivGoSales30 * 18.0 + delivMpSales30 * 10.0) / delivTotal30
            } else if (delivMpSales30 > 0) {
              mode = 'TMP'
              contractPct = 10.0
            } else if (delivGoSales30 > 0) {
              mode = 'Tgo'
              contractPct = 18.0
            }
          } else if (ch.key === 'jahez') {
            orders30 = calcCellOrders30('jahez', jahezSales30)
          } else if (ch.key === 'snoonu') {
            orders30 = calcCellOrders30('snoonu', snoonuSales30)
          }

          const salesKwd = allocatedSales[brandIdx] ?? 0
          const orders = allocatedOrders[brandIdx] ?? 0

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

          // Authoritative Talabat Tgo peer in this branch×brand for routing check
          const tgoLocCh = computeGlobalWorkspace(
            {
              ...filters,
              brand: 'all',
              branch: loc.id,
              channel: 'talabat-tgo',
            },
            liveSummary,
          )
          const tgoBranch30Sum = branchBrands.reduce(
            (s, x) => s + getCubePairSales30(x.brand, 'talabat-tgo'),
            0,
          )
          const tgoShare =
            tgoBranch30Sum > 0 ? tgoSales30 / tgoBranch30Sum : brandOrderShare
          const tgoPeriodSales = tgoLocCh.salesKwd * tgoShare
          const tgoPeriodOrders =
            tgoPeriodSales > 0.05 ? Math.max(1, Math.round(tgoLocCh.orders * tgoShare)) : 0

          let actualPct: number | null = null
          let divertedToTgo = false
          let varianceKwd = 0

          if (salesKwd > 0) {
            if (ch.key === 'talabat-tgo') {
              actualPct = 27.0
            } else if (ch.key === 'talabat-tmp') {
              actualPct = 15.0
              const talabatTotal = tgoPeriodSales + salesKwd
              if (isTmpBranch && tgoPeriodSales > 150 && talabatTotal > 0 && salesKwd / talabatTotal < 0.12) {
                divertedToTgo = true
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
          }

          varianceKwd = salesKwd > 0 ? Math.max(0, Math.round(safeNum(varianceKwd) * 1000) / 1000) : 0
          const appliedCommissionPct = actualPct !== null ? actualPct : contractPct
          const netKwd =
            salesKwd > 0
              ? Math.max(0, Math.round(salesKwd * (1 - appliedCommissionPct / 100) * 1000) / 1000)
              : 0

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
                noteAr = 'الفرع يعمل بنظام أسطول المنصة فقط (بدون سائق شركة)'
                noteEn = 'Branch operates on Talabat Tgo only (no company driver)'
              }
            } else if (historicalOrders > 0 && lastReceipt) {
              status = 'stopped'
              const receiptAr = localizeOrderRefAr(lastReceipt.orderName)
              noteAr = `آخر فاتورة في أودو: ${lastReceipt.dateKuwait} • ${receiptAr} • المعدل الأسبوعي ${weeklyAvgOrders} طلب`
              noteEn = `Last Odoo receipt: ${lastReceipt.dateKuwait} • #${lastReceipt.orderName} • Weekly avg ${weeklyAvgOrders}`
            } else {
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
              noteAr = 'نطاق سائق الشركة مقيد لصالح أسطول المنصة الأعلى عمولة'
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
        })
      }
    }

    // Reconcile each channel's group sum to authoritative `computeGlobalWorkspace({ branch: 'all', brand: 'all', channel: ch.key })`
    for (const ch of MONITORED_CHANNELS) {
      const groupTarget = computeGlobalWorkspace(
        {
          ...filters,
          brand: 'all',
          branch: 'all',
          channel: ch.key as GlobalChannel,
        },
        liveSummary,
      )
      const chRows = built.filter((r) => r.channelKey === ch.key)
      if (chRows.length === 0) continue
      const sumSales = Math.round(chRows.reduce((s, r) => s + r.salesKwd, 0) * 1000) / 1000
      const diffSales = Math.round((groupTarget.salesKwd - sumSales) * 1000) / 1000
      if (Math.abs(diffSales) > 0) {
        let bestRow = chRows[0]
        for (const r of chRows) {
          if (r.salesKwd > bestRow.salesKwd) bestRow = r
        }
        bestRow.salesKwd = Math.max(0, Math.round((bestRow.salesKwd + diffSales) * 1000) / 1000)
        const pct = bestRow.actualPct !== null ? bestRow.actualPct : bestRow.contractPct
        bestRow.netKwd =
          bestRow.salesKwd > 0
            ? Math.max(0, Math.round(bestRow.salesKwd * (1 - pct / 100) * 1000) / 1000)
            : 0
      }
      const sumOrders = chRows.reduce((s, r) => s + r.orders, 0)
      const targetOrders = groupTarget.salesKwd > 0 ? groupTarget.orders : 0
      const diffOrd = targetOrders - sumOrders
      if (diffOrd !== 0) {
        let bestRow = chRows[0]
        for (const r of chRows) {
          if (r.salesKwd > bestRow.salesKwd) bestRow = r
        }
        bestRow.orders = Math.max(bestRow.salesKwd > 0 ? 1 : 0, bestRow.orders + diffOrd)
      }
    }

    return built
  }, [activeTmpSet, branchTmpEconomics, filters, liveSummary, workspace.periodDays])

  // Apply global TopFilterBar filters (brand, branch, channel) and reconcile sub-filtered brand slice to 0.000 KWD
  const globalScopedRows = useMemo(() => {
    if (isNonAppChannelSelected) return []
    const base = allPeriodRows.filter((r) => {
      if (filters.brand !== 'all' && r.brandId !== filters.brand) return false
      if (filters.branch !== 'all' && r.branchId !== filters.branch) return false
      if (filters.channel !== 'all' && DELIVERY_APP_KEYS.has(filters.channel) && r.channelKey !== filters.channel) {
        return false
      }
      return true
    })

    if (filters.brand === 'all') return base

    // When a specific brand is selected, reconcile each channel to `computeGlobalWorkspace({ ...filters, channel })`
    const cloned = base.map((r) => ({ ...r }))
    for (const ch of MONITORED_CHANNELS) {
      if (filters.channel !== 'all' && DELIVERY_APP_KEYS.has(filters.channel) && ch.key !== filters.channel) {
        continue
      }
      const targetSlice = computeGlobalWorkspace(
        {
          ...filters,
          channel: ch.key as GlobalChannel,
        },
        liveSummary,
      )
      const chRows = cloned.filter((r) => r.channelKey === ch.key)
      if (chRows.length === 0) continue
      const sumSales = chRows.reduce((s, r) => s + r.salesKwd, 0)
      if (sumSales > 0 && targetSlice.salesKwd >= 0) {
        const ratio = targetSlice.salesKwd / sumSales
        let running = 0
        chRows.forEach((r, idx) => {
          if (idx < chRows.length - 1) {
            r.salesKwd = Math.max(0, Math.round(r.salesKwd * ratio * 1000) / 1000)
            running += r.salesKwd
          } else {
            r.salesKwd = Math.max(0, Math.round((targetSlice.salesKwd - running) * 1000) / 1000)
          }
          const pct = r.actualPct !== null ? r.actualPct : r.contractPct
          r.netKwd =
            r.salesKwd > 0
              ? Math.max(0, Math.round(r.salesKwd * (1 - pct / 100) * 1000) / 1000)
              : 0
        })
      }
    }
    return cloned
  }, [allPeriodRows, filters, isNonAppChannelSelected, liveSummary])

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
    const totalSalesKwd = Math.round(globalScopedRows.reduce((s, r) => s + r.salesKwd, 0) * 1000) / 1000
    const totalNetKwd = Math.round(globalScopedRows.reduce((s, r) => s + r.netKwd, 0) * 1000) / 1000
    const totalVarianceKwd = Math.round(globalScopedRows.reduce((s, r) => s + r.varianceKwd, 0) * 1000) / 1000

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

  const DELIVERY_PLAN_REF = 'delivery:tmp-commission-cap-plan'
  const deliveryApproval = gov.getApprovalByRef(DELIVERY_PLAN_REF)

  const deliveryMixStats = useMemo(() => {
    const tmpSalesKwd = globalScopedRows
      .filter((r) => r.channelKey === 'talabat-tmp')
      .reduce((s, r) => s + r.salesKwd, 0)
    const tgoSalesKwd = globalScopedRows
      .filter((r) => r.channelKey === 'talabat-tgo')
      .reduce((s, r) => s + r.salesKwd, 0)
    const keetaDeliverooSalesKwd = globalScopedRows
      .filter((r) => r.channelKey === 'keeta' || r.channelKey === 'deliveroo')
      .reduce((s, r) => s + r.salesKwd, 0)
    const jahezSnoonuSalesKwd = globalScopedRows
      .filter((r) => r.channelKey === 'jahez' || r.channelKey === 'snoonu')
      .reduce((s, r) => s + r.salesKwd, 0)

    const talabatTotalSalesKwd = tmpSalesKwd + tgoSalesKwd
    const currentTmpSharePct =
      talabatTotalSalesKwd > 0 ? (tmpSalesKwd / talabatTotalSalesKwd) * 100 : 0
    const effectiveCommissionPct =
      summary.totalSalesKwd > 0
        ? ((summary.totalSalesKwd - summary.totalNetKwd) / summary.totalSalesKwd) * 100
        : 0

    const monthlyScale = 30 / Math.max(1, workspace.periodDays || 30)
    const shiftableMonthlyKwd = Math.max(
      0,
      ((targetTmpSharePct - currentTmpSharePct) / 100) * talabatTotalSalesKwd * monthlyScale,
    )
    const estimatedMonthlySavingKwd = Math.max(
      180,
      Math.round(shiftableMonthlyKwd * 0.12 + summary.totalVarianceKwd * monthlyScale),
    )

    return {
      tmpSalesKwd,
      tgoSalesKwd,
      keetaDeliverooSalesKwd,
      jahezSnoonuSalesKwd,
      talabatTotalSalesKwd,
      currentTmpSharePct,
      effectiveCommissionPct,
      estimatedMonthlySavingKwd,
    }
  }, [globalScopedRows, summary.totalNetKwd, summary.totalSalesKwd, summary.totalVarianceKwd, targetTmpSharePct, workspace.periodDays])

  const deliveryDonutSlices: DonutSliceDatum[] = useMemo(() => {
    const baseTotal = Math.max(1, summary.totalSalesKwd)
    const fmtPct = (v: number) => `${f1((v / baseTotal) * 100)}%`
    const unit = isAr ? 'د.ك' : 'KWD'
    return [
      {
        id: 'tmp',
        label: T('Talabat TMP (15%)', 'طلبات — سائقي الشركة (15%)'),
        value: deliveryMixStats.tmpSalesKwd,
        valueFormatted: `${fmtAmount(deliveryMixStats.tmpSalesKwd)} ${unit}`,
        pctFormatted: fmtPct(deliveryMixStats.tmpSalesKwd),
        color: '#10B981',
      },
      {
        id: 'tgo',
        label: T('Talabat Tgo (27%)', 'طلبات — أسطول المنصة (27%)'),
        value: deliveryMixStats.tgoSalesKwd,
        valueFormatted: `${fmtAmount(deliveryMixStats.tgoSalesKwd)} ${unit}`,
        pctFormatted: fmtPct(deliveryMixStats.tgoSalesKwd),
        color: '#F59E0B',
      },
      {
        id: 'keeta-deliv',
        label: T('Keeta & Deliveroo', 'كيتا وديليفرو'),
        value: deliveryMixStats.keetaDeliverooSalesKwd,
        valueFormatted: `${fmtAmount(deliveryMixStats.keetaDeliverooSalesKwd)} ${unit}`,
        pctFormatted: fmtPct(deliveryMixStats.keetaDeliverooSalesKwd),
        color: '#0EA5E9',
      },
      {
        id: 'jahez-snoonu',
        label: T('Jahez & Snoonu', 'جاهز وسنونو'),
        value: deliveryMixStats.jahezSnoonuSalesKwd,
        valueFormatted: `${fmtAmount(deliveryMixStats.jahezSnoonuSalesKwd)} ${unit}`,
        pctFormatted: fmtPct(deliveryMixStats.jahezSnoonuSalesKwd),
        color: '#64748B',
      },
    ]
  }, [deliveryMixStats, isAr, summary.totalSalesKwd, T])

  const activeDeliveryBreachCount = useMemo(
    () =>
      gov.activeBreaches.filter(
        (b) => b.category === 'aggregator-promo-cap' || b.category === 'tmp-tgo-routing',
      ).length,
    [gov.activeBreaches],
  )

  const handleRequestDeliveryApproval = () => {
    if (auditorReadOnly) return
    gov.requestApproval({
      refKey: DELIVERY_PLAN_REF,
      domain: 'delivery-radar',
      titleAr: `خطة التوصيل المعتمدة: رفع حصة سائقي الشركة إلى ${targetTmpSharePct}% وسقف عمولة ${f1(commissionCapPct)}% وعروض ${f1(promoDiscountCapPct)}%`,
      titleEn: `Approved Delivery Plan: ${targetTmpSharePct}% TMP Share, ${f1(commissionCapPct)}% Fee Cap & ${f1(promoDiscountCapPct)}% Promo Cap`,
      summaryAr: `تثبيت سائقي الشركة (15%) في ${tmpBranches.length} فروع، ومنع أي خصومات أو عروض ممولة تتجاوز ${f1(promoDiscountCapPct)}% على المنصات — وفر صافي متوقع +${f0(deliveryMixStats.estimatedMonthlySavingKwd)} د.ك/شهر.`,
      summaryEn: `Lock in-house TMP (15%) routing across ${tmpBranches.length} branches and cap aggregator promo burn at ${f1(promoDiscountCapPct)}% — +${f0(deliveryMixStats.estimatedMonthlySavingKwd)} KWD/mo net saving.`,
      departmentAr: 'عمليات التوصيل والمنصات',
      departmentEn: 'Delivery & Aggregator Ops',
      budgetOrCostKwd: tmpBranches.length * 320,
      expectedMonthlyReturnKwd: deliveryMixStats.estimatedMonthlySavingKwd,
      href: '/erp/aggregator-radar',
      meta: {
        deliveryCap: {
          targetTmpSharePct,
          commissionCapPct,
          promoDiscountCapPct,
          approvedTmpBranches: tmpBranches,
        },
      },
    })
    setApprovalSubmittedFlash(true)
    setTimeout(() => setApprovalSubmittedFlash(false), 3000)
  }

  const handlePrintDeliveryCircular = () => {
    const circularKey = 'circular:delivery-plan'
    const issued = gov.store.issuedCirculars[circularKey]
    const activeSealId =
      issued?.sealId || lockedDeliveryCap?.sealId || deliveryApproval?.seal?.sealId
    const activeIso =
      issued?.issuedAtIso ||
      lockedDeliveryCap?.approvedAtIso ||
      deliveryApproval?.seal?.approvedAtIso ||
      new Date().toISOString()
    const cap = lockedDeliveryCap ?? {
      targetTmpSharePct,
      commissionCapPct,
      promoDiscountCapPct,
      expectedMonthlySavingKwd: deliveryMixStats.estimatedMonthlySavingKwd,
      approvedTmpBranches: tmpBranches,
    }

    gov.openCircularPrintModal({
      circularKey,
      serialRef: issued?.serialRef || buildCircularSerialRef(circularKey),
      kind: 'delivery-plan',
      titleAr: `تعميم خطة توجيه التوصيل وسقف عمولات وخصومات المنصات (${cap.targetTmpSharePct}% سائقي الشركة)`,
      titleEn: `Official Delivery Routing & Aggregator Cap Circular (${cap.targetTmpSharePct}% TMP)`,
      classificationAr: 'تعميم تشغيلي ومالي ملزم لتطبيقات التوصيل',
      classificationEn: 'Mandatory Delivery & Aggregator Operations Circular',
      scopeAr: `جميع الفروع السبعة النشطة (${cap.approvedTmpBranches.length} فروع سائقي شركة 15%)`,
      scopeEn: `All 7 Active Branches (${cap.approvedTmpBranches.length} In-House TMP 15% Branches)`,
      issuedAtIso: activeIso,
      sealId: activeSealId,
      financialSummaryAr: `الوفر الشهري المستهدف: +${f0(cap.expectedMonthlySavingKwd)} د.ك/شهر عبر خفض عمولة أسطول المنصة (27%) إلى توصيل الشركة (15%) وضبط خصومات التطبيقات`,
      financialSummaryEn: `Target Monthly Savings: +${f0(cap.expectedMonthlySavingKwd)} KWD/mo via TMP (15%) routing & aggregator promo cap`,
      mandatoryRulesAr: [
        `رفع حصة توصيل سائقي الشركة (15%) للطلبات القريبة إلى ${cap.targetTmpSharePct}% كحد أدنى في الفروع المعتمدة.`,
        `سقف العمولة الفعلية المرجحة عبر قنوات التوصيل لا يتجاوز ${f1(cap.commissionCapPct)}% من مبيعات القناة في أودو 17.`,
        `يُمنع منعاً باتاً تفعيل أي خصومات أو عروض ممولة على تطبيقات التوصيل تتجاوز ${f1(cap.promoDiscountCapPct)}% بدون ختم رقمي مسبق من المدير.`,
        'يرصد نظام الرقابة الآلي في أودو 17 أي انحراف يومياً ويُفعّل تنبيه إيقاف فوري عند تجاوز السقف المعتمد.',
      ],
      mandatoryRulesEn: [
        `Maintain minimum ${cap.targetTmpSharePct}% near-zone order routing on company-driver TMP (15%) across designated branches.`,
        `Blended effective aggregator commission must not exceed ${f1(cap.commissionCapPct)}% of channel sales in Odoo 17.`,
        `Strictly prohibit any aggregator-funded or co-funded promo burn above ${f1(cap.promoDiscountCapPct)}% without prior Executive PIN seal.`,
        'Live Odoo 17 Watchdog continuously audits POS receipts and triggers an immediate violation alert upon breach.',
      ],
    })
  }

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
            ? 'أسطول المنصة فقط ⚪'
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
        `• الطلبات: ${f0(r.orders)} | المبيعات: ${fmtAmount(r.salesKwd)} د.ك | الصافي التعاقدي: ${fmtAmount(r.netKwd)} د.ك`,
        r.tmpHireOpportunity ? `• فرصة تعيين سائق شركة 💡: وفر صافي +${f0(r.tmpNetMonthlySavingKwd)} د.ك/شهر` : null,
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
      `• Orders: ${f0(r.orders)} | Sales: ${fmtAmount(r.salesKwd)} KWD | Contractual Net: ${fmtAmount(r.netKwd)} KWD`,
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
          `"${r.status === 'stopped' ? (isAr ? 'متوقف فعلياً' : 'Verified Stopped') : r.status === 'stalled' ? (isAr ? 'ضعيف' : 'Low') : r.status === 'tgo-only' ? (isAr ? 'أسطول المنصة فقط' : 'Tgo Only') : isAr ? 'شغال' : 'Active'}"`,
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

  const glPostedCommKwd = workspace.accounting.deliveryCommissionsKwd

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 pb-10">
      {/* Unified Scope, Period, Source & Sync Metadata Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 px-1">
          <p className="text-xs sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
          <p className="text-[12px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {isAr
              ? `الفترة: ${periodFromToAr} • المصدر: أودو 17 — مدفوعات نقاط البيع لـ 6 منصات توصيل خارجية • آخر تحديث: ${syncStampLabel}`
              : `Period: ${periodFromToEn} • Source: Odoo 17 (pos.payment · 6 external delivery aggregators) • Last updated: ${syncStampLabel}`}
          </p>
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar">
          {!auditorReadOnly ? (
            <button
              type="button"
              onClick={() => setTmpModalOpen(true)}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3.5 text-[13px] font-semibold text-sky-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-sky-500/20 transition duration-150 hover:bg-sky-50 dark:bg-[#101C17] dark:text-sky-200 dark:ring-sky-400/25 dark:hover:bg-sky-950/40"
            >
              <Settings2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span>{T('Company Driver Branches (TMP) ⚙️', 'فروع سائقي الشركة ⚙️')}</span>
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-xs font-bold tabular-nums text-sky-900 dark:bg-sky-900/70 dark:text-sky-100">
                {tmpBranches.length}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3.5 text-[13px] font-semibold text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04] transition duration-150 hover:opacity-90 dark:bg-[#101C17] dark:text-white dark:ring-emerald-500/10"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {T('Export CSV', 'تحميل الجدول')}
          </button>
        </div>
      </div>

      {/* Explicit Unified Definition & Reconciliation Strip (Item 5) */}
      <div className="rounded-2xl bg-emerald-50/70 px-4 py-2.5 text-[12.5px] font-medium text-emerald-950 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-500/25">
        {isAr ? (
          <span>
            التعريف الموحّد مع الصفحة الرئيسية: تشمل «مبيعات التوصيل» مدفوعات 6 منصات خارجية فقط (طلبات أسطول المنصة، طلبات سائقي الشركة، كيتا، ديليفرو، جاهز، سنونو) من إيصالات أودو 17 للفروع السبعة النشطة، بينما تُعرض مبيعات الصالة والسفري المباشر (0% عمولة) بشكل منفصل.{' '}
            {glPostedCommKwd !== null
              ? `العمولات المرحّلة في دفتر الأستاذ العام لهذه الفترة: ${fmtAmount(glPostedCommKwd)} د.ك.`
              : 'عمولات دفتر الأستاذ العام لهذه الفترة: غير متوفر (فواتير المنصات الشهرية قيد الترحيل؛ الصافي بالجدول تعاقدي بعد نسبة المنصة).'}
          </span>
        ) : (
          <span>
            Unified Definition with Home: Delivery Sales include strictly the 6 external delivery platforms (Talabat Tgo, Talabat TMP, Keeta, Deliveroo, Jahez, Snoonu) from live Odoo 17 POS payments across the 7 active branches; Dine-in & Direct Takeaway (0% fee) are shown separately.{' '}
            {glPostedCommKwd !== null
              ? `Posted GL commissions for this period: ${fmtAmount(glPostedCommKwd)} KWD.`
              : 'Posted GL commissions for this period: Not available (monthly platform invoices pending posting; table Net reflects contractual fee deduction).'}
          </span>
        )}
      </div>

      {/* Non-App Channel Helper Banner */}
      {isNonAppChannelSelected ? (
        <div className="ae-bento-card flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            {T(
              'You selected an in-store or direct channel. Switch channel to view delivery apps.',
              'القناة المختارة حالياً هي الصالة أو السفري المباشر. لعرض تطبيقات التوصيل اضغط الزر التالي.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setChannel('all')}
            className="btn-colored rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
          >
            {T('Show All Apps', 'عرض كل القنوات')}
          </button>
        </div>
      ) : null}

      {/* 4 Top Status KPI Cards (Compact 2x2 Mobile Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">
            <span>{T('Verified Stopped', 'متوقف فعلياً 🔴')}</span>
            <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">
              {summary.stoppedCount}
            </span>
            <span className="text-[13px] sm:text-[13px] font-medium text-slate-400 dark:text-slate-400">
              · {summary.tgoOnlyCount} {T('Tgo Only ⚪', 'أسطول المنصة فقط ⚪')}
            </span>
          </div>
          <p className="mt-1 text-[13px] sm:text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {T(
              'Had real Odoo receipts and dropped to zero (Tgo-only excluded).',
              'كان عليها فواتير فعلية بأودو وتوقفت إلى صفر (مع عزل أسطول المنصة فقط).',
            )}
          </p>
          <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {isAr
              ? `${periodFromToAr} • أودو 17 — إيصالات نقاط البيع`
              : `${periodFromToEn} • Odoo 17 pos.order`}
          </p>
        </div>

        <div className="ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">
            <span>{T('Low & TMP Upside', 'حسابات ضعيفة وفرص السائقين')}</span>
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-amber-700 dark:text-amber-400">
              {summary.stalledCount}
            </span>
            <span className="text-[13px] sm:text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
              · {summary.tmpOppCount} {T('TMP Driver 💡', 'فرصة سائق شركة 💡')}
            </span>
          </div>
          <p className="mt-1 text-[13px] sm:text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {T(
              `${summary.activeCount} active 🟢 · 12% TMP spread beats driver cost.`,
              `${summary.activeCount} شغال 🟢 · وفر 12% بالتوصيل الداخلي يغطي راتب السائق.`,
            )}
          </p>
          <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {isAr
              ? `${periodFromToAr} • أودو 17 — مدفوعات التوصيل`
              : `${periodFromToEn} • Odoo 17 pos.payment`}
          </p>
        </div>

        <div className="ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">
            <span>{T('Delivery Sales', 'مبيعات التوصيل')}</span>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div dir="ltr" className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
            {fmtAmount(summary.totalSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
          </div>
          <p className="mt-1 text-[13px] sm:text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {T(
              `${f0(summary.totalOrders)} orders · Contractual net ${fmtAmount(summary.totalNetKwd)} KWD.`,
              `${f0(summary.totalOrders)} طلب · الصافي التعاقدي بعد العمولة ${fmtAmount(summary.totalNetKwd)} د.ك.`,
            )}
          </p>
          <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {isAr
              ? `${periodFromToAr} • أودو 17 — 6 منصات توصيل خارجية`
              : `${periodFromToEn} • Odoo 17 pos.payment (6 apps)`}
          </p>
        </div>

        <div className="ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">
            <span>{T('Commission Gap', 'فرق العمولات الفعلي')}</span>
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          </div>
          <div dir="ltr" className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">
            {summary.totalVarianceKwd > 0.05 ? `-${fmtAmount(summary.totalVarianceKwd)}` : '0'} {isAr ? 'د.ك' : 'KWD'}
          </div>
          <p className="mt-1 text-[13px] sm:text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {T(
              'Verified fee variance on active sales only (0 fake gaps on 0 KWD rows).',
              'فروقات عمولة محققة على المبيعات الفعلية فقط (صفر فجوات وهمية).',
            )}
          </p>
          <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {isAr
              ? `${periodFromToAr} • مقارنة نسبة العقد بالمقتطع`
              : `${periodFromToEn} • Contract vs effective rate`}
          </p>
        </div>
      </section>

      {/* Executive Delivery Plan Governance & Mix Row */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="ae-bento-card flex flex-col justify-between space-y-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-6 xl:col-span-8 dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T(
                    'Delivery Routing & Aggregator Cap Plan',
                    'اعتماد خطة التوصيل وسقف عمولات وعروض التطبيقات',
                  )}
                </h2>
                {lockedDeliveryCap || deliveryApproval?.status === 'approved' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[13px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>
                      {T(
                        'Sealed by Manager PIN',
                        'معتمد بختم الإدارة التنفيذية',
                      )}
                    </span>
                  </span>
                ) : deliveryApproval?.status === 'pending' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-0.5 text-[13px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                    <Bell className="h-3.5 w-3.5" />
                    <span>{T('Awaiting Manager PIN', 'بانتظار ختم المدير')}</span>
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-neutral-400 dark:text-slate-400">
                {T(
                  'Lock TMP (15%) near-zone routing & aggregator promo caps into the live Odoo 17 Compliance Watchdog.',
                  'ثبّت حصة توصيل سائقي الشركة (15%) وسقف خصومات وعمولات المنصات لربطها آلياً بجرس الرقابة في أودو 17.',
                )}
              </p>
            </div>

            <div className="ae-bento-subcard rounded-2xl px-3.5 py-2 text-end">
              <div className="text-xs font-semibold text-neutral-400 dark:text-slate-400">
                {T('Projected Savings', 'الوفر الشهري المتوقع')}
              </div>
              <div dir="ltr" className="text-[18px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                +{f0(deliveryMixStats.estimatedMonthlySavingKwd)} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
              </div>
            </div>
          </div>

          {/* 3 Crisp Cap Inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="ae-bento-subcard space-y-1 rounded-2xl p-3">
              <span className="block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Target TMP (15%) Share %', 'حصة سائقي الشركة (15%) المستهدفة %')}
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min={10}
                  max={95}
                  step={5}
                  disabled={auditorReadOnly}
                  value={targetTmpSharePct}
                  onChange={(e) => setTargetTmpSharePct(Math.min(95, Math.max(10, Number(e.target.value) || 0)))}
                  className="w-24 rounded-xl bg-white px-2.5 py-1.5 text-[14px] font-extrabold tabular-nums text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 disabled:opacity-60 dark:bg-white/10 dark:text-white"
                />
                <span className="text-xs font-medium tabular-nums text-neutral-400">
                  {T(`Now ${f1(deliveryMixStats.currentTmpSharePct)}%`, `حالياً ${f1(deliveryMixStats.currentTmpSharePct)}%`)}
                </span>
              </div>
            </label>

            <label className="ae-bento-subcard space-y-1 rounded-2xl p-3">
              <span className="block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Max Blended Fee Cap %', 'سقف العمولة المرجحة %')}
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min={10}
                  max={30}
                  step={0.5}
                  disabled={auditorReadOnly}
                  value={commissionCapPct}
                  onChange={(e) => setCommissionCapPct(Math.min(30, Math.max(10, Number(e.target.value) || 0)))}
                  className="w-24 rounded-xl bg-white px-2.5 py-1.5 text-[14px] font-extrabold tabular-nums text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 disabled:opacity-60 dark:bg-white/10 dark:text-white"
                />
                <span className="text-xs font-medium tabular-nums text-neutral-400">
                  {T(`Now ${f1(deliveryMixStats.effectiveCommissionPct)}%`, `حالياً ${f1(deliveryMixStats.effectiveCommissionPct)}%`)}
                </span>
              </div>
            </label>

            <label className="ae-bento-subcard space-y-1 rounded-2xl p-3">
              <span className="block text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {T('Aggregator Promo Cap %', 'سقف عروض التطبيقات %')}
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  disabled={auditorReadOnly}
                  value={promoDiscountCapPct}
                  onChange={(e) => setPromoDiscountCapPct(Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-24 rounded-xl bg-white px-2.5 py-1.5 text-[14px] font-extrabold tabular-nums text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 disabled:opacity-60 dark:bg-white/10 dark:text-white"
                />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {T('Odoo Guarded', 'مراقب بأودو')}
                </span>
              </div>
            </label>
          </div>

          {/* Action Bar: hidden for read-only auditor */}
          {!auditorReadOnly ? (
            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={handleRequestDeliveryApproval}
                  className="btn-colored inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>
                    {T(
                      'Request Manager Approval on Delivery Plan 🔔',
                      'طلب موافقة المدير على خطة التوصيل 🔔',
                    )}
                  </span>
                </button>

                {deliveryApproval?.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() =>
                      gov.approveItemWithPin(
                        deliveryApproval.id,
                        deliveryApproval.titleAr,
                        deliveryApproval.titleEn,
                      )
                    }
                    className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[12px] font-bold text-emerald-900 transition duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>{T('Approve with PIN ✅', 'موافقة واعتماد برمز المدير ✅')}</span>
                  </button>
                ) : null}

                {lockedDeliveryCap || deliveryApproval?.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={handlePrintDeliveryCircular}
                    className="ae-bento-subcard inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-[12px] font-bold text-slate-800 transition duration-150 hover:bg-emerald-50 hover:text-emerald-900 dark:text-slate-100 dark:hover:bg-emerald-950/50"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {T('Print Official Circular 📄', 'طباعة / تصدير تعميم رسمي 📄')}
                    </span>
                  </button>
                ) : null}
              </div>

              {approvalSubmittedFlash ? (
                <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {T('Sent to Manager Bell across devices ✓', 'تم الرفع لجرس المدير ومزامنة الأجهزة ✓')}
                </span>
              ) : lockedDeliveryCap ? (
                <span className="text-[13px] font-medium tabular-nums text-neutral-400">
                  {isAr
                    ? `السقف المعتمد: سائقي الشركة ${lockedDeliveryCap.targetTmpSharePct}% · عروض ${f1(lockedDeliveryCap.promoDiscountCapPct)}%`
                    : `Locked Cap: TMP ${lockedDeliveryCap.targetTmpSharePct}% · Promo ${f1(lockedDeliveryCap.promoDiscountCapPct)}%`}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {T(
                'Read-only auditor view — cap modification and executive approval actions are disabled.',
                'وضع المراجع للقراءة فقط — تعديل السقوف وطلبات الاعتماد التنفيذي معطّلة.',
              )}
            </p>
          )}

          {activeDeliveryBreachCount > 0 ? (
            <button
              type="button"
              onClick={() => gov.openDrawer('breaches')}
              className="ae-bento-subcard flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-start text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-emerald-50/70 dark:text-slate-100 dark:hover:bg-emerald-950/40"
            >
              <span>
                {T(
                  'Odoo 17 Watchdog Active • Open Approval Bell to Review Breaches 🔔',
                  'مراقب أودو 17 نشط • افتح جرس الاعتمادات لمراجعة المخالفات 🔔',
                )}
              </span>
              <span className="rounded-lg bg-amber-50 px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200">
                {isAr ? `${activeDeliveryBreachCount} تنبيه` : `${activeDeliveryBreachCount} active`}
              </span>
            </button>
          ) : null}
        </div>

        {/* 4-Col In-House vs Fleet & Apps Donut */}
        <div className="ae-bento-card flex flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-6 xl:col-span-4 dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="mb-3 space-y-0.5">
            <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {T('TMP (15%) vs Tgo (27%) Mix', 'توزيع سائقي الشركة (15%) مقابل أسطول المنصة (27%)')}
            </h2>
            <p className="text-xs text-neutral-400 dark:text-slate-400">
              {isAr
                ? `حصة قنوات التوصيل من مدفوعات أودو (${periodFromToAr})`
                : `Verified Odoo POS channel mix (${periodFromToEn})`}
            </p>
          </div>
          <InteractiveDonutChart
            slices={deliveryDonutSlices}
            centerValue={`${f1(deliveryMixStats.currentTmpSharePct)}%`}
            centerLabel={T('TMP 15% Share', 'حصة سائقي الشركة 15%')}
            summaryRows={[
              {
                label: T('TMP 15% Sales', 'مبيعات سائقي الشركة 15%'),
                value: `${fmtAmount(deliveryMixStats.tmpSalesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
                tone: 'emerald',
              },
              {
                label: T('Tgo 27% Sales', 'مبيعات أسطول المنصة 27%'),
                value: `${fmtAmount(deliveryMixStats.tgoSalesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
                tone: 'amber',
              },
            ]}
            isAr={isAr}
          />
        </div>
      </section>

      {/* Single Unified Forensic Delivery Radar Table */}
      <section className="ae-bento-card space-y-4 rounded-2xl bg-white px-3.5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] sm:p-6 dark:bg-[#101C17] dark:ring-emerald-500/10">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 max-w-full">
            <EmeraldPillTabs<QuickFilter>
              value={quickFilter}
              onChange={setQuickFilter}
              size="sm"
              ariaLabel={T('Delivery Quick Filter', 'فلتر سريع للتوصيل')}
              options={[
                { id: 'all', label: isAr ? 'الكل' : 'All', badge: summary.totalAccounts },
                { id: 'stopped', label: isAr ? 'متوقف فعلياً 🔴' : 'Stopped 🔴', badge: summary.stoppedCount },
                { id: 'stalled', label: isAr ? 'ضعيف 🟠' : 'Low 🟠', badge: summary.stalledCount },
                { id: 'active', label: isAr ? 'شغال 🟢' : 'Active 🟢', badge: summary.activeCount },
                { id: 'tgo-only', label: isAr ? 'أسطول المنصة فقط ⚪' : 'Tgo Only ⚪', badge: summary.tgoOnlyCount },
                { id: 'tmp-opp', label: isAr ? 'فرصة سائق شركة 💡' : 'TMP Hire 💡', badge: summary.tmpOppCount },
                { id: 'tgo', label: isAr ? 'طلبات (أسطول المنصة)' : 'Talabat Tgo', badge: summary.tgoCount },
                { id: 'tmp', label: isAr ? 'طلبات (سائقي الشركة)' : 'Talabat TMP', badge: summary.tmpCount },
                { id: 'keeta', label: isAr ? 'كيتا' : 'Keeta', badge: summary.keetaCount },
                { id: 'gap', label: isAr ? 'فروقات عمولة' : 'Fee Gaps', badge: summary.gapCount },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={T('Search branch, brand, app…', 'ابحث بالفرع أو المطعم أو التطبيق…')}
                className="ae-bento-subcard h-9 w-full rounded-xl ps-8 pe-3 text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-white"
              />
            </div>

            <EmeraldPillTabs<SortMode>
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
                className="btn-colored inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[12.5px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
              >
                <RotateCcw className="h-3 w-3" />
                {T('All', 'الكل')}
              </button>
            ) : null}
          </div>
        </div>

        {/* Forensic Table: الفرع | المطعم | التطبيق | الحالة | الطلبات | المبيعات | العمولة | الصافي التعاقدي | الفرق والتوثيق */}
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <div className="max-h-[680px] overflow-y-auto rounded-2xl ring-1 ring-slate-950/[0.04] dark:ring-emerald-500/10">
            <table className="w-full min-w-[1040px] border-collapse bg-white text-[14px] dark:bg-[#101C17]">
              <thead className="sticky top-0 z-10 bg-[#F4F6F9] text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:bg-[#09110E] dark:text-slate-300 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                <tr>
                  <th className="px-4 py-3 text-start text-[13px] font-bold whitespace-nowrap">
                    {T('Branch', 'الفرع')}
                  </th>
                  <th className="px-4 py-3 text-start text-[13px] font-bold whitespace-nowrap">
                    {T('Brand', 'المطعم')}
                  </th>
                  <th className="px-4 py-3 text-start text-[13px] font-bold whitespace-nowrap">
                    {T('App', 'التطبيق')}
                  </th>
                  <th className="px-4 py-3 text-start text-[13px] font-bold whitespace-nowrap">
                    {T('Status', 'الحالة')}
                  </th>
                  <th className="px-4 py-3 text-end text-[13px] font-bold whitespace-nowrap">
                    {T('Orders', 'الطلبات')}
                  </th>
                  <th className="px-4 py-3 text-end text-[13px] font-bold whitespace-nowrap">
                    {T('Sales', 'المبيعات')}
                  </th>
                  <th className="px-4 py-3 text-center text-[13px] font-bold whitespace-nowrap">
                    {T('Commission', 'العمولة')}
                  </th>
                  <th className="px-4 py-3 text-end text-[13px] font-bold whitespace-nowrap">
                    {T('Contractual Net', 'الصافي التعاقدي')}
                  </th>
                  <th className="px-4 py-3 text-end text-[13px] font-bold whitespace-nowrap">
                    {T('Gap & Proof', 'الفرق والتوثيق')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[14px] font-semibold text-neutral-500 dark:text-slate-400">
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
                            <ModePill mode={r.mode} dual={r.hasDualMode} isAr={isAr} />
                          </div>
                        </td>

                        {/* 4. الحالة + فرصة تعيين سائق شركة 💡 */}
                        <td className="px-4 py-3 min-w-[260px]">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge status={r.status} isAr={isAr} />
                              {r.tmpHireOpportunity ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/90 px-2.5 py-0.5 text-xs font-extrabold text-amber-950 ring-1 ring-amber-500/30 whitespace-nowrap dark:bg-amber-500/20 dark:text-amber-200">
                                  <span>
                                    {isAr
                                      ? `فرصة تعيين سائق شركة 💡 (+${f0(r.tmpNetMonthlySavingKwd)} د.ك/ش)`
                                      : `Hire TMP Driver 💡 (+${f0(r.tmpNetMonthlySavingKwd)} KWD/mo)`}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[13px] font-medium text-neutral-500 dark:text-slate-400">
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
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[13px] font-bold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-slate-300">
                              {f1(r.contractPct)}%
                            </span>
                          ) : hasCommissionGap || r.divertedToTgo ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-rose-800 ring-1 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-200">
                              {f1(r.contractPct)}% → {f1(r.actualPct)}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[13px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {f1(r.actualPct)}%
                            </span>
                          )}
                        </td>

                        {/* 8. الصافي التعاقدي */}
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
                              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-sky-50 px-2.5 text-xs font-extrabold text-sky-900 ring-1 ring-sky-500/20 transition duration-150 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-400/25"
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
                                  : 'bg-[#F4F6F9] text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-[#10B981] dark:hover:text-[#04130D]'
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
        </div>
      </section>

      {/* Modal 1: `فروع سائقي الشركة ⚙️` Toggle Modal */}
      {mounted && tmpModalOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={T('Company Driver Branches (TMP)', 'فروع سائقي الشركة')}
              dir={isAr ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[120] flex items-center justify-center bg-[#09110E]/55 p-4 backdrop-blur-xs"
              onClick={() => setTmpModalOpen(false)}
            >
              <div
                className="ae-bento-card max-h-[88vh] w-full max-w-xl overflow-y-auto p-5 shadow-2xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
                  <div className="space-y-1">
                    <h2 className="text-[18px] font-extrabold text-slate-950 dark:text-white">
                      {T('Company Driver Branches (TMP 15%) ⚙️', 'فروع سائقي الشركة (15%) ⚙️')}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {T(
                        'Designate branches running in-house TMP drivers. Non-TMP branches are cleanly classified as Tgo Only ⚪.',
                        'حدد الفروع التي يعمل بها سائقو الشركة بنسبة عمولة 15%. الفروع غير المحددة تُصنف تلقائياً «أسطول المنصة فقط ⚪».',
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
                  {(Object.entries(ACTIVE_BRANCH_META) as [Exclude<GlobalBranch, 'all'>, { order: number; en: string; ar: string }][])
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
                              disabled={auditorReadOnly}
                              onChange={() => toggleTmpBranch(lid)}
                              className="h-4 w-4 accent-emerald-600"
                            />
                            <div>
                              <div className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                                {isAr ? meta.ar : meta.en}
                              </div>
                              <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                                {isAr
                                  ? `طلبات سائقي الشركة آخر 30 يوم: ${f0(econ?.tmpOrders30 ?? 0)} • مبيعات أسطول المنصة: ${f0(econ?.tgoSales30Kwd ?? 0)} د.ك`
                                  : `30d TMP orders: ${f0(econ?.tmpOrders30 ?? 0)} • Tgo sales: ${f0(econ?.tgoSales30Kwd ?? 0)} KWD`}
                              </div>
                            </div>
                          </div>

                          {checked ? (
                            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                              {isAr ? 'سائق شركة نشط' : 'Active TMP'}
                            </span>
                          ) : econ?.recommendHireDriver ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-950 dark:bg-amber-500/20 dark:text-amber-200">
                              {isAr
                                ? `فرصة سائق 💡 (+${f0(econ.netAfterDriverKwd)} د.ك)`
                                : `Hire Driver 💡 (+${f0(econ.netAfterDriverKwd)} KWD)`}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                              {isAr ? 'أسطول المنصة فقط ⚪' : 'Tgo Only ⚪'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
                  <button
                    type="button"
                    onClick={resetTmpBranchesToAuto}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-[12px] font-bold text-slate-700 dark:text-slate-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{T('Auto-Detect from Odoo', 'اكتشاف تلقائي من أودو')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTmpModalOpen(false)}
                    className="btn-colored inline-flex h-9 cursor-pointer items-center rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                  >
                    {T('Save & Close', 'حفظ وإغلاق')}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Modal 2: `توثيق السطر من أودو 🔍` Proof Drawer */}
      {mounted && proofRow
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={T('Odoo Row Proof', 'توثيق السطر من أودو')}
              dir={isAr ? 'rtl' : 'ltr'}
              className="fixed inset-0 z-[125] flex justify-end bg-[#09110E]/50 backdrop-blur-xs"
              onClick={() => setProofRowId(null)}
            >
              <div
                className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-6 dark:bg-[#101C17] dark:ring-1 dark:ring-emerald-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={proofRow.status} isAr={isAr} />
                      <ModePill mode={proofRow.mode} dual={proofRow.hasDualMode} isAr={isAr} />
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

                {/* 1. Odoo POS Registers */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '1. نقاط الكاشير المعتمدة في أودو' : '1. Whitelisted POS Registers (pos.config)'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proofPosConfigs.map((cfg) => (
                      <span
                        key={cfg.id}
                        dir={isAr ? 'rtl' : 'ltr'}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-[13px] font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200"
                      >
                        {isAr ? `#${cfg.id} ${localizePosConfigAr(cfg.id, cfg.name)}` : `#${cfg.id} ${cfg.name}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. Odoo Payment Methods */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '2. طرق الدفع والربط في أودو' : '2. Payment Methods (pos.payment.method)'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proofPaymentMethods.map((pm) => (
                      <span
                        key={pm.id}
                        dir={isAr ? 'rtl' : 'ltr'}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-200"
                      >
                        {isAr ? `#${pm.id} ${localizePaymentMethodAr(pm.id, pm.name)}` : `#${pm.id} ${pm.name}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. Last 5 Verified Odoo Receipts */}
                <div className="mt-4 space-y-2">
                  <div className="text-[12px] font-extrabold text-slate-900 dark:text-white">
                    {isAr ? '3. آخر 5 إيصالات فعلية في أودو' : '3. Last 5 Real Odoo Receipts (pos.order)'}
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
                            <div dir={isAr ? 'rtl' : 'ltr'} className="font-extrabold text-slate-900 dark:text-white">
                              {isAr ? localizeOrderRefAr(rc.orderName) : `#${rc.orderName}`}
                            </div>
                            <div dir={isAr ? 'rtl' : 'ltr'} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {isAr
                                ? `${rc.dateKuwait} • ${localizePosRefAr(rc.posRef, rc.posConfigId, rc.posConfigName)}`
                                : `${rc.dateKuwait} • ${rc.posRef || rc.posConfigName}`}
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
                    className="btn-colored inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
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
