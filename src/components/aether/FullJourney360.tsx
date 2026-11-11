'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import {
  JOURNEY_KPI_NOW,
  JOURNEY_META,
  JOURNEY_STAGES,
  journeyKpiFormat,
  simulatePlay,
  type JourneyPlay,
  type JourneyStage,
  type PlayKpi,
} from '@/lib/full-journey-enterprise-brain'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import type { SimplePlayView, SummaryCardData } from '@/lib/aether/global-filter-engine'
import { useLang } from '@/components/aether/ui'

type Tab = 'numbers' | 'tips' | 'compare'
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

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ملخص الشركة — Ultra-Simple Executive Workspace wired to GlobalFilterContext. */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const { workspace, filters } = useGlobalFilter()

  const [tab, setTab] = useState<Tab>('numbers')
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

  // 10-KWD bar segments (guaranteed finite, summing to 10.00)
  const { food10, delivery10, opexRent10, netPocket10 } = workspace.per10
  const barSegments = [
    {
      id: 'food',
      labelAr: 'تكلفة الأكل',
      labelEn: 'Food Cost',
      val: food10,
      bg: 'bg-amber-500',
      dot: 'bg-amber-500',
    },
    {
      id: 'delivery',
      labelAr: 'عمولة التوصيل',
      labelEn: 'Delivery Fee',
      val: delivery10,
      bg: 'bg-rose-500',
      dot: 'bg-rose-500',
    },
    {
      id: 'opex',
      labelAr: 'الإيجار والرواتب والمصاريف',
      labelEn: 'Rent, Pay & Bills',
      val: opexRent10,
      bg: 'bg-slate-400 dark:bg-slate-500',
      dot: 'bg-slate-400',
    },
    {
      id: 'pocket',
      labelAr: 'الصافي بالجيب',
      labelEn: 'Net in Pocket',
      val: netPocket10,
      bg: 'bg-emerald-600',
      dot: 'bg-emerald-600',
      strong: true,
    },
  ]

  const periodUnitAr =
    filters.period === 'today' ? 'يومياً' : filters.period === 'week' ? 'أسبوعياً' : filters.period === 'year' ? 'سنوياً' : 'شهرياً'
  const periodUnitEn =
    filters.period === 'today' ? '/ day' : filters.period === 'week' ? '/ week' : filters.period === 'year' ? '/ year' : '/ month'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6 pb-12">
      {/* Masthead: Ultra-Simple 2-Word Title + Dynamic 1-Line Active Filter Subtitle + 3 Tabs */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-950 dark:text-white sm:text-[26px]">
            {T('Company Summary', 'ملخص الشركة')}
          </h1>
          <p className="text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3 Ultra-Simple Tabs */}
          <nav
            role="tablist"
            aria-label={T('Sections', 'الأقسام')}
            className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] p-1 ring-1 ring-neutral-950/[0.04] dark:bg-white/[0.05] dark:ring-white/[0.08]"
          >
            {(
              [
                ['numbers', T('Key Numbers', 'الأرقام المهمة')],
                ['tips', `${T('Profit Tips', 'توصيات الربح')} (${workspace.plays.length})`],
                ['compare', `${T('Before & After', 'قبل وبعد')} (${approvals.length})`],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold transition-all duration-150 ${
                    active
                      ? 'bg-neutral-950 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                      : 'text-neutral-600 hover:text-neutral-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={() => void refreshLive()}
            disabled={syncing}
            aria-label={T('Refresh', 'تحديث')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-700 ring-1 ring-neutral-950/[0.04] transition-all duration-150 hover:bg-neutral-200/70 hover:text-neutral-950 disabled:opacity-50 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/[0.08]"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* =====================================================================
          TAB 1: الأرقام المهمة (10-KWD Bar + 8 Ultra-Simple Summary Cards)
      ===================================================================== */}
      {tab === 'numbers' && (
        <section className="space-y-6">
          {/* 10-KWD Visual Breakdown Card */}
          <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-neutral-950 dark:text-white">
                {T('Where Every 10 KWD Goes?', 'وين تروح كل ١٠ دنانير مبيعات؟')}
              </h2>
              <span className="text-[13px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {isAr ? `الصافي بالجيب: ${f2(netPocket10)} د.ك` : `Net in Pocket: ${f2(netPocket10)} KWD`}
              </span>
            </div>

            {/* Proportional Bar */}
            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-slate-800">
              {barSegments.map((seg) => {
                const widthPct = Math.max(0, Math.min(100, (seg.val / 10) * 100))
                if (widthPct <= 0) return null
                return (
                  <div
                    key={seg.id}
                    style={{ width: `${widthPct}%` }}
                    className={`${seg.bg} h-full transition-all duration-150`}
                    title={`${isAr ? seg.labelAr : seg.labelEn}: ${f2(seg.val)}`}
                  />
                )
              })}
            </div>

            {/* 4 Clean Labels */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {barSegments.map((seg) => (
                <div
                  key={seg.id}
                  className={`rounded-2xl p-3.5 transition-colors duration-150 ${
                    seg.strong
                      ? 'bg-emerald-50/80 ring-1 ring-emerald-600/20 dark:bg-emerald-950/30 dark:ring-emerald-400/20'
                      : 'bg-[#F7F7F8] dark:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-neutral-600 dark:text-slate-300">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.dot}`} />
                    <span className={seg.strong ? 'font-extrabold text-emerald-900 dark:text-emerald-200' : ''}>
                      {isAr ? seg.labelAr : seg.labelEn}
                    </span>
                  </div>
                  <div
                    className={`mt-1.5 text-xl font-extrabold tabular-nums ${
                      seg.strong ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-950 dark:text-white'
                    }`}
                  >
                    {f2(seg.val)} <span className="text-xs font-semibold">{isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8 Summary Cards (2–3 simple words ONLY, max 1 short clear sentence underneath) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {workspace.summaryCards.map((c) => (
              <article
                key={c.id}
                className="flex min-h-[188px] flex-col justify-between rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] transition-all duration-150 hover:-translate-y-0.5 hover:ring-neutral-950/[0.1] dark:bg-[#0F1626] dark:ring-white/[0.07]"
              >
                <div className="space-y-2">
                  <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white">
                    {isAr ? c.titleAr : c.titleEn}
                  </h3>
                  <div className={`text-[26px] font-extrabold tracking-tight tabular-nums ${ACCENT_RING[c.accent]}`}>
                    {isAr ? c.valueAr : c.valueEn}
                  </div>
                  <p className="text-[13px] leading-relaxed text-neutral-500 dark:text-slate-400">
                    {isAr ? c.descAr : c.descEn}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] px-3.5 py-1.5 text-[12px] font-bold text-neutral-800 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.06] dark:text-slate-100"
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
                      className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] px-3.5 py-1.5 text-[12px] font-bold text-neutral-800 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.06] dark:text-slate-100"
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
          TAB 2: توصيات الربح (3 Simple Labels + 3 Crisp Action Buttons)
      ===================================================================== */}
      {tab === 'tips' && (
        <section className="space-y-5">
          {/* Short 1-word category filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'procurement', 'kitchen', 'menu', 'operations', 'opex', 'delivery', 'quality'] as const).map(
              (sid) => {
                const count =
                  sid === 'all' ? workspace.plays.length : workspace.plays.filter((p) => p.stage === sid).length
                if (sid !== 'all' && count === 0) return null
                const active = stage === sid
                const lbl = STAGE_SHORT_LABELS[sid]
                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => setStage(sid)}
                    className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 ${
                      active
                        ? 'bg-neutral-950 text-white ring-1 ring-neutral-900/80 dark:bg-white dark:text-neutral-950'
                        : 'bg-white text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] hover:text-neutral-950 dark:bg-[#0F1626] dark:text-slate-300 dark:ring-white/[0.08]'
                    }`}
                  >
                    {isAr ? lbl.ar : lbl.en} ({count})
                  </button>
                )
              },
            )}
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
                  className={`flex flex-col justify-between rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 dark:bg-[#0F1626] ${
                    isHighlighted
                      ? 'ring-2 ring-neutral-900 dark:ring-white'
                      : 'ring-1 ring-neutral-950/[0.04] dark:ring-white/[0.07]'
                  }`}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? sp.titleAr : sp.titleEn}
                      </h3>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12.5px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        +{benefitDisplay}
                      </span>
                    </div>

                    {/* ONLY 3 Simple Labels: المشكلة / الحل / الفايدة المتوقعة */}
                    <div className="space-y-2.5 rounded-2xl bg-[#F7F7F8] p-4 text-[13.5px] leading-relaxed dark:bg-white/[0.04]">
                      <p className="text-neutral-700 dark:text-slate-200">
                        <strong className="font-extrabold text-neutral-950 dark:text-white">
                          {T('Problem:', 'المشكلة:')}{' '}
                        </strong>
                        {isAr ? sp.problemAr : sp.problemEn}
                      </p>
                      <p className="text-neutral-700 dark:text-slate-200">
                        <strong className="font-extrabold text-neutral-950 dark:text-white">
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
                      <div className="space-y-3 rounded-2xl bg-[#F7F7F8] p-4 ring-1 ring-neutral-950/[0.05] dark:bg-white/[0.04] dark:ring-white/[0.08]">
                        {sp.play.simulator.sliders.map((sl, idx) => {
                          const curVal = vals[idx]
                          return (
                            <label key={sl.id} className="block space-y-1 text-[12.5px]">
                              <div className="flex items-center justify-between font-bold text-neutral-800 dark:text-slate-200">
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
                                className="w-full accent-neutral-900 dark:accent-white"
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
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-all duration-150 ${
                        simOpen
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'bg-[#F7F7F8] text-neutral-800 hover:bg-neutral-200/80 dark:bg-white/[0.06] dark:text-slate-100'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>{T('Test Numbers', 'تجربة الأرقام')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyWhatsApp(sp, benefitDisplay)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F7F8] px-3.5 py-2 text-[12.5px] font-bold text-neutral-800 transition-all duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.06] dark:text-slate-100"
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
                      className={`ms-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all duration-150 ${
                        approved
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950'
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]">
            <div>
              <h3 className="text-[15px] font-extrabold text-neutral-950 dark:text-white">
                {T('Interactive Before & After Charts', 'مقارنة قبل وبعد بالرسوم البيانية التفاعلية')}
              </h3>
              <p className="text-[12.5px] font-medium text-neutral-500 dark:text-slate-400">
                {T(
                  'Compare sales, net cash, orders & average bill before and after any period or campaign.',
                  'قارن المبيعات والصافي بالجيب والطلبات ومتوسط الفاتورة قبل وبعد أي فترة أو إعلان.',
                )}
              </p>
            </div>
            <Link
              href="/erp/before-after"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
            >
              <span>{T('Open Before & After Page', 'فتح صفحة مقارنة قبل وبعد')}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {trackedRows.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]">
              <p className="text-[15px] font-bold text-neutral-900 dark:text-white">
                {T('No approved tips yet', 'لا توجد توصيات معتمدة حالياً')}
              </p>
              <p className="mt-1 text-[13px] text-neutral-500 dark:text-slate-400">
                {T(
                  'Click "Approve" on any profit tip to track numbers before and after.',
                  'اضغط «اعتماد» على أي توصية لمتابعة الأرقام قبل وبعد التنفيذ.',
                )}
              </p>
              <button
                type="button"
                onClick={() => setTab('tips')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2 text-[13px] font-bold text-white dark:bg-white dark:text-neutral-950"
              >
                {T('Open Profit Tips', 'فتح توصيات الربح')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {trackedRows.map(({ a, nowVal, status }) => {
                const statusBadge =
                  status === 'verified'
                    ? { ar: 'تحسن فعلي 🟢', en: 'Improved 🟢', cls: 'bg-emerald-50 text-emerald-700' }
                    : status === 'stalled'
                      ? { ar: 'يحتاج متابعة 🔴', en: 'Needs Check 🔴', cls: 'bg-rose-50 text-rose-700' }
                      : { ar: 'قيد المتابعة 🟠', en: 'Tracking 🟠', cls: 'bg-amber-50 text-amber-800' }
                return (
                  <article
                    key={a.id}
                    className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.07]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[16px] font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? a.titleAr : a.titleEn}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusBadge.cls}`}>
                        {isAr ? statusBadge.ar : statusBadge.en}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-[#F7F7F8] p-4 text-center dark:bg-white/[0.04]">
                      <div>
                        <div className="text-[11.5px] font-medium text-neutral-500">{T('Before', 'قبل')}</div>
                        <div className="mt-1 text-[15px] font-extrabold tabular-nums text-neutral-900 dark:text-white">
                          {journeyKpiFormat(a.kpi, isAr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-medium text-neutral-500">{T('Now', 'الآن')}</div>
                        <div className="mt-1 text-[15px] font-extrabold tabular-nums text-neutral-900 dark:text-white">
                          {journeyKpiFormat({ ...a.kpi, value: nowVal }, isAr)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11.5px] font-medium text-neutral-500">
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
                        className="rounded-full bg-[#F7F7F8] px-3.5 py-1.5 text-[12px] font-bold text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-950 dark:bg-white/[0.06] dark:text-slate-300"
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
