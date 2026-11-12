'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  JOURNEY_STAGES,
  type JourneyStage,
} from '@/lib/full-journey-enterprise-brain'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  InteractiveDonutChart,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'

interface EmeraldPillOption<K extends string> {
  id: K
  label: string
  icon?: ReactNode
  badge?: string | number
}

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: readonly EmeraldPillOption<K>[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
  surface?: 'muted' | 'white'
  size?: 'sm' | 'md'
}) {
  const btnPadding =
    size === 'sm'
      ? 'h-8 px-3 text-[12.5px]'
      : 'h-9 px-3.5 py-1.5 text-[13px] sm:text-[13.5px]'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#F1F5F9] p-1 ring-1 ring-slate-900/[0.06] select-none dark:bg-[#0C141B] dark:ring-white/[0.08]"
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
            className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-all duration-150 focus:outline-none ${btnPadding} ${
              active
                ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums ${
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
import {
  getBranchLabel,
  getBrandLabel,
  type SimplePlayView,
  type SummaryCardData,
} from '@/lib/aether/global-filter-engine'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { useLang } from '@/components/aether/ui'

type Tab = 'numbers' | 'tips'
type FlowGroup = 'timeline' | 'branches'

const PLAYS_PER_PAGE = 6

const STAGE_SHORT_LABELS: Record<JourneyStage | 'all', { ar: string; en: string }> = {
  all: { ar: 'الكل', en: 'All' },
  procurement: { ar: 'المشتريات', en: 'Buying' },
  kitchen: { ar: 'المطبخ', en: 'Kitchen' },
  menu: { ar: 'المينيو', en: 'Menu' },
  operations: { ar: 'الفروع', en: 'Branches' },
  opex: { ar: 'المصاريف', en: 'Bills' },
  delivery: { ar: 'التوصيل', en: 'Delivery' },
  quality: { ar: 'العملاء', en: 'Guests' },
}

const ACCENT_RING: Record<SummaryCardData['accent'], string> = {
  emerald: 'text-emerald-700 dark:text-emerald-400',
  sky: 'text-sky-700 dark:text-sky-400',
  amber: 'text-amber-700 dark:text-amber-400',
  rose: 'text-rose-700 dark:text-rose-400',
}

/**
 * Curated executive topic titles per play ID so every recommendation has an accurate,
 * non-duplicated, high-signal title rather than generic fallback labels.
 * Overlapping sub-plays on the exact same operational topic share `topicKey` so strict
 * deduplication keeps only the highest-impact recommendation per topic.
 */
const PLAY_EXECUTIVE_TOPICS: Record<
  string,
  { topicKey: string; titleAr: string; titleEn: string }
> = {
  'quality-retention': {
    topicKey: 'direct-vip-retention',
    titleAr: 'تحويل الضيوف لطلب مباشر دائم',
    titleEn: 'Convert Guests to Direct Regulars',
  },
  'kitchen-inventory-variance': {
    topicKey: 'kitchen-inventory-variance',
    titleAr: 'ضبط فوارق جرد المطبخ الخام',
    titleEn: 'Control Abnormal Kitchen Variance',
  },
  'delivery-corporate-diwaniya-direct': {
    topicKey: 'direct-corporate-diwaniya-boxes',
    titleAr: 'بوكسات الشركات والديوانيات المباشرة',
    titleEn: 'Direct Office & Diwaniya Boxes',
  },
  'kitchen-ardiya-prep-par-shield': {
    topicKey: 'ardiya-flexible-prep-par',
    titleAr: 'جدول تحضير مرن بمطبخ العارضية',
    titleEn: 'Flexible Ardiya Prep Schedule',
  },
  'menu-reprice-china-garden': {
    topicKey: 'menu-surgical-reprice-cg',
    titleAr: 'تعديل تسعير أصناف تشاينا جاردن',
    titleEn: 'Surgical Repricing at China Garden',
  },
  'delivery-promo-burn': {
    topicKey: 'aggregator-promo-burn-cap',
    titleAr: 'سقف الخصومات المشتركة بالتطبيقات',
    titleEn: 'Cap Co-Funded App Discounts',
  },
  'opex-host-kitchen-avenues': {
    topicKey: 'host-kitchen-brand-sharing',
    titleAr: 'تشغيل فارم براون بمطبخ الأفنيوز',
    titleEn: 'Host Farm Brown in Avenues Kitchen',
  },
  'kitchen-scrap-hotspot': {
    topicKey: 'kitchen-overprep-waste',
    titleAr: 'تقليل هدر التحضير المسبق بالمطبخ',
    titleEn: 'Cut Over-Prep Kitchen Spoilage',
  },
  'delivery-commission-keeta': {
    topicKey: 'keeta-contract-rate-audit',
    titleAr: 'مطابقة عمولة كيتا مع العقد',
    titleEn: 'Audit Keeta Contract Fee Rate',
  },
  'ops-cashier-upsell-incentive': {
    topicKey: 'cashier-upsell-script',
    titleAr: 'تحفيز البيع الإضافي عند الكاشير',
    titleEn: 'Cashier Combo Upsell Prompt',
  },
  'menu-basket-china-garden': {
    topicKey: 'single-item-combo-upgrade',
    titleAr: 'ترقية طلبات الصنف الواحد لكومبو',
    titleEn: 'Upgrade Single-Item Orders to Combos',
  },
  'delivery-unsettled-clearing': {
    topicKey: 'weekly-aggregator-payout-clearing',
    titleAr: 'مطابقة مستحقات التطبيقات أسبوعياً',
    titleEn: 'Reconcile Weekly App Payouts',
  },
  'menu-channel-price-shield': {
    topicKey: 'delivery-menu-price-shield',
    titleAr: 'تسعيرة مستقلة لتطبيقات التوصيل',
    titleEn: 'Dedicated Delivery App Menu Pricing',
  },
  'delivery-tgo-tmp-mix': {
    topicKey: 'shift-tgo-to-tmp-drivers',
    titleAr: 'تحويل الطلبات القريبة لسائقي TMP',
    titleEn: 'Shift Nearby Orders to TMP Drivers',
  },
  'menu-shop-basket-china-garden': {
    topicKey: 'single-item-combo-upgrade',
    titleAr: 'ترقية طلبات الصنف الواحد لكومبو',
    titleEn: 'Upgrade Single-Item Orders to Combos',
  },
  'menu-kuwait-calendar-tactical': {
    topicKey: 'kuwait-payday-weekend-bundles',
    titleAr: 'باقات الرواتب وزوارة الويكند',
    titleEn: 'Payday & Weekend Family Bundles',
  },
  'ops-discount-discipline': {
    topicKey: 'manual-pos-discount-cap',
    titleAr: 'قصر الخصومات اليدوية برمز المدير',
    titleEn: 'Gate Manual POS Discounts by PIN',
  },
  'opex-custody-offpo-anomalies': {
    topicKey: 'petty-cash-po-governance',
    titleAr: 'إقفال العهد ومنع الشراء بلا أمر',
    titleEn: 'Close Petty Cash & Enforce POs',
  },
  'proc-price-creep': {
    topicKey: 'supplier-contract-price-lock',
    titleAr: 'تثبيت أسعار عقود مواد المطبخ',
    titleEn: 'Lock Core Ingredient Contract Rates',
  },
  'proc-vendor-consolidation': {
    topicKey: 'vendor-rate-consolidation',
    titleAr: 'توحيد شراء الأصناف بأقل مورد',
    titleEn: 'Consolidate Multi-Supplier Rates',
  },
  'quality-cancellations': {
    topicKey: 'evening-peak-cancellations',
    titleAr: 'تقليل إلغاءات ذروة المساء',
    titleEn: 'Cut Evening Rush Cancellations',
  },
  'kitchen-portion-drift': {
    topicKey: 'cooking-line-portion-weights',
    titleAr: 'ضبط أوزان الحصص على خط الطبخ',
    titleEn: 'Standardize Cooking-Line Portions',
  },
  'menu-reprice-franks': {
    topicKey: 'menu-surgical-reprice-franks',
    titleAr: 'تعديل تسعير أصناف فرانكس المختارة',
    titleEn: "Surgical Repricing at Frank's",
  },
  'ops-session-discipline': {
    topicKey: 'pos-opening-closing-discipline',
    titleAr: 'الالتزام بمواعيد فتح الكاشير',
    titleEn: 'Enforce On-Time Register Hours',
  },
  'opex-repair-loop-capex': {
    topicKey: 'repeat-equipment-repair-cap',
    titleAr: 'استبدال المعدات متكررة الأعطال',
    titleEn: 'Replace Repeat-Failure Equipment',
  },
  'opex-cross-branch-anomalies': {
    topicKey: 'branch-supplies-spend-cap',
    titleAr: 'ترشيد استهلاك مستلزمات الفروع',
    titleEn: 'Cap Branch Supplies Over-Spend',
  },
  'proc-packaging-per-order': {
    topicKey: 'packaging-per-order-control',
    titleAr: 'ربط صرف التغليف بعدد الطلبات',
    titleEn: 'Tie Packaging Issue to Order Count',
  },
  'opex-unallocated-analytic-governance': {
    topicKey: 'petty-cash-po-governance',
    titleAr: 'إقفال العهد ومنع الشراء بلا أمر',
    titleEn: 'Close Petty Cash & Enforce POs',
  },
  'ops-shift-realign-360-mall': {
    topicKey: 'branch-peak-shift-realignment',
    titleAr: 'إعادة توزيع شفتات ذروة المساء',
    titleEn: 'Realign Shifts to Evening Rush',
  },
  'menu-kitchen-drag-farm-brown': {
    topicKey: 'prune-slow-complex-skus',
    titleAr: 'حذف الأصناف البطيئة كثيرة الهدر',
    titleEn: 'Prune Slow High-Waste Menu Items',
  },
}

/** Normalizes whitespace, punctuation, and Arabic diacritics/tatweel for strict topic deduplication. */
function normalizeTopicString(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()
}

interface ExecutivePlayCardItem {
  sp: SimplePlayView
  titleAr: string
  titleEn: string
  scopePillAr: string
  scopePillEn: string
  diagnosisAr: string
  diagnosisEn: string
  monthlyNetKwd: number
}

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
const f2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function buildScopePill(sp: SimplePlayView, isAr: boolean): string {
  const brandPart =
    sp.brands === 'all'
      ? isAr
        ? 'كل المطاعم'
        : 'All Brands'
      : sp.brands.length <= 2
        ? sp.brands.map((b) => getBrandLabel(b, isAr)).join(isAr ? '، ' : ', ')
        : isAr
          ? `${getBrandLabel(sp.brands[0], true)} +${sp.brands.length - 1}`
          : `${getBrandLabel(sp.brands[0], false)} +${sp.brands.length - 1}`

  const branchPart =
    sp.branches === 'all' || sp.branches.length >= 6
      ? isAr
        ? 'كل الفروع'
        : 'All Branches'
      : sp.branches.length <= 2
        ? sp.branches.map((b) => getBranchLabel(b, isAr)).join(isAr ? '، ' : ', ')
        : isAr
          ? `${getBranchLabel(sp.branches[0], true)} +${sp.branches.length - 1}`
          : `${getBranchLabel(sp.branches[0], false)} +${sp.branches.length - 1}`

  return `${brandPart} • ${branchPart}`
}

/** ملخص الشركة — Fluid Full-Width Executive Bento Workspace */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const { workspace, filters, liveSummary, setLens } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [tab, setTab] = useState<Tab>('numbers')
  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [stage, setStage] = useState<JourneyStage | 'all'>('all')
  const [playsPage, setPlaysPage] = useState<number>(1)
  const [highlightedPlayId, setHighlightedPlayId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Sync /erp active sub-tab with TopFilterBar so Quick-Lens Pills & Margin Strip hide on Profit Plays
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    const isPlaysTab = tab === 'tips'
    const subtabValue = isPlaysTab ? 'plays' : 'summary'
    document.documentElement.dataset.erpSubtab = subtabValue
    window.dispatchEvent(new CustomEvent('aether:erp-subtab', { detail: subtabValue }))
  }, [tab])

  useEffect(() => {
    return () => {
      if (typeof document === 'undefined' || typeof window === 'undefined') return
      document.documentElement.dataset.erpSubtab = 'summary'
      window.dispatchEvent(new CustomEvent('aether:erp-subtab', { detail: 'summary' }))
    }
  }, [])

  const handleSummaryCardAction = useCallback(
    (card: SummaryCardData) => {
      switch (card.action) {
        case 'stage-procurement':
          setStage('procurement')
          setPlaysPage(1)
          setTab('tips')
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
          break
        case 'stage-opex':
          setStage('opex')
          setPlaysPage(1)
          setTab('tips')
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
          break
        case 'chart-branches':
          setFlowGroup('branches')
          if (typeof document !== 'undefined') {
            document
              .getElementById('cash-flow-chart-card')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          break
        case 'lens-quiet':
          setLens('quiet-hours')
          setStage('all')
          setPlaysPage(1)
          setTab('tips')
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
          break
        default:
          setStage(card.targetStage ?? 'all')
          setPlaysPage(1)
          setTab('tips')
      }
    },
    [setLens],
  )

  const refreshLive = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/odoo-sync?period=${encodeURIComponent(filters.period)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (res.ok) {
        const d = await res.json()
        window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
      }
    } catch {
      // silent fallback
    } finally {
      setSyncing(false)
    }
  }, [filters.period])

  // Strict normalized title/topic deduplication across all plays (sorted by highest monthly KWD impact)
  const deduplicatedPlays = useMemo<ExecutivePlayCardItem[]>(() => {
    const sorted = [...workspace.plays].sort(
      (a, b) => b.tiersMonthly.realisticKwd - a.tiersMonthly.realisticKwd,
    )
    const seenTopics = new Set<string>()
    const seenAr = new Set<string>()
    const seenEn = new Set<string>()
    const result: ExecutivePlayCardItem[] = []

    for (const sp of sorted) {
      const curated = PLAY_EXECUTIVE_TOPICS[sp.id]
      const rawTitleAr = curated?.titleAr ?? sp.play.titleAr ?? sp.titleAr
      const rawTitleEn = curated?.titleEn ?? sp.play.titleEn ?? sp.titleEn
      const normTopic = normalizeTopicString(curated?.topicKey ?? rawTitleAr)
      const normAr = normalizeTopicString(rawTitleAr)
      const normEn = normalizeTopicString(rawTitleEn)

      if (!normAr || !normEn) continue
      if (seenTopics.has(normTopic) || seenAr.has(normAr) || seenEn.has(normEn)) {
        continue
      }
      seenTopics.add(normTopic)
      seenAr.add(normAr)
      seenEn.add(normEn)

      const diagnosisAr = `${sp.play.leakAr || sp.problemAr} — ${sp.play.actionAr || sp.solutionAr}`
      const diagnosisEn = `${sp.play.leakEn || sp.problemEn} — ${sp.play.actionEn || sp.solutionEn}`

      result.push({
        sp,
        titleAr: rawTitleAr,
        titleEn: rawTitleEn,
        scopePillAr: buildScopePill(sp, true),
        scopePillEn: buildScopePill(sp, false),
        diagnosisAr,
        diagnosisEn,
        monthlyNetKwd: Math.max(10, Math.round(sp.tiersMonthly.realisticKwd)),
      })
    }

    return result
  }, [workspace.plays])

  const filteredPlays = useMemo(
    () =>
      stage === 'all'
        ? deduplicatedPlays
        : deduplicatedPlays.filter((item) => item.sp.stage === stage),
    [deduplicatedPlays, stage],
  )

  // Reset pagination to page 1 when category filter or global slice changes
  useEffect(() => {
    setPlaysPage(1)
  }, [stage, filters.period, filters.brand, filters.branch, filters.channel, filters.kuwaitSlice, filters.lens])

  // Support deep links (?stage= & ?play=) from Command Palette
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const qStage = sp.get('stage') as JourneyStage | null
    const qPlay = sp.get('play')
    if (qStage && JOURNEY_STAGES.some((s) => s.id === qStage)) {
      setStage(qStage)
      setPlaysPage(1)
      setTab('tips')
    }
    if (qPlay) {
      setStage('all')
      setTab('tips')
      setHighlightedPlayId(qPlay)
      const idx = deduplicatedPlays.findIndex((item) => item.sp.id === qPlay)
      if (idx >= 0) {
        setPlaysPage(Math.floor(idx / PLAYS_PER_PAGE) + 1)
      }
      window.setTimeout(() => {
        document.getElementById(`play-card-${qPlay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 180)
    }
  }, [deduplicatedPlays])

  const totalPlayPages = Math.max(1, Math.ceil(filteredPlays.length / PLAYS_PER_PAGE))
  const currentPlayPage = Math.min(playsPage, totalPlayPages)
  const paginatedPlays = useMemo(() => {
    const start = (currentPlayPage - 1) * PLAYS_PER_PAGE
    return filteredPlays.slice(start, start + PLAYS_PER_PAGE)
  }, [currentPlayPage, filteredPlays])

  const handleSubmitPlayForApproval = useCallback(
    (item: ExecutivePlayCardItem) => {
      const refKey = `journey-play:${item.sp.id}`
      const existing = getApprovalByRef(refKey)
      if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
        openDrawer('approvals')
        return
      }
      const stg = STAGE_SHORT_LABELS[item.sp.stage]
      requestApproval({
        refKey,
        domain: 'growth-play',
        titleAr: item.titleAr,
        titleEn: item.titleEn,
        summaryAr: `${item.scopePillAr} — ${item.diagnosisAr}`,
        summaryEn: `${item.scopePillEn} — ${item.diagnosisEn}`,
        departmentAr: stg.ar,
        departmentEn: stg.en,
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: item.monthlyNetKwd,
        href: `/erp?play=${encodeURIComponent(item.sp.id)}`,
      })
    },
    [getApprovalByRef, openDrawer, requestApproval],
  )

  // 10-KWD breakdown & derived executive KPIs
  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const beforeRentRatio = Math.max(0, (10 - food10 - delivery10) / 10)
  const netPocketRatio = Math.max(0, netPocket10 / 10)
  const beforeRentKwd = workspace.salesKwd * beforeRentRatio
  const netPocketKwd = workspace.salesKwd * netPocketRatio
  const netPocketPct = netPocket10 * 10

  const fmtKwdVal = useCallback(
    (v: number) => {
      const num = v >= 100 ? f0(v) : f1(v)
      return isAr ? `${num} د.ك` : `${num} KWD`
    },
    [isAr],
  )

  // Live daily & branch cash-flow capsule series from cores engine
  const coresSnap = useMemo(
    () => computeCoresHubSnapshot(filters, [], liveSummary),
    [filters, liveSummary],
  )

  const cashFlowBars = useMemo<MultiSeriesBarDatum[]>(() => {
    const src = flowGroup === 'branches' ? coresSnap.sales.branchRanking : coresSnap.sales.timeline
    return src.map((pt) => {
      const sales = Math.max(0, pt.salesKwd)
      const pocket = Math.max(0, sales * netPocketRatio)
      const beforeRent = Math.max(0, sales * beforeRentRatio)
      const foodAndDelivery = Math.max(0, sales - beforeRent)
      return {
        id: pt.id,
        label: isAr ? pt.labelAr : pt.labelEn,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        primaryValue: sales,
        secondaryValue: pocket,
        badgeText: `${f1(netPocketPct)}%`,
        badgeTone: netPocketPct >= 12 ? 'emerald' : 'amber',
        primaryColor: '#334155',
        secondaryColor: '#10B981',
        lines: [
          { label: isAr ? 'المبيعات:' : 'Sales:', value: fmtKwdVal(sales), bold: true },
          { label: isAr ? 'الأكل والتوصيل:' : 'Food & Delivery:', value: fmtKwdVal(foodAndDelivery), tone: 'amber' },
          { label: isAr ? 'الباقي قبل الإيجار:' : 'Before Rent:', value: fmtKwdVal(beforeRent), tone: 'slate' },
          { label: isAr ? 'الصافي بالجيب:' : 'Net in Pocket:', value: fmtKwdVal(pocket), tone: 'emerald', bold: true },
        ],
      }
    })
  }, [beforeRentRatio, coresSnap.sales.branchRanking, coresSnap.sales.timeline, flowGroup, fmtKwdVal, isAr, netPocketPct, netPocketRatio])

  const tenKwdDonutSlices = useMemo<DonutSliceDatum[]>(
    () => [
      {
        id: 'food',
        label: isAr ? 'تكلفة الأكل' : 'Food Cost',
        value: food10,
        valueFormatted: isAr ? `${f2(food10)} د.ك` : `${f2(food10)} KWD`,
        pctFormatted: `${f1(food10 * 10)}%`,
        color: '#F59E0B',
      },
      {
        id: 'delivery',
        label: isAr ? 'عمولة التوصيل' : 'Delivery Fee',
        value: delivery10,
        valueFormatted: isAr ? `${f2(delivery10)} د.ك` : `${f2(delivery10)} KWD`,
        pctFormatted: `${f1(delivery10 * 10)}%`,
        color: '#F43F5E',
      },
      {
        id: 'opex',
        label: isAr ? 'الإيجار والرواتب' : 'Rent & Payroll',
        value: opexRent10,
        valueFormatted: isAr ? `${f2(opexRent10)} د.ك` : `${f2(opexRent10)} KWD`,
        pctFormatted: `${f1(opexRent10 * 10)}%`,
        color: '#64748B',
      },
      {
        id: 'pocket',
        label: isAr ? 'الصافي بالجيب' : 'Net in Pocket',
        value: netPocket10,
        valueFormatted: isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`,
        pctFormatted: `${f1(netPocket10 * 10)}%`,
        color: '#10B981',
      },
    ],
    [delivery10, food10, isAr, netPocket10, opexRent10],
  )

  const stageOptions = useMemo(() => {
    const ids = ['all', 'procurement', 'kitchen', 'menu', 'operations', 'opex', 'delivery', 'quality'] as const
    return ids
      .map((sid) => {
        const count =
          sid === 'all'
            ? deduplicatedPlays.length
            : deduplicatedPlays.filter((p) => p.sp.stage === sid).length
        return { sid, count, lbl: STAGE_SHORT_LABELS[sid] }
      })
      .filter((x) => x.sid === 'all' || x.count > 0)
      .map((x) => ({
        id: x.sid,
        label: isAr ? x.lbl.ar : x.lbl.en,
        badge: x.count,
      }))
  }, [deduplicatedPlays, isAr])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-12">
      {/* Masthead: Clean Bento Header + 2 Focused Sub-Tabs + Link Pill to /erp/before-after */}
      <header className="ae-bento-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-[26px]">
            {T('Company Summary', 'ملخص الشركة')}
          </h1>
          <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <EmeraldPillTabs<Tab>
            ariaLabel={T('Sections', 'الأقسام')}
            value={tab}
            onChange={setTab}
            options={[
              { id: 'numbers', label: T('Key Numbers', 'الأرقام المهمة') },
              {
                id: 'tips',
                label: T('Approved Profit Plays', 'فرص الربح المعتمدة'),
                badge: deduplicatedPlays.length,
              },
            ]}
          />

          <Link
            href="/erp/before-after"
            className="ae-bento-subcard inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-slate-700 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300"
          >
            <span>{T('Decision Impact (Before & After) ↗', 'أثر القرارات (قبل وبعد) ↗')}</span>
          </Link>

          <button
            type="button"
            onClick={() => void refreshLive()}
            disabled={syncing}
            aria-label={T('Refresh', 'تحديث')}
            title={T('Refresh Odoo Data', 'تحديث أرقام أودو')}
            className="ae-bento-subcard inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-slate-700 transition-all duration-150 hover:text-slate-950 disabled:opacity-50 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* =====================================================================
          TAB 1: الأرقام المهمة (4 KPI Cards -> 8+4 Bento Split -> 6 Diagnostic Summary Cards)
      ===================================================================== */}
      {tab === 'numbers' && (
        <section className="space-y-5">
          {/* Top Row: 4 Crisp KPI Cards */}
          <div className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: المبيعات */}
            <article className="ae-kpi-card ae-glow-emerald p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="ae-icon-badge">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {f0(workspace.orders)} {T('orders', 'طلب')}
                </span>
              </div>
              <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
                {T('Sales', 'المبيعات')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-[32px]"
              >
                {fmtKwdVal(workspace.salesKwd)}
              </div>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {isAr ? `متوسط الفاتورة ${f2(workspace.aovKwd)} د.ك` : `Avg bill ${f2(workspace.aovKwd)} KWD`}
              </p>
            </article>

            {/* KPI 2: الباقي قبل الإيجار */}
            <article className="ae-kpi-card ae-glow-sky p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                >
                  {f1(beforeRentRatio * 100)}%
                </span>
              </div>
              <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
                {T('Left Before Rent', 'الباقي قبل الإيجار')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white sm:text-[32px]"
              >
                {fmtKwdVal(beforeRentKwd)}
              </div>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {isAr ? 'بعد خصم الأكل وعمولة التوصيل' : 'After food & delivery fees'}
              </p>
            </article>

            {/* KPI 3: الصافي بالجيب */}
            <article className="ae-kpi-card ae-glow-emerald p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="ae-icon-badge">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span
                  dir="ltr"
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums ${
                    netPocketPct >= 12
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}
                >
                  {f1(netPocketPct)}%
                </span>
              </div>
              <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
                {T('Net in Pocket', 'الصافي بالجيب')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-[32px]"
              >
                {fmtKwdVal(netPocketKwd)}
              </div>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {isAr ? 'الصافي الفعلي بعد الإيجار وكل المصاريف' : 'Actual net cash after rent & all bills'}
              </p>
            </article>

            {/* KPI 4: فرص زيادة الربح */}
            <article
              onClick={() => {
                setStage('all')
                setPlaysPage(1)
                setTab('tips')
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setStage('all')
                  setPlaysPage(1)
                  setTab('tips')
                }
              }}
              className="ae-kpi-card ae-glow-amber cursor-pointer p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {deduplicatedPlays.length} {T('plays', 'فرصة')}
                </span>
              </div>
              <p className="mt-3.5 text-[14px] font-bold text-slate-500 dark:text-slate-400">
                {T('Profit Opportunities', 'فرص زيادة الربح')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-[32px]"
              >
                +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
              </div>
              <p className="mt-1 inline-flex items-center gap-1 text-[13.5px] font-bold text-emerald-700 dark:text-emerald-300">
                <span>{T('View Steps ↗', 'عرض الخطوات ↗')}</span>
              </p>
            </article>
          </div>

          {/* Middle Bento Row: 8-Col Visual Cash-Flow Chart + 4-Col Interactive 10-KWD Donut */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* 8-Col Card: Interactive Cash-Flow & Net Performance Capsule Chart */}
            <div
              id="cash-flow-chart-card"
              className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-8"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                    {T('Sales & Net Cash Flow', 'المبيعات والصافي بالجيب')}
                  </h2>
                  <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
                    {T(
                      'Hover any capsule bar to inspect exact sales, costs, and net pocket cash',
                      'مرّر الماوس على أي عمود لمعرفة المبيعات والمصاريف والصافي بالجيب بدقة',
                    )}
                  </p>
                </div>

                <EmeraldPillTabs<FlowGroup>
                  size="sm"
                  value={flowGroup}
                  onChange={setFlowGroup}
                  options={[
                    { id: 'timeline', label: T('Timeline', 'حسب الفترة') },
                    { id: 'branches', label: T('Branches', 'حسب الفروع') },
                  ]}
                />
              </div>

              <InteractiveHoverBarChart
                data={cashFlowBars}
                isAr={isAr}
                primaryLegend={T('Sales', 'المبيعات')}
                secondaryLegend={T('Net in Pocket', 'الصافي بالجيب')}
                primaryColor="#334155"
                secondaryColor="#10B981"
                heightClass="h-64"
              />
            </div>

            {/* 4-Col Card: Interactive Donut Ring ("وين تروح كل ١٠ دنانير؟") */}
            <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-4">
              <div className="mb-3">
                <h2 className="text-[18px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {T('Where Every 10 KWD Goes?', 'وين تروح كل ١٠ دنانير؟')}
                </h2>
                <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
                  {T('Per 10 KWD of sales', 'توزيعة كل ١٠ دنانير مبيعات')}
                </p>
              </div>

              <InteractiveDonutChart
                slices={tenKwdDonutSlices}
                centerValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
                centerSubValue={T('per 10 KWD', 'من كل ١٠ د.ك')}
                centerLabel={T('Net Share', 'نصيب الصافي')}
                isAr={isAr}
                legendColumns={2}
              />
            </div>
          </div>

          {/* Non-Redundant 3 × 2 (6-Card) Operational & Financial Diagnostic Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {workspace.summaryCards.map((c) => (
              <article
                key={c.id}
                className="ae-kpi-card flex min-h-[196px] flex-col justify-between p-6"
              >
                <div className="space-y-2">
                  <h3 className="text-[15.5px] font-extrabold text-slate-800 dark:text-slate-100">
                    {isAr ? c.titleAr : c.titleEn}
                  </h3>
                  <div
                    className={`text-[28px] font-black tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}
                  >
                    {isAr ? c.valueAr : c.valueEn}
                  </div>
                  <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {isAr ? c.descAr : c.descEn}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-end">
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="ae-bento-subcard inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[13.5px] font-bold text-slate-800 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? c.ctaAr : c.ctaEn}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSummaryCardAction(c)}
                      className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-4 py-1.5 text-[13.5px] font-bold text-slate-800 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
                    >
                      <span>{isAr ? c.ctaAr : c.ctaEn}</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 2: فرص الربح المعتمدة / توصيات الربح (Deduplicated, 6-Card 3x2 Paginated Grid)
      ===================================================================== */}
      {tab === 'tips' && (
        <section className="space-y-5">
          {/* Category Filter Pills + Pagination Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <EmeraldPillTabs
              ariaLabel={T('Filter Profit Tips', 'تصنيف توصيات الربح')}
              surface="white"
              size="sm"
              value={stage}
              onChange={(nextStage) => {
                setStage(nextStage)
                setPlaysPage(1)
              }}
              options={stageOptions}
            />

            <div className="flex items-center gap-2 text-[13.5px] font-bold text-slate-600 dark:text-slate-300">
              <span className="tabular-nums">
                {isAr
                  ? `صفحة ${currentPlayPage} من ${totalPlayPages} (${filteredPlays.length} فرصة غير مكررة)`
                  : `Page ${currentPlayPage} of ${totalPlayPages} (${filteredPlays.length} unique plays)`}
              </span>
            </div>
          </div>

          {/* Strict 3x2 Wide Grid (6 cards per page) — Unslop Executive Craft */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedPlays.map((item) => {
              const { sp } = item
              const refKey = `journey-play:${sp.id}`
              const govApproval = getApprovalByRef(refKey)
              const isApproved = govApproval?.status === 'approved'
              const isSubmitted = govApproval?.status === 'pending'
              const isHighlighted = highlightedPlayId === sp.id

              return (
                <article
                  key={sp.id}
                  id={`play-card-${sp.id}`}
                  className={`ae-bento-card flex flex-col justify-between p-6 transition-all duration-150 ${
                    isHighlighted ? 'ring-2 ring-emerald-500' : ''
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Target Brand/Branch Soft Pill + Net Monthly KWD Impact */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100/90 px-3 py-1 text-[12.5px] font-bold text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10">
                        {isAr ? item.scopePillAr : item.scopePillEn}
                      </span>

                      <span
                        dir="ltr"
                        className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[14px] font-black tabular-nums text-emerald-700 ring-1 ring-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-300"
                      >
                        +{f0(item.monthlyNetKwd)} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
                      </span>
                    </div>

                    {/* Crisp Executive Title */}
                    <h3 className="text-[17px] font-extrabold leading-snug text-slate-950 dark:text-white">
                      {isAr ? item.titleAr : item.titleEn}
                    </h3>

                    {/* Concise 2-Line Diagnosis (Zero Wall-of-Text) */}
                    <p className="line-clamp-2 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {isAr ? item.diagnosisAr : item.diagnosisEn}
                    </p>
                  </div>

                  {/* Single Sleek Action Button Wired to Governance Bell */}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                    <span className="text-[12.5px] font-semibold text-slate-400 dark:text-slate-400">
                      {isAr
                        ? STAGE_SHORT_LABELS[sp.stage].ar
                        : STAGE_SHORT_LABELS[sp.stage].en}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSubmitPlayForApproval(item)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition-all duration-150 ${
                        isApproved || isSubmitted
                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30 hover:bg-emerald-100/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/30'
                          : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      }`}
                    >
                      <span>
                        {isApproved
                          ? T('Approved ✓', 'معتمد ✓')
                          : isSubmitted
                            ? T('Submitted ✓', 'تم الرفع ✓')
                            : T('Submit for Approval 🔔', 'رفع للاعتماد 🔔')}
                      </span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Clean Next / Prev Pagination Footer */}
          {totalPlayPages > 1 && (
            <div className="ae-bento-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <button
                type="button"
                disabled={currentPlayPage <= 1}
                onClick={() => {
                  setPlaysPage((p) => Math.max(1, p - 1))
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold text-slate-700 transition-colors hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:text-emerald-300"
              >
                {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                <span>{T('Previous', 'السابق')}</span>
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: totalPlayPages }, (_, i) => i + 1).map((pageNum) => {
                  const active = pageNum === currentPlayPage
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => {
                        setPlaysPage(pageNum)
                        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[13.5px] font-extrabold tabular-nums transition-all ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'ae-bento-subcard text-slate-700 hover:text-emerald-700 dark:text-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={currentPlayPage >= totalPlayPages}
                onClick={() => {
                  setPlaysPage((p) => Math.min(totalPlayPages, p + 1))
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold text-slate-700 transition-colors hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200 dark:hover:text-emerald-300"
              >
                <span>{T('Next', 'التالي')}</span>
                {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
