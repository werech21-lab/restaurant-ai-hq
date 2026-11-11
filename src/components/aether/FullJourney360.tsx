'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Lightbulb,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  JOURNEY_KPI_NOW,
  JOURNEY_META,
  JOURNEY_STAGES,
  journeyKpiFormat,
  simulatePlay,
  type JourneyStage,
  type PlayKpi,
} from '@/lib/full-journey-enterprise-brain'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { DualBrainPagePanel } from '@/components/aether/DualBrainPagePanel'
import {
  InteractiveDonutChart,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import type { SimplePlayView, SummaryCardData } from '@/lib/aether/global-filter-engine'
import { useLang } from '@/components/aether/ui'

type Tab = 'numbers' | 'tips' | 'compare'
type FlowGroup = 'timeline' | 'branches'
type TrackerStatus = 'verified' | 'monitoring' | 'stalled'

interface Approval {
  id: string
  approvedAt: string
  snapshotAt: string
  kpi: PlayKpi
  monthlyKwd: number
  titleEn: string
  titleAr: string
}

const STORE = 'vf-journey-approvals-v1'
const CYCLE_DAYS = 14

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

/** ملخص الشركة — Finance V2 × Verdelo × Skerry Executive Bento Workspace */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const { workspace, filters, liveSummary } = useGlobalFilter()

  const [tab, setTab] = useState<Tab>('numbers')
  const [flowGroup, setFlowGroup] = useState<FlowGroup>('timeline')
  const [stage, setStage] = useState<JourneyStage | 'all'>('all')
  const [highlightedPlayId, setHighlightedPlayId] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [syncing, setSyncing] = useState(false)

  // Interactive "تجربة الأرقام" state per recommendation card
  const [openSim, setOpenSim] = useState<Record<string, boolean>>({})
  const [simValues, setSimValues] = useState<Record<string, [number, number]>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setApprovals(JSON.parse(localStorage.getItem(STORE) || '[]'))
    } catch {
      // ignore malformed storage
    }
  }, [])

  // Support deep links (?stage= & ?play=) from Command Palette
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const qStage = sp.get('stage') as JourneyStage | null
    const qPlay = sp.get('play')
    if (qStage && JOURNEY_STAGES.some((s) => s.id === qStage)) {
      setStage(qStage)
      setTab('tips')
    }
    if (qPlay) {
      setTab('tips')
      setHighlightedPlayId(qPlay)
      window.setTimeout(() => {
        document.getElementById(`play-card-${qPlay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 160)
    }
  }, [])

  const persist = (next: Approval[]) => {
    setApprovals(next)
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
    } catch {
      // ignore quota errors
    }
  }

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

  const getSim = useCallback(
    (sp: SimplePlayView) => {
      const p = sp.play
      const vals = simValues[p.id] ?? [p.simulator.sliders[0].defaultValue, p.simulator.sliders[1].defaultValue]
      const sim = simulatePlay(p, vals[0], vals[1])
      const baseRatio = p.monthlyKwd > 0 ? sim.monthlyKwd / p.monthlyKwd : 1
      const scaledPeriodKwd = Math.max(1, Math.round(sp.periodBenefitKwd * baseRatio * 10) / 10)
      const scaledMonthlyKwd = Math.max(10, Math.round(sp.monthlyBenefitKwd * baseRatio))
      return { vals, scaledPeriodKwd, scaledMonthlyKwd }
    },
    [simValues],
  )

  const toggleApprove = (sp: SimplePlayView, customMonthlyKwd?: number) => {
    if (approvals.some((a) => a.id === sp.id)) {
      persist(approvals.filter((a) => a.id !== sp.id))
      return
    }
    persist([
      ...approvals,
      {
        id: sp.id,
        approvedAt: new Date().toISOString(),
        snapshotAt: JOURNEY_META.syncedAt,
        kpi: sp.play.kpi,
        monthlyKwd: customMonthlyKwd ?? sp.monthlyBenefitKwd,
        titleEn: sp.titleEn,
        titleAr: sp.titleAr,
      },
    ])
  }

  const copyWhatsApp = useCallback(
    async (sp: SimplePlayView, benefitLabel: string) => {
      const text = isAr
        ? `*${sp.titleAr}* (${workspace.subtitleAr})\n• المشكلة: ${sp.problemAr}\n• الحل: ${sp.solutionAr}\n• الفايدة المتوقعة: +${benefitLabel}`
        : `*${sp.titleEn}* (${workspace.subtitleEn})\n• Issue: ${sp.problemEn}\n• Fix: ${sp.solutionEn}\n• Expected Gain: +${benefitLabel}`
      try {
        await navigator.clipboard.writeText(text)
        setCopiedId(sp.id)
        window.setTimeout(() => setCopiedId((c) => (c === sp.id ? null : c)), 2000)
      } catch {
        // ignore clipboard error
      }
    },
    [isAr, workspace.subtitleAr, workspace.subtitleEn],
  )

  const visiblePlays = useMemo(
    () => (stage === 'all' ? workspace.plays : workspace.plays.filter((p) => p.stage === stage)),
    [workspace.plays, stage],
  )

  const trackedRows = useMemo(() => {
    return approvals.map((a) => {
      const nowVal = JOURNEY_KPI_NOW[a.kpi.id] ?? a.kpi.value
      const delta = nowVal - a.kpi.value
      const improved = a.kpi.better === 'down' ? delta < -0.001 : delta > 0.001
      const daysSince = Math.max(0, Math.floor((Date.now() - new Date(a.approvedAt).getTime()) / 86_400_000))
      const status: TrackerStatus = improved ? 'verified' : daysSince >= CYCLE_DAYS ? 'stalled' : 'monitoring'
      return { a, nowVal, status }
    })
  }, [approvals])

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
        const count = sid === 'all' ? workspace.plays.length : workspace.plays.filter((p) => p.stage === sid).length
        return { sid, count, lbl: STAGE_SHORT_LABELS[sid] }
      })
      .filter((x) => x.sid === 'all' || x.count > 0)
      .map((x) => ({
        id: x.sid,
        label: isAr ? x.lbl.ar : x.lbl.en,
        badge: x.count,
      }))
  }, [isAr, workspace.plays])

  const periodUnitAr =
    filters.period === 'today' ? 'يومياً' : filters.period === 'week' ? 'أسبوعياً' : filters.period === 'year' ? 'سنوياً' : 'شهرياً'
  const periodUnitEn =
    filters.period === 'today' ? '/ day' : filters.period === 'week' ? '/ week' : filters.period === 'year' ? '/ year' : '/ month'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-5 pb-12">
      {/* Masthead: Clean Finance V2 Bento Header + Verdelo SlidingPillTabs */}
      <header className="ae-bento-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-[26px]">
            {T('Company Summary', 'ملخص الشركة')}
          </h1>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SlidingPillTabs<Tab>
            ariaLabel={T('Sections', 'الأقسام')}
            value={tab}
            onChange={setTab}
            options={[
              { id: 'numbers', label: T('Key Numbers', 'الأرقام المهمة') },
              { id: 'tips', label: T('Profit Tips', 'توصيات الربح'), badge: workspace.plays.length },
              { id: 'compare', label: T('Before & After', 'قبل وبعد'), badge: approvals.length },
            ]}
          />

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

      {/* 1-Click Dual-Brain Executive Analysis */}
      <DualBrainPagePanel
        pageTitleAr="ملخص الشركة"
        pageTitleEn="Company Summary"
        promptAr="حلّل أرقام ملخص الشركة وتوزيعة كل ١٠ دنانير وعطني أهم ٣ خطوات فورية لزيادة الصافي بالجيب الآن."
        promptEn="Analyze our Company Summary and 10-KWD breakdown, and give me the top 3 immediate steps to grow net cash in pocket."
        pageContext={`توزيعة كل 10 د.ك مبيعات: تكلفة الأكل ${f2(food10)} د.ك | عمولة التوصيل ${f2(delivery10)} د.ك | الإيجار والرواتب والمصاريف ${f2(opexRent10)} د.ك | الصافي بالجيب ${f2(netPocket10)} د.ك. إجمالي المبيعات: ${f0(workspace.salesKwd)} د.ك (${f0(workspace.orders)} طلب). التوصيات المتاحة: ${workspace.plays.length} توصية. القرارات المعتمدة: ${approvals.length}.`}
      />

      {/* =====================================================================
          TAB 1: الأرقام المهمة (Finance V2 4 KPI Cards -> 8+4 Bento Split -> Summary Cards)
      ===================================================================== */}
      {tab === 'numbers' && (
        <section className="space-y-5">
          {/* Top Row: 4 Crisp Finance V2 KPI Cards with Hover Micro-Lift */}
          <div className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: المبيعات */}
            <article className="ae-kpi-card ae-glow-emerald p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="ae-icon-badge">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {f0(workspace.orders)} {T('orders', 'طلب')}
                </span>
              </div>
              <p className="mt-3.5 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {T('Sales', 'المبيعات')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwdVal(workspace.salesKwd)}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400 dark:text-slate-400">
                {isAr ? `متوسط الفاتورة ${f2(workspace.aovKwd)} د.ك` : `Avg bill ${f2(workspace.aovKwd)} KWD`}
              </p>
            </article>

            {/* KPI 2: الباقي قبل الإيجار */}
            <article className="ae-kpi-card ae-glow-sky p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                >
                  {f1(beforeRentRatio * 100)}%
                </span>
              </div>
              <p className="mt-3.5 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {T('Left Before Rent', 'الباقي قبل الإيجار')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {fmtKwdVal(beforeRentKwd)}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400 dark:text-slate-400">
                {isAr ? 'بعد خصم الأكل وعمولة التوصيل' : 'After food & delivery fees'}
              </p>
            </article>

            {/* KPI 3: الصافي بالجيب */}
            <article className="ae-kpi-card ae-glow-emerald p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="ae-icon-badge">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span
                  dir="ltr"
                  className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums ${
                    netPocketPct >= 12
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}
                >
                  {f1(netPocketPct)}%
                </span>
              </div>
              <p className="mt-3.5 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {T('Net in Pocket', 'الصافي بالجيب')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {fmtKwdVal(netPocketKwd)}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400 dark:text-slate-400">
                {isAr ? `${f2(netPocket10)} د.ك صافي من كل ١٠ دنانير` : `${f2(netPocket10)} KWD per 10 KWD sales`}
              </p>
            </article>

            {/* KPI 4: فرص زيادة الربح */}
            <article
              onClick={() => setTab('tips')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setTab('tips')
              }}
              className="ae-kpi-card ae-glow-amber cursor-pointer p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {workspace.plays.length} {T('tips', 'توصية')}
                </span>
              </div>
              <p className="mt-3.5 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {T('Profit Opportunities', 'فرص زيادة الربح')}
              </p>
              <div
                dir="ltr"
                className="mt-1 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                +{fmtKwdVal(workspace.totalPlaysBenefitPeriodKwd)}
              </div>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                <span>{T('Open ready steps', 'عرض الخطوات الجاهزة')}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </p>
            </article>
          </div>

          {/* Middle Bento Row: 8-Col Visual Cash-Flow Chart + 4-Col Interactive 10-KWD Donut */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* 8-Col Card: Interactive Cash-Flow & Net Performance Skerry Capsule Chart */}
            <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                    {T('Sales & Net Cash Flow', 'المبيعات والصافي بالجيب')}
                  </h2>
                  <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                    {T(
                      'Hover any capsule bar to inspect exact sales, costs, and net pocket cash',
                      'مرّر الماوس على أي عمود لمعرفة المبيعات والمصاريف والصافي بالجيب بدقة',
                    )}
                  </p>
                </div>

                <SlidingPillTabs<FlowGroup>
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

            {/* 4-Col Card: Finance V2 Interactive Donut Ring ("وين تروح كل ١٠ دنانير؟") */}
            <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 lg:col-span-4">
              <div className="mb-3">
                <h2 className="text-[17px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {T('Where Every 10 KWD Goes?', 'وين تروح كل ١٠ دنانير؟')}
                </h2>
                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {T('Per 10 KWD of sales', 'توزيعة كل ١٠ دنانير مبيعات')}
                </p>
              </div>

              <InteractiveDonutChart
                slices={tenKwdDonutSlices}
                centerValue={`${f1(netPocketPct)}%`}
                centerSubValue={isAr ? `${f2(netPocket10)} د.ك` : `${f2(netPocket10)} KWD`}
                centerLabel={T('Net in Pocket', 'الصافي بالجيب')}
                isAr={isAr}
                legendColumns={2}
              />
            </div>
          </div>

          {/* Operational Detail Bento Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {workspace.summaryCards.map((c) => (
              <article key={c.id} className="ae-kpi-card flex min-h-[178px] flex-col justify-between p-5">
                <div className="space-y-1.5">
                  <h3 className="text-[14.5px] font-bold text-slate-800 dark:text-slate-100">
                    {isAr ? c.titleAr : c.titleEn}
                  </h3>
                  <div className={`text-[24px] font-black tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}>
                    {isAr ? c.valueAr : c.valueEn}
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {isAr ? c.descAr : c.descEn}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="ae-bento-subcard inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-slate-800 transition-colors duration-150 hover:text-slate-950 dark:text-slate-100"
                    >
                      <span>{T('View', 'عرض')}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStage(c.targetStage ?? 'all')
                        setTab('tips')
                      }}
                      className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-slate-800 transition-colors duration-150 hover:text-slate-950 dark:text-slate-100"
                    >
                      <span>{T('Profit Tips', 'توصيات الربح')}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 2: توصيات الربح (Sliding Category Pills + Crisp Action Cards)
      ===================================================================== */}
      {tab === 'tips' && (
        <section className="space-y-5">
          {/* Verdelo Sliding Category Filter Pills */}
          <div className="flex flex-wrap items-center">
            <SlidingPillTabs
              ariaLabel={T('Filter Tips', 'تصنيف التوصيات')}
              surface="white"
              size="sm"
              value={stage}
              onChange={setStage}
              options={stageOptions}
            />
          </div>

          {/* Scannable Recommendation Cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visiblePlays.map((sp) => {
              const approved = approvals.some((a) => a.id === sp.id)
              const simOpen = Boolean(openSim[sp.id])
              const { vals, scaledPeriodKwd, scaledMonthlyKwd } = getSim(sp)
              const benefitNum = scaledPeriodKwd >= 100 ? f0(scaledPeriodKwd) : scaledPeriodKwd.toFixed(1)
              const benefitDisplay = isAr
                ? `${benefitNum} د.ك ${periodUnitAr}`
                : `${benefitNum} KWD ${periodUnitEn}`
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
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                        {isAr ? sp.titleAr : sp.titleEn}
                      </h3>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12.5px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        +{benefitDisplay}
                      </span>
                    </div>

                    {/* ONLY 3 Simple Labels: المشكلة / الحل / الفايدة المتوقعة */}
                    <div className="ae-bento-subcard space-y-2.5 rounded-2xl p-4 text-[13.5px] leading-relaxed">
                      <p className="text-slate-700 dark:text-slate-200">
                        <strong className="font-extrabold text-slate-950 dark:text-white">
                          {T('Problem:', 'المشكلة:')}{' '}
                        </strong>
                        {isAr ? sp.problemAr : sp.problemEn}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        <strong className="font-extrabold text-slate-950 dark:text-white">
                          {T('Solution:', 'الحل:')}{' '}
                        </strong>
                        {isAr ? sp.solutionAr : sp.solutionEn}
                      </p>
                      <p className="text-emerald-800 dark:text-emerald-300">
                        <strong className="font-extrabold">
                          {T('Expected Gain:', 'الفايدة المتوقعة:')}{' '}
                        </strong>
                        <span className="font-extrabold tabular-nums">+{benefitDisplay}</span>
                      </p>
                    </div>

                    {/* Inline Number Tester (تجربة الأرقام) */}
                    {simOpen && (
                      <div className="ae-bento-subcard space-y-3 rounded-2xl p-4">
                        {sp.play.simulator.sliders.map((sl, idx) => {
                          const curVal = vals[idx]
                          return (
                            <label key={sl.id} className="block space-y-1 text-[12.5px]">
                              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                                <span>{isAr ? sl.labelAr : sl.labelEn}</span>
                                <span className="tabular-nums">
                                  {curVal} {sl.unit === 'fils' ? (isAr ? 'فلس' : 'fils') : '%'}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={sl.min}
                                max={sl.max}
                                step={sl.step}
                                value={curVal}
                                onChange={(e) => {
                                  const v = Number(e.target.value)
                                  setSimValues((prev) => ({
                                    ...prev,
                                    [sp.id]: idx === 0 ? [v, vals[1]] : [vals[0], v],
                                  }))
                                }}
                                className="w-full accent-emerald-600"
                              />
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* ONLY 3 Crisp Buttons: تجربة الأرقام | نسخ للواتساب | اعتماد */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpenSim((prev) => ({ ...prev, [sp.id]: !prev[sp.id] }))}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-all duration-150 ${
                        simOpen
                          ? 'ae-btn-primary'
                          : 'ae-bento-subcard text-slate-800 hover:text-slate-950 dark:text-slate-100'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>{T('Test Numbers', 'تجربة الأرقام')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyWhatsApp(sp, benefitDisplay)}
                      className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-slate-800 transition-all duration-150 hover:text-slate-950 dark:text-slate-100"
                    >
                      {copiedId === sp.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-300">
                            {T('Copied', 'تم النسخ')}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{T('Copy for WhatsApp', 'نسخ للواتساب')}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleApprove(sp, scaledMonthlyKwd)}
                      className={`ms-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all duration-150 ${
                        approved
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'ae-btn-primary'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{approved ? T('Approved ✓', 'معتمد ✓') : T('Approve', 'اعتماد')}</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 3: قبل وبعد (Simple Before & After Comparison)
      ===================================================================== */}
      {tab === 'compare' && (
        <section className="space-y-4">
          <div className="ae-bento-card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <h3 className="text-[15.5px] font-extrabold text-slate-950 dark:text-white">
                {T('Interactive Before & After Charts', 'مقارنة قبل وبعد بالرسوم البيانية التفاعلية')}
              </h3>
              <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                {T(
                  'Compare sales, net cash, orders & average bill before and after any period or campaign.',
                  'قارن المبيعات والصافي بالجيب والطلبات ومتوسط الفاتورة قبل وبعد أي فترة أو إعلان.',
                )}
              </p>
            </div>
            <Link
              href="/erp/before-after"
              className="ae-pill-dark inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold"
            >
              <span>{T('Open Before & After', 'فتح صفحة مقارنة قبل وبعد')}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {trackedRows.length === 0 ? (
            <div className="ae-bento-card p-8 text-center">
              <p className="text-[15px] font-bold text-slate-900 dark:text-white">
                {T('No approved tips yet', 'لا توجد توصيات معتمدة حالياً')}
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                {T(
                  'Click "Approve" on any profit tip to track numbers before and after.',
                  'اضغط «اعتماد» على أي توصية لمتابعة الأرقام قبل وبعد التنفيذ.',
                )}
              </p>
              <button
                type="button"
                onClick={() => setTab('tips')}
                className="ae-btn-primary mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold"
              >
                {T('Open Profit Tips', 'فتح توصيات الربح')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {trackedRows.map(({ a, nowVal, status }) => {
                const statusBadge =
                  status === 'verified'
                    ? { ar: 'تحسن فعلي 🟢', en: 'Improved 🟢', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' }
                    : status === 'stalled'
                      ? { ar: 'يحتاج متابعة 🔴', en: 'Needs Check 🔴', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' }
                      : { ar: 'قيد المتابعة 🟠', en: 'Tracking 🟠', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' }
                return (
                  <article key={a.id} className="ae-bento-card p-6">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                        {isAr ? a.titleAr : a.titleEn}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusBadge.cls}`}>
                        {isAr ? statusBadge.ar : statusBadge.en}
                      </span>
                    </div>

                    <div className="ae-bento-subcard mt-4 grid grid-cols-3 gap-3 rounded-2xl p-4 text-center">
                      <div>
                        <div className="text-[11.5px] font-medium text-slate-500">{T('Before', 'قبل')}</div>
                        <div className="mt-1 text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {journeyKpiFormat(a.kpi, isAr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-medium text-slate-500">{T('Now', 'الآن')}</div>
                        <div className="mt-1 text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">
                          {journeyKpiFormat({ ...a.kpi, value: nowVal }, isAr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-medium text-slate-500">
                          {T('Expected Gain', 'الفايدة المتوقعة')}
                        </div>
                        <div className="mt-1 text-[15px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                          +{f0(a.monthlyKwd)} {isAr ? 'د.ك' : 'KWD'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => persist(approvals.filter((x) => x.id !== a.id))}
                        className="ae-bento-subcard cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300"
                      >
                        {T('Remove', 'إلغاء الاعتماد')}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
