'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Compass,
  Copy,
  FileText,
  Info,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  formatDateTime,
  formatInt,
  formatKwd,
  formatPct,
} from '@/lib/format'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import {
  buildPlanCircularText,
  computePlanningHubSnapshot,
  FORECAST_HORIZON_OPTIONS,
  INITIAL_STRATEGIC_PHASES,
  localizeArabicPlanningCopy,
  sanitizeStrategicPhases,
  STRATEGIC_ROADMAP_STORAGE_KEY,
  type ForecastHorizonId,
  type ScenarioTierId,
  type StrategicRoadmapPhase,
} from '@/lib/aether/planning-engine'
import {
  buildStrategicAdvisorFallback,
  computeWhatIfStrategicSimulation,
  extractOdooVerifiedPlanningActuals,
  LABEL_DETERMINISTIC_SIM,
  LABEL_MANUAL_WHAT_IF,
  LABEL_ODOO_ACTUAL,
  type PlanningAdvisorRecommendation,
  type PlanningAdvisorResponsePayload,
} from '@/lib/aether/strategic-planning-engine'

const CARD_CLS =
  'ae-bento-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'ae-bento-subcard min-w-0 rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-700 hover:bg-white/70 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/[0.06] dark:hover:text-white'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3.5 text-[14px] font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:bg-[#0B1410] dark:text-slate-100 dark:ring-emerald-500/15'
const PRIMARY_SOFT_BTN_CLS =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-950/65 dark:text-emerald-200 dark:ring-emerald-400/25 dark:hover:bg-emerald-900/60'
const HEADER_ACTION_BTN_CLS =
  'inline-flex min-h-[36px] sm:h-10 min-w-0 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 sm:px-4 py-1.5 sm:py-0 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'

const BADGE_ACTUAL_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-400/25'
const BADGE_MANUAL_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-500/25 dark:bg-indigo-950/70 dark:text-indigo-200 dark:ring-indigo-400/25'
const BADGE_SIM_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-500/25 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-400/25'

const normalizeUniqueTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

function dedupeStrategicPhases(list: StrategicRoadmapPhase[]): StrategicRoadmapPhase[] {
  const seenAr = new Set<string>()
  const seenEn = new Set<string>()
  const out: StrategicRoadmapPhase[] = []
  for (const item of list) {
    const kAr = normalizeUniqueTitle(item.titleAr)
    const kEn = normalizeUniqueTitle(item.titleEn)
    if ((kAr && seenAr.has(kAr)) || (kEn && seenEn.has(kEn))) continue
    if (kAr) seenAr.add(kAr)
    if (kEn) seenEn.add(kEn)
    out.push(item)
  }
  return out
}

function CompactBoundaryTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="group relative inline-flex shrink-0 items-center">
      <button
        type="button"
        title={text}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full end-0 z-40 mb-2 w-72 rounded-xl bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg ring-1 ring-white/10 transition-opacity dark:bg-slate-800 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}
      >
        {text}
      </span>
    </span>
  )
}

export function StrategicPlanningStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const fmtLocale = isAr ? 'ar' : 'en'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { workspace, liveSummary, isAuditor } = useGlobalFilter()

  const [horizon, setHorizon] = useState<ForecastHorizonId>('90d')
  const [customFrom, setCustomFrom] = useState('2026-11-15')
  const [customTo, setCustomTo] = useState('2027-02-15')
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioTierId>('realistic')
  const [phases, setPhases] = useState<StrategicRoadmapPhase[]>(INITIAL_STRATEGIC_PHASES)
  const [formOpen, setFormOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Interactive Manual What-If Simulator Controls
  const [targetGrowthPct, setTargetGrowthPct] = useState<number>(9.5)
  const [directChannelShiftPct, setDirectChannelShiftPct] = useState<number>(5)
  const [costEfficiencyPct, setCostEfficiencyPct] = useState<number>(3.4)

  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('2026-11-20')
  const [newEnd, setNewEnd] = useState('2027-01-20')
  const [newOwner, setNewOwner] = useState('')
  const [newCostCap, setNewCostCap] = useState('300')
  const [newMonthlyGain, setNewMonthlyGain] = useState('1200')
  const [newKpi, setNewKpi] = useState('')

  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [advisorRecs, setAdvisorRecs] = useState<PlanningAdvisorRecommendation[] | null>(null)
  const [advisorModelLabel, setAdvisorModelLabel] = useState<string | null>(null)
  const [advisorUpdatedAt, setAdvisorUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STRATEGIC_ROADMAP_STORAGE_KEY)
      if (raw) {
        setPhases(dedupeStrategicPhases(sanitizeStrategicPhases(JSON.parse(raw))))
      }
    } catch {}
  }, [])

  const persistPhases = useCallback((next: StrategicRoadmapPhase[]) => {
    const clean = dedupeStrategicPhases(next)
    setPhases(clean)
    try {
      window.localStorage.setItem(STRATEGIC_ROADMAP_STORAGE_KEY, JSON.stringify(clean))
    } catch {}
  }, [])

  const snap = useMemo(
    () => computePlanningHubSnapshot(workspace, phases, horizon, customFrom, customTo, liveSummary),
    [workspace, phases, horizon, customFrom, customTo, liveSummary],
  )

  const actuals = useMemo(
    () => extractOdooVerifiedPlanningActuals(liveSummary, workspace),
    [liveSummary, workspace],
  )

  const totalCostCap = useMemo(
    () => phases.reduce((s, p) => s + p.costCapKwd, 0),
    [phases],
  )
  const totalMonthlyUpside = useMemo(
    () => phases.reduce((s, p) => s + p.expectedMonthlyGainKwd, 0),
    [phases],
  )

  const whatIfInputs = useMemo(
    () => ({
      targetGrowthPct,
      directChannelShiftPct,
      costEfficiencyPct,
      horizonDays: snap.horizonDays,
      roadmapCostCapKwd: totalCostCap,
      roadmapMonthlyGainKwd: totalMonthlyUpside,
    }),
    [
      costEfficiencyPct,
      directChannelShiftPct,
      snap.horizonDays,
      targetGrowthPct,
      totalCostCap,
      totalMonthlyUpside,
    ],
  )

  const whatIfSim = useMemo(
    () => computeWhatIfStrategicSimulation(snap, whatIfInputs),
    [snap, whatIfInputs],
  )

  const defaultAdvisorRecs = useMemo(
    () => buildStrategicAdvisorFallback({ actuals, whatIf: whatIfInputs, sim: whatIfSim }),
    [actuals, whatIfInputs, whatIfSim],
  )

  const activeScenario = useMemo(
    () => snap.scenarios.find((s) => s.id === activeScenarioId) ?? snap.scenarios[1] ?? snap.scenarios[0],
    [snap.scenarios, activeScenarioId],
  )

  const cleanSubtitleAr = useMemo(
    () => localizeArabicPlanningCopy(workspace.subtitleAr),
    [workspace.subtitleAr],
  )

  const runStrategicAdvisor = useCallback(async () => {
    if (snap.noData || !snap.odooConnected || isAuditor) return
    setAdvisorLoading(true)
    try {
      const res = await fetch('/api/erp/planning-advisor', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'strategic-planning',
          horizonId: horizon,
          customFrom,
          customTo,
          whatIfInputs,
        }),
      })
      if (res.ok) {
        const payload = (await res.json()) as PlanningAdvisorResponsePayload
        if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
          setAdvisorRecs(payload.recommendations)
          setAdvisorModelLabel(isAr ? payload.modelLabelAr : payload.modelLabelEn)
          setAdvisorUpdatedAt(
            formatDateTime(new Date(payload.updatedAtIso), { locale: fmtLocale, showZone: true }),
          )
        }
      }
    } catch {
      // Fallback recommendations remain displayed seamlessly.
    } finally {
      setAdvisorLoading(false)
    }
  }, [customFrom, customTo, fmtLocale, horizon, isAr, isAuditor, snap.noData, snap.odooConnected, whatIfInputs])

  useEffect(() => {
    if (snap.noData || !snap.odooConnected || isAuditor) return
    const timer = window.setTimeout(() => {
      void runStrategicAdvisor()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [
    horizon,
    targetGrowthPct,
    directChannelShiftPct,
    costEfficiencyPct,
    totalCostCap,
    totalMonthlyUpside,
    isAuditor,
    runStrategicAdvisor,
    snap.noData,
    snap.odooConnected,
  ])

  const copyToClipboard = useCallback((key: string, text: string) => {
    try {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2200)
    } catch {}
  }, [])

  const handleAddPhase = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const cleanTitle =
        newTitle.trim() ||
        (isAr ? 'مرحلة تشغيلية تقديرية جديدة' : 'New Estimated Execution Phase')
      const cleanOwner =
        newOwner.trim() || (isAr ? 'إدارة التشغيل والفروع' : 'Operations & Branch Team')
      const cleanKpi =
        newKpi.trim() ||
        (isAr
          ? 'رفع صافي التدفق النقدي وضبط سقف التكلفة'
          : 'Grow net cash flow within estimated cost cap')
      const costCapVal = Math.max(0, Number(newCostCap) || 0)
      const created: StrategicRoadmapPhase = {
        id: `plan-phase-${Date.now()}`,
        phaseCode: `P${phases.length + 1}`,
        titleAr: localizeArabicPlanningCopy(cleanTitle),
        titleEn: cleanTitle,
        startDate: newStart <= newEnd ? newStart : newEnd,
        endDate: newStart <= newEnd ? newEnd : newStart,
        ownerAr: localizeArabicPlanningCopy(cleanOwner),
        ownerEn: cleanOwner,
        costCapKwd: costCapVal,
        expectedMonthlyGainKwd: Math.max(0, Number(newMonthlyGain) || 0),
        targetKpiAr: localizeArabicPlanningCopy(cleanKpi),
        targetKpiEn: cleanKpi,
        odooWatchMetricAr: `مراجعة الصرف في أودو مقابل سقف تقديري ${formatKwd(costCapVal, 'ar')}`,
        odooWatchMetricEn: `Review Odoo spend against ${formatKwd(costCapVal, 'en')} estimated cap`,
      }
      persistPhases([created, ...phases])
      setNewTitle('')
      setNewOwner('')
      setNewKpi('')
      setFormOpen(false)
    },
    [isAr, newCostCap, newEnd, newKpi, newMonthlyGain, newOwner, newStart, newTitle, persistPhases, phases],
  )

  const handleDeletePhase = useCallback(
    (id: string) => {
      persistPhases(phases.filter((p) => p.id !== id))
    },
    [persistPhases, phases],
  )

  const provenanceRange = useMemo(
    () => ({
      from: snap.periodFromIso || workspace.dateRange.from,
      to: snap.periodToIso || workspace.dateRange.to,
    }),
    [snap.periodFromIso, snap.periodToIso, workspace.dateRange.from, workspace.dateRange.to],
  )

  const displayedAdvisorRecs = advisorRecs ?? defaultAdvisorRecs

  // Strict Zero-Fallback Disconnect / Empty Truth: never fall back to static baselines or numbers
  if (!workspace.odooConnected || workspace.noData || snap.noData || !snap.odooConnected) {
    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="w-full max-w-[1920px] min-w-0 mx-auto space-y-6 pb-12 text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-100"
      >
        <StateBlock
          state="empty"
          locale={fmtLocale}
          title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No data from Odoo for this period'}
          description={
            isAr
              ? 'تم إلغاء أي خط أساس ثابت أو أرقام مخترعة في التخطيط الاستراتيجي. يُرجى التحقق من اتصال Odoo 17 أو اختيار فترة زمنية تحتوي على إيصالات فعلية لبناء التقديرات.'
              : 'Static baselines have been permanently removed. Connect to Odoo 17 or select a date window with posted receipts to compute scenario estimates.'
          }
        />
      </div>
    )
  }

  const boundaryNote = isAr
    ? `الأرقام الموسومة بـ «${LABEL_ODOO_ACTUAL.ar}» مستخرجة مباشرة للقراءة فقط من أودو 17، بينما معاملات «${LABEL_MANUAL_WHAT_IF.ar}» ومخرجات «${LABEL_DETERMINISTIC_SIM.ar}» هي محاكاة رياضية استشرافية دون افتراض أي تكلفة معيارية غير مقروءة.`
    : `Metrics badged "${LABEL_ODOO_ACTUAL.en}" come directly read-only from Odoo 17; "${LABEL_MANUAL_WHAT_IF.en}" controls and "${LABEL_DETERMINISTIC_SIM.en}" projections are mathematical models with zero fabricated cost assumptions.`

  // Dynamic Actuals Strip count
  const hasYtdActual = actuals.ytdNetSalesKwd !== null && actuals.ytdNetSalesKwd > 0
  const hasBranchActual = actuals.topBranch !== null
  const hasExbOrBrandActual = actuals.exhibitionsActuals.available || actuals.topBrand !== null
  const actualCardsCount =
    1 + 1 + Number(hasYtdActual) + Number(hasBranchActual || hasExbOrBrandActual)
  const actualGridCols =
    actualCardsCount >= 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : actualCardsCount === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] min-w-0 mx-auto space-y-6 pb-12 text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-100"
    >
      {/* ───────────── 1. Contextual Bar + Subtle Boundary (i) Tooltip + Horizon Picker + AI Advisor CTA ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="ae-icon-badge shrink-0">
            <Compass className="h-4 w-4" />
          </span>
          <p className="min-w-0 whitespace-normal text-[13px] sm:text-[13.5px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr
              ? `${snap.horizonLabelAr} • ${cleanSubtitleAr} • الفترة المرجعية: ${snap.periodFromIso} إلى ${snap.periodToIso} • المصدر: Odoo 17`
              : `${snap.horizonLabelEn} • ${workspace.subtitleEn} • Reference window: ${snap.periodFromIso} → ${snap.periodToIso} • Source: Odoo 17`}
          </p>
          <CompactBoundaryTooltip
            text={boundaryNote}
            label={isAr ? 'توضيح منهجية البيانات والمحاكاة' : 'Methodology & data boundary info'}
          />
        </div>

        <div className="flex max-w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
          <div
            role="tablist"
            aria-label={isAr ? 'أفق التقديرات' : 'Estimate Horizon'}
            className={SEGMENT_TRACK_CLS}
          >
            {FORECAST_HORIZON_OPTIONS.map((h) => {
              const active = horizon === h.id
              return (
                <button
                  key={h.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setHorizon(h.id)}
                  className={`${SEGMENT_BTN_CLS} ${
                    active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                  }`}
                >
                  {isAr ? h.ar : h.en}
                </button>
              )
            })}
          </div>

          {!isAuditor ? (
            <button
              type="button"
              data-run-planning-advisor="true"
              onClick={() => void runStrategicAdvisor()}
              disabled={advisorLoading}
              className={HEADER_ACTION_BTN_CLS}
            >
              {advisorLoading ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0" />
              )}
              <span>
                {advisorLoading
                  ? isAr
                    ? 'جارٍ استشارة الذكاء الاستراتيجي...'
                    : 'Running AI Advisor...'
                  : isAr
                    ? 'تحديث توصيات الذكاء الاصطناعي ✨'
                    : 'Run AI Strategic Advisor ✨'}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Custom Horizon Inline Date Inputs */}
      {horizon === 'custom' ? (
        <div className="ae-bento-card flex flex-wrap items-center gap-3 px-5 py-3.5">
          <span className={BADGE_MANUAL_CLS}>
            {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
          </span>
          <span className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            {isAr ? 'نطاق المحاكاة المخصص:' : 'Custom Simulation Window:'}
          </span>
          <label className="inline-flex items-center gap-2 text-[13.5px] text-slate-500 dark:text-slate-300">
            <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="ae-input h-9 px-3.5 text-[13.5px] font-semibold tabular-nums"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-[13.5px] text-slate-500 dark:text-slate-300">
            <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="ae-input h-9 px-3.5 text-[13.5px] font-semibold tabular-nums"
            />
          </label>
          <span dir={isAr ? 'rtl' : 'ltr'} className={BADGE_SIM_CLS}>
            {isAr ? (
              <>
                {LABEL_DETERMINISTIC_SIM.ar} • <span dir="ltr">{formatInt(snap.horizonDays, 'ar')}</span> يوم
              </>
            ) : (
              `${LABEL_DETERMINISTIC_SIM.en} • ${formatInt(snap.horizonDays, 'en')} days`
            )}
          </span>
        </div>
      ) : null}

      {/* ───────────── 1B. Odoo Verified Actuals Strip (Strictly Separated from Simulator Inputs) ───────────── */}
      <section data-odoo-verified-actuals-strip="true" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              {isAr
                ? 'خط الأساس الفعلي من أودو 17 (للمعايرة المرجعية)'
                : 'Odoo 17 Baseline Telemetry (Reference Actuals)'}
            </h2>
            <span data-badge-kind="odoo-verified-actual" className={BADGE_ACTUAL_CLS}>
              {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
            {`pos.order · ${actuals.periodFrom || snap.periodFromIso} → ${actuals.periodTo || snap.periodToIso}`}
          </span>
        </div>

        <div className={`grid gap-3 sm:gap-4 ${actualGridCols}`}>
          <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'صافي مبيعات 30 يوم الفعلية' : '30d Net Sales'}
              </span>
              <span className={BADGE_ACTUAL_CLS}>
                {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
              </span>
            </div>
            <div dir="ltr" className="text-lg sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatKwd(actuals.month30dNetSalesKwd, fmtLocale)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? `${formatInt(actuals.month30dOrders, 'ar')} طلب مسجل في نقاط البيع`
                : `${formatInt(actuals.month30dOrders, 'en')} posted POS orders`}
            </p>
          </article>

          <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'المعدل اليومي ومتوسط الفاتورة' : 'Daily Run-Rate & AOV'}
              </span>
              <span className={BADGE_ACTUAL_CLS}>
                {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
              </span>
            </div>
            <div dir="ltr" className="text-lg sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatKwd(actuals.month30dDailyRunRateKwd, fmtLocale)}/{isAr ? 'يوم' : 'd'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {actuals.month30dAovKwd !== null
                ? isAr
                  ? `متوسط الطلب الفعلي: ${formatKwd(actuals.month30dAovKwd, 'ar')}`
                  : `Observed AOV: ${formatKwd(actuals.month30dAovKwd, 'en')}`
                : isAr
                  ? `حصة القنوات المباشرة: ${formatPct(actuals.directSharePct, { locale: 'ar', decimals: 1 })}`
                  : `Direct share: ${formatPct(actuals.directSharePct, { locale: 'en', decimals: 1 })}`}
            </p>
          </article>

          {hasYtdActual && actuals.ytdNetSalesKwd !== null ? (
            <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'صافي مبيعات السنة حتى تاريخه' : 'YTD Net Sales'}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div dir="ltr" className="text-lg sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatKwd(actuals.ytdNetSalesKwd, fmtLocale)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {actuals.ytdOrders !== null
                  ? isAr
                    ? `${formatInt(actuals.ytdOrders, 'ar')} طلب سنوي موثّق`
                    : `${formatInt(actuals.ytdOrders, 'en')} YTD orders`
                  : isAr
                    ? 'إجمالي تراكمي من pos.order'
                    : 'Cumulative YTD from pos.order'}
              </p>
            </article>
          ) : null}

          {hasBranchActual && actuals.topBranch ? (
            <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'مرجع الفروع والمعارض' : 'Branch & Exhibitions Benchmark'}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div className="truncate text-base sm:text-xl font-semibold text-slate-900 dark:text-white">
                {isAr ? actuals.topBranch.labelAr : actuals.topBranch.labelEn}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? `${formatKwd(actuals.topBranch.netKwd, 'ar')} (${formatPct(actuals.topBranch.sharePct, { locale: 'ar', decimals: 1 })})${actuals.exhibitionsActuals.available ? ` • المعارض المتنقلة: ${formatKwd(actuals.exhibitionsActuals.netKwd, 'ar')}` : ''}`
                  : `${formatKwd(actuals.topBranch.netKwd, 'en')} (${formatPct(actuals.topBranch.sharePct, { locale: 'en', decimals: 1 })})${actuals.exhibitionsActuals.available ? ` • Exhibitions EXB: ${formatKwd(actuals.exhibitionsActuals.netKwd, 'en')}` : ''}`}
              </p>
            </article>
          ) : hasExbOrBrandActual && actuals.topBrand ? (
            <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'العلامة القيادية الفعلية' : 'Top Brand Benchmark'}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div className="truncate text-base sm:text-xl font-semibold text-slate-900 dark:text-white">
                {isAr ? actuals.topBrand.labelAr : actuals.topBrand.labelEn}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                {formatKwd(actuals.topBrand.netKwd, fmtLocale)}
              </p>
            </article>
          ) : null}
        </div>
      </section>

      {/* ───────────── 1C. Interactive Manual What-If Simulator Controls + Deterministic Simulation Output ───────────── */}
      <section data-manual-what-if-panel="true" className={`${CARD_CLS} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <Sliders className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              {isAr ? 'مختبر المحاكاة التفاعلي (ماذا لو)' : 'Interactive What-If Strategy Simulator'}
            </h2>
            <span data-badge-kind="manual-what-if-input" className={BADGE_MANUAL_CLS}>
              {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
            </span>
          </div>
          <span data-badge-kind="deterministic-simulation" className={BADGE_SIM_CLS}>
            {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 lg:col-span-7">
            <label className={`${SUBCARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  {isAr ? 'نسبة النمو المستهدفة %' : 'Target Growth %'}
                </span>
                <span className={BADGE_MANUAL_CLS}>
                  {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
                </span>
              </div>
              <div dir="ltr" className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                {targetGrowthPct >= 0 ? `+${targetGrowthPct.toFixed(1)}%` : `${targetGrowthPct.toFixed(1)}%`}
              </div>
              <input
                type="range"
                min={-15}
                max={40}
                step={0.5}
                value={targetGrowthPct}
                onChange={(e) => setTargetGrowthPct(Number(e.target.value))}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </label>

            <label className={`${SUBCARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  {isAr ? 'تحويل للقنوات المباشرة %' : 'Direct Channel Shift %'}
                </span>
                <span className={BADGE_MANUAL_CLS}>
                  {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
                </span>
              </div>
              <div dir="ltr" className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                +{directChannelShiftPct.toFixed(1)}%
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={directChannelShiftPct}
                onChange={(e) => setDirectChannelShiftPct(Number(e.target.value))}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </label>

            <label className={`${SUBCARD_CLS} flex flex-col justify-between gap-2`}>
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  {isAr ? 'كفاءة ضبط التكاليف %' : 'Cost Efficiency %'}
                </span>
                <span className={BADGE_MANUAL_CLS}>
                  {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
                </span>
              </div>
              <div dir="ltr" className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                +{costEfficiencyPct.toFixed(1)}%
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.2}
                value={costEfficiencyPct}
                onChange={(e) => setCostEfficiencyPct(Number(e.target.value))}
                className="w-full cursor-pointer accent-indigo-600"
              />
            </label>
          </div>

          <div className="rounded-2xl bg-sky-50/70 p-4 ring-1 ring-sky-200/80 lg:col-span-5 dark:bg-sky-950/30 dark:ring-sky-400/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                {isAr ? 'مخرجات المحاكاة المخصصة' : 'Custom What-If Output'}
              </span>
              <span className={BADGE_SIM_CLS}>
                {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'المبيعات المحاكاة' : 'Simulated Sales'}
                </div>
                <div dir="ltr" className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatKwd(whatIfSim.projectedSalesKwd, fmtLocale)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {whatIfSim.projectedNetCashKwd !== null
                    ? isAr
                      ? 'صافي التدفق المحاكى'
                      : 'Simulated Net Cash'
                    : isAr
                      ? 'حجم التحويل المحمي'
                      : 'Protected Direct Volume'}
                </div>
                <div dir="ltr" className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {whatIfSim.projectedNetCashKwd !== null
                    ? formatKwd(whatIfSim.projectedNetCashKwd, { locale: fmtLocale, signed: true })
                    : formatKwd(whatIfSim.directCommissionProtectedVolumeKwd, fmtLocale)}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {isAr ? whatIfSim.formulaAr : whatIfSim.formulaEn}
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── 1D. Real AI Strategic Advisor Recommendations (`POST /api/erp/planning-advisor`) ───────────── */}
      {displayedAdvisorRecs.length > 0 ? (
        <section data-planning-ai-advisor="true" className={`${CARD_CLS} ae-glow-emerald space-y-3.5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <h2 className="text-[15.5px] font-semibold text-slate-900 dark:text-white">
                {isAr
                  ? 'التوصيات الاستراتيجية الذكية المعايرة بفعليات أودو'
                  : 'AI Strategic Recommendations (Odoo-Calibrated)'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-200">
                {advisorModelLabel ??
                  (isAr
                    ? 'مستشار مالي رقمي حتمي • موثّق من أودو 17'
                    : 'CFO Deterministic Advisor • Odoo 17 Grounded')}
              </span>
              {advisorUpdatedAt ? (
                <span dir="ltr" className="tabular-nums">
                  {advisorUpdatedAt}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            {displayedAdvisorRecs.map((rec) => (
              <article
                key={rec.id}
                className={`${SUBCARD_CLS} flex flex-col justify-between gap-2.5`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-[14px] font-semibold leading-snug text-slate-900 dark:text-white">
                      {isAr ? rec.titleAr : rec.titleEn}
                    </h3>
                    <span dir="ltr" className={BADGE_SIM_CLS}>
                      {isAr ? rec.badgeAr : rec.badgeEn}
                    </span>
                  </div>
                  <p className="whitespace-normal text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                    {isAr ? rec.bodyAr : rec.bodyEn}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ───────────── 2. Normalized Baseline Projection Cards — Dynamic Grid Columns + Visible Formula ───────────── */}
      <section
        className={`grid gap-3 sm:gap-4 ${
          snap.accountingAvailable
            ? 'grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-3'
        }`}
      >
        <article className={`${KPI_CARD_CLS} ae-glow-emerald flex flex-col justify-between gap-2.5`}>
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[12.5px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'خط الأساس التقديري — طول الشهر التقويمي' : 'Calendar-month baseline estimate'}
              </span>
              <span className={BADGE_SIM_CLS}>
                {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
              </span>
            </div>
            <div
              dir="ltr"
              data-kpi-val
              className="mt-1.5 text-base sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums break-words text-slate-900 dark:text-white"
            >
              {formatKwd(snap.monthlyBaselineSalesKwd, fmtLocale)}
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {isAr ? (
                <>
                  المتوسط اليومي التقديري:{' '}
                  <span dir="ltr" className="tabular-nums font-semibold">
                    {formatKwd(snap.dailyAverageSalesKwd, 'ar')}
                  </span>{' '}
                  {snap.accountingAvailable ? (
                    <>
                      • الصافي التقديري:{' '}
                      <span dir="ltr" className="tabular-nums font-semibold">
                        {formatKwd(snap.monthlyBaselineNetKwd, 'ar')}
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Est. daily avg:{' '}
                  <span dir="ltr" className="tabular-nums font-semibold">
                    {formatKwd(snap.dailyAverageSalesKwd, 'en')}
                  </span>{' '}
                  {snap.accountingAvailable ? (
                    <>
                      • Est. net:{' '}
                      <span dir="ltr" className="tabular-nums font-semibold">
                        {formatKwd(snap.monthlyBaselineNetKwd, 'en')}
                      </span>
                    </>
                  ) : null}
                </>
              )}
            </p>
            <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isAr ? 'المعادلة الظاهرة: ' : 'Formula: '}
              </span>
              {isAr ? snap.baselineFormulaAr : snap.baselineFormulaEn}
            </div>
          </div>
          <KpiProvenanceBadge
            odooModel="pos.order + account.move.line"
            dateRange={provenanceRange}
            lastSyncAt={snap.lastSyncedAt}
            isStale24h={snap.isStale24h}
            kind="تقدير"
            queryOrFormula={isAr ? snap.baselineFormulaAr : snap.baselineFormulaEn}
            isAr={isAr}
            compact
          />
        </article>

        {snap.accountingAvailable ? (
          <article className={`${KPI_CARD_CLS} flex flex-col justify-between gap-2.5`}>
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'معاملات التكلفة والعمولات الفعلية' : 'Posted COGS & Commission Ratios'}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div
                dir="ltr"
                data-kpi-val
                className="mt-1.5 text-lg sm:text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
              >
                {formatPct(snap.ardiyaFoodPct, { locale: fmtLocale, decimals: 1 })}{' '}
                <span className="text-[12.5px] sm:text-[14px] font-semibold text-slate-600 dark:text-slate-300">
                  +{' '}
                  {snap.aggregatorCommissionUnposted
                    ? isAr
                      ? 'غير مُرحَّل بعد'
                      : 'Unposted'
                    : formatPct(snap.deliveryFeePct, { locale: fmtLocale, decimals: 1 })}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                {isAr
                  ? `حصة الصالة والسفري المباشر (0% عمولة): ${formatPct(snap.directChannelSharePct, { locale: 'ar', decimals: 1 })}`
                  : `Zero-commission Dine-In & Direct share: ${formatPct(snap.directChannelSharePct, { locale: 'en', decimals: 1 })}`}
              </p>
              <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? 'المعادلة الظاهرة: ' : 'Formula: '}
                </span>
                {isAr ? snap.costShareFormulaAr : snap.costShareFormulaEn}
              </div>
            </div>
            <KpiProvenanceBadge
              odooModel="account.move.line + pos.order"
              dateRange={provenanceRange}
              lastSyncAt={snap.lastSyncedAt}
              isStale24h={snap.isStale24h}
              kind="فعلي"
              queryOrFormula={isAr ? snap.costShareFormulaAr : snap.costShareFormulaEn}
              isAr={isAr}
              compact
            />
          </article>
        ) : null}

        <article className={`${KPI_CARD_CLS} ae-glow-sky flex flex-col justify-between gap-2.5`}>
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[12.5px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'التغير الدوري الفعلي للفترة المرجعية' : 'Observed Period Momentum'}
              </span>
              <span className={BADGE_ACTUAL_CLS}>
                {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
              </span>
            </div>
            <div
              dir="ltr"
              data-kpi-val
              className="mt-1.5 text-lg sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
            >
              {formatPct(snap.paydayLiftPct, { locale: fmtLocale, decimals: 1, signed: true })}
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {isAr
                ? `مقارنة الفترة المرجعية (${snap.periodFromIso} ← ${snap.periodToIso}) بالفترة السابقة`
                : `Reference window (${snap.periodFromIso} → ${snap.periodToIso}) vs prior window`}
            </p>
            <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isAr ? 'المعادلة الظاهرة: ' : 'Formula: '}
              </span>
              {isAr ? snap.momentumFormulaAr : snap.momentumFormulaEn}
            </div>
          </div>
          <KpiProvenanceBadge
            odooModel="pos.order"
            dateRange={provenanceRange}
            lastSyncAt={snap.lastSyncedAt}
            isStale24h={snap.isStale24h}
            kind="فعلي"
            queryOrFormula={isAr ? snap.momentumFormulaAr : snap.momentumFormulaEn}
            isAr={isAr}
            compact
          />
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-emerald flex flex-col justify-between gap-2.5`}>
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[12.5px] sm:text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                {isAr ? 'العائد للمراحل المضافة يدوياً' : 'User Roadmap Upside'}
              </span>
              <span className={BADGE_MANUAL_CLS}>
                {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
              </span>
            </div>
            <div
              dir="ltr"
              data-kpi-val
              className="mt-1.5 text-base sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums break-words text-emerald-700 dark:text-emerald-400"
            >
              {formatKwd(totalMonthlyUpside, { locale: fmtLocale, signed: true })}/
              <span className="text-[12px] sm:text-[14.5px] font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'شهر' : 'mo'}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {isAr
                ? `عدد المراحل المضافة: ${formatInt(phases.length, 'ar')} • إجمالي سقف التكلفة: ${formatKwd(totalCostCap, 'ar')}`
                : `User phases: ${formatInt(phases.length, 'en')} • Total cost cap: ${formatKwd(totalCostCap, 'en')}`}
            </p>
            <div className="mt-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isAr ? 'المعادلة الظاهرة: ' : 'Formula: '}
              </span>
              {isAr
                ? `مجموع العوائد الشهرية المدخلة يدوياً (${formatInt(phases.length, 'ar')} مراحل) = ${formatKwd(totalMonthlyUpside, { locale: 'ar', signed: true })}/شهر`
                : `Sum of user-entered phase monthly gains (${formatInt(phases.length, 'en')} phases) = ${formatKwd(totalMonthlyUpside, { locale: 'en', signed: true })}/mo`}
            </div>
          </div>
          <KpiProvenanceBadge
            odooModel="pos.order"
            dateRange={provenanceRange}
            lastSyncAt={snap.lastSyncedAt}
            isStale24h={snap.isStale24h}
            kind="تقدير"
            queryOrFormula={
              isAr
                ? `Σ العائد الشهري المقدر للمراحل المدخلة (${formatInt(phases.length, 'ar')}) = ${formatKwd(totalMonthlyUpside, 'ar')}`
                : `Sum(expectedMonthlyGainKwd across ${formatInt(phases.length, 'en')} user phases) = ${formatKwd(totalMonthlyUpside, 'en')}`
            }
            isAr={isAr}
            compact
          />
        </article>
      </section>

      {/* ───────────── 3. 3-Scenario Forecast Cards — Badged Deterministic Simulation + Estimate ───────────── */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {isAr
                ? 'سيناريوهات المحاكاة المالية القياسية الثلاثة'
                : 'Three Reference Financial Simulation Scenarios'}
            </h2>
            <p className="text-[14px] text-slate-600 dark:text-slate-300">
              {isAr
                ? 'محسوبة بمعادلات رقمية حتمية فوق خط الأساس الموثّق من أودو'
                : 'Computed deterministically with explicit formulas over the Odoo baseline'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={BADGE_SIM_CLS}>
              {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
            </span>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {isAr ? 'تقدير' : 'Estimate'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {snap.scenarios.map((sc) => {
            const selected = sc.id === activeScenarioId
            return (
              <article
                key={sc.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => setActiveScenarioId(sc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveScenarioId(sc.id)
                  }
                }}
                className={`${CARD_CLS} flex cursor-pointer flex-col justify-between gap-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                  selected
                    ? 'ring-2 ring-emerald-500/75 dark:ring-emerald-400/75'
                    : 'hover:-translate-y-0.5'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${
                          sc.id === 'realistic'
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
                            : sc.id === 'ambitious'
                              ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-200'
                        }`}
                      >
                        {isAr ? sc.badgeAr : sc.badgeEn}
                      </span>
                      <p className="mt-1.5 text-[13.5px] text-slate-600 dark:text-slate-300">
                        {isAr ? sc.subtitleAr : sc.subtitleEn}
                      </p>
                    </div>

                    <span className={BADGE_SIM_CLS}>
                      {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
                    </span>
                  </div>

                  {/* Core Simulated Numbers */}
                  <div
                    className={`grid ${
                      snap.accountingAvailable ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'
                    } gap-2 sm:gap-2.5`}
                  >
                    <div className="ae-bento-subcard p-2.5 sm:p-3">
                      <div className="flex items-center justify-between gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span>{isAr ? 'المبيعات المقدّرة' : 'Est. Sales'}</span>
                      </div>
                      <div
                        dir="ltr"
                        className="mt-1 text-sm sm:text-base font-semibold tracking-tight tabular-nums break-words text-slate-900 dark:text-white"
                      >
                        {formatKwd(sc.projectedSalesKwd, { locale: fmtLocale, showUnit: false })}
                      </div>
                      <div className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                        {kwd} • {isAr ? 'تقدير' : 'Est.'}
                      </div>
                    </div>

                    {snap.accountingAvailable ? (
                      <div className="ae-bento-subcard p-2.5 sm:p-3">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {isAr ? 'التكاليف المقدّرة' : 'Est. Costs'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1 text-sm sm:text-base font-semibold tracking-tight tabular-nums break-words text-slate-800 dark:text-slate-200"
                        >
                          {formatKwd(sc.projectedCostsKwd, { locale: fmtLocale, showUnit: false })}
                        </div>
                        <div className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                          {kwd} • {isAr ? 'تقدير' : 'Est.'}
                        </div>
                      </div>
                    ) : null}

                    {snap.accountingAvailable ? (
                      <div className="rounded-2xl bg-emerald-50/80 p-2.5 sm:p-3 ring-1 ring-emerald-500/15 dark:bg-emerald-950/35 dark:ring-emerald-400/20">
                        <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          {isAr ? 'صافي الكاش المقدّر' : 'Est. Net Cash'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1 text-sm sm:text-base font-semibold tracking-tight tabular-nums break-words text-emerald-700 dark:text-emerald-300"
                        >
                          {formatKwd(sc.projectedNetCashKwd, {
                            locale: fmtLocale,
                            showUnit: false,
                            signed: true,
                          })}
                        </div>
                        <div
                          dir="ltr"
                          className="text-xs font-semibold tabular-nums text-emerald-800 dark:text-emerald-300"
                        >
                          {formatPct(sc.netMarginPct, { locale: fmtLocale, decimals: 1 })} •{' '}
                          {isAr ? 'تقدير' : 'Est.'}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Explicit Visible Mathematical Formulas */}
                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700 ring-1 ring-slate-200/80 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/10">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {isAr ? 'المعادلات الظاهرة لهذا السيناريو:' : 'Visible Scenario Formulas:'}
                    </div>
                    <div>• {isAr ? sc.salesFormulaAr : sc.salesFormulaEn}</div>
                    <div>• {isAr ? sc.costsFormulaAr : sc.costsFormulaEn}</div>
                    <div>• {isAr ? sc.netFormulaAr : sc.netFormulaEn}</div>
                  </div>

                  <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {(isAr ? sc.assumptionsAr : sc.assumptionsEn).map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <KpiProvenanceBadge
                  odooModel="pos.order + account.move.line"
                  dateRange={provenanceRange}
                  lastSyncAt={snap.lastSyncedAt}
                  isStale24h={snap.isStale24h}
                  kind="تقدير"
                  queryOrFormula={`${isAr ? sc.salesFormulaAr : sc.salesFormulaEn} | ${isAr ? sc.netFormulaAr : sc.netFormulaEn}`}
                  isAr={isAr}
                  compact
                />
              </article>
            )
          })}
        </div>
      </section>

      {/* ───────────── 4. Observed Odoo Reference Signals Strip ───────────── */}
      <section className={`grid grid-cols-1 gap-5 ${snap.signals.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {snap.signals.map((sig) => (
          <article key={sig.id} className={`${CARD_CLS} flex flex-col justify-between gap-3`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                  {isAr ? sig.titleAr : sig.titleEn}
                </h3>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr ? sig.detailAr : sig.detailEn}
              </p>
              <div className="rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:text-slate-300 dark:ring-white/10">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? 'المعادلة الظاهرة: ' : 'Formula: '}
                </span>
                {isAr ? sig.formulaAr : sig.formulaEn}
              </div>
            </div>
            <KpiProvenanceBadge
              odooModel="pos.order + account.move.line"
              dateRange={provenanceRange}
              lastSyncAt={snap.lastSyncedAt}
              isStale24h={snap.isStale24h}
              kind="فعلي"
              queryOrFormula={isAr ? sig.formulaAr : sig.formulaEn}
              isAr={isAr}
              compact
            />
          </article>
        ))}
      </section>

      {/* ───────────── 5. User-Defined Execution Roadmap (`Manual What-If Input`) ───────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
                {isAr
                  ? 'مراحل خارطة الطريق المخصصة'
                  : 'Custom Execution Roadmap Phases'}
              </h2>
              <span className={BADGE_MANUAL_CLS}>
                {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
              </span>
            </div>
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'أضف مراحل خطتك يدوياً لحساب أثرها التقديري ضمن السيناريوهات.'
                : 'Add custom phases manually to simulate their capex and monthly return impact.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className={PRIMARY_SOFT_BTN_CLS}
          >
            <Plus className="h-4 w-4" />
            <span>
              {formOpen
                ? isAr
                  ? 'إغلاق النموذج ✕'
                  : 'Close ✕'
                : isAr
                  ? '+ إضافة مرحلة محاكاة'
                  : '+ Add What-If Phase'}
            </span>
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleAddPhase} className={`${CARD_CLS} space-y-4`}>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'عنوان الخطة أو المرحلة' : 'Plan / Phase Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: إطلاق باقات عائلية في السالمية...'
                      : 'e.g. Launch family bundles in Salmiya...'
                  }
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'تاريخ البداية' : 'Start Date'}
                </label>
                <input
                  type="date"
                  required
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'تاريخ النهاية' : 'End Date'}
                </label>
                <input
                  type="date"
                  required
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'المسؤول عن التنفيذ' : 'Owner'}
                </label>
                <input
                  type="text"
                  required
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder={isAr ? 'إدارة التشغيل / العارضية' : 'Ops / Ardiya Kitchen'}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'سقف التكلفة (د.ك)' : 'Cost Cap (KWD)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={newCostCap}
                  onChange={(e) => setNewCostCap(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'المؤشر التشغيلي المستهدف' : 'Target KPI'}
                </label>
                <input
                  type="text"
                  required
                  value={newKpi}
                  onChange={(e) => setNewKpi(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: ضبط الهدر في مطبخ العارضية...'
                      : 'e.g. Reduce kitchen waste...'
                  }
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? 'العائد الشهري المتوقع (د.ك)' : 'Expected Monthly Gain (KWD)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={newMonthlyGain}
                    onChange={(e) => setNewMonthlyGain(e.target.value)}
                    className={`${INPUT_CLS} tabular-nums`}
                  />
                  <button type="submit" className={`${PRIMARY_SOFT_BTN_CLS} h-10 shrink-0`}>
                    <Plus className="h-4 w-4" />
                    <span>{isAr ? 'حفظ' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : null}

        {phases.length === 0 ? null : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {phases.map((phase) => {
              const activeCircularText = buildPlanCircularText(phase, activeScenario, isAr)
              const feryalPrompt = isAr
                ? `حللي المرحلة التقديرية (${phase.phaseCode}: ${phase.titleAr}) بسقف تكلفة تقديري ${formatKwd(phase.costCapKwd, 'ar')} وعائد تقديري ${formatKwd(phase.expectedMonthlyGainKwd, { locale: 'ar', signed: true })}/شهر.`
                : `Analyze estimated phase (${phase.phaseCode}: ${phase.titleEn}) with ${formatKwd(phase.costCapKwd, 'en')} cost cap and ${formatKwd(phase.expectedMonthlyGainKwd, { locale: 'en', signed: true })}/mo estimated return.`

              return (
                <article
                  key={phase.id}
                  className={`${CARD_CLS} flex flex-col justify-between gap-4`}
                >
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-0.5 font-mono text-[13px] font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200">
                          {phase.phaseCode}
                        </span>
                        <span
                          dir="ltr"
                          className="ae-bento-subcard rounded-full px-3 py-0.5 text-[12.5px] font-semibold tabular-nums text-slate-700 dark:text-slate-200"
                        >
                          {phase.startDate} → {phase.endDate}
                        </span>
                        <span className="ae-bento-subcard rounded-full px-3 py-0.5 text-[12.5px] font-medium text-slate-600 dark:text-slate-300">
                          {isAr ? phase.ownerAr : phase.ownerEn}
                        </span>
                        <span className={BADGE_MANUAL_CLS}>
                          {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="ae-bento-subcard px-3.5 py-1.5 text-end">
                          <div className="text-[12px] text-slate-600 dark:text-slate-300">
                            {isAr ? 'سقف التكلفة' : 'Cost Cap'}
                          </div>
                          <div
                            dir="ltr"
                            className="text-[14.5px] font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {formatKwd(phase.costCapKwd, fmtLocale)}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-emerald-50/80 px-3.5 py-1.5 text-end ring-1 ring-emerald-500/15 dark:bg-emerald-950/40 dark:ring-emerald-400/20">
                          <div className="text-[12px] text-emerald-800 dark:text-emerald-300">
                            {isAr ? 'العائد الشهري' : 'Monthly Gain'}
                          </div>
                          <div
                            dir="ltr"
                            className="text-[14.5px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                          >
                            {formatKwd(phase.expectedMonthlyGainKwd, {
                              locale: fmtLocale,
                              signed: true,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-[16px] font-semibold leading-snug text-slate-900 dark:text-white">
                      {isAr ? phase.titleAr : phase.titleEn}
                    </h3>

                    <div className={`${SUBCARD_CLS} space-y-1.5 text-[14px] leading-relaxed`}>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {isAr ? 'المؤشر المستهدف: ' : 'Target KPI: '}
                        </span>
                        {isAr ? phase.targetKpiAr : phase.targetKpiEn}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3.5 dark:border-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled
                        title={
                          isAr
                            ? 'معطّل حتى ربط سقوف الأدمن بتنبيهات Odoo الحقيقية'
                            : 'Disabled pending server-side Odoo threshold alerts'
                        }
                        className={PRIMARY_SOFT_BTN_CLS}
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                        <span>
                          {isAr ? 'طباعة تعميم (معطّل)' : 'Print Circular (Disabled)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled
                        title={
                          isAr
                            ? 'معطّل حتى ربط سقوف الأدمن بتنبيهات Odoo الحقيقية'
                            : 'Disabled pending server-side Odoo threshold alerts'
                        }
                        className={PRIMARY_SOFT_BTN_CLS}
                      >
                        <Megaphone className="h-4 w-4" aria-hidden />
                        <span>{isAr ? 'تعميم (معطّل)' : 'Broadcast (Disabled)'}</span>
                      </button>

                      <button
                        type="button"
                        disabled
                        title={
                          isAr
                            ? 'معطّل حتى توفر مخالفة فعلية من Odoo'
                            : 'Disabled until a real Odoo breach exists'
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-50 px-3 text-[12.5px] font-semibold text-rose-700 opacity-50 cursor-not-allowed dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <ShieldAlert className="h-4 w-4" aria-hidden />
                        <span>{isAr ? 'إيقاف (معطّل)' : 'Freeze (Disabled)'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`circ-${phase.id}`, activeCircularText)}
                        className="ae-pill-light h-9 px-3 text-[12.5px] inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                      >
                        {copiedKey === `circ-${phase.id}` ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                            <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            <span>{isAr ? 'نسخ المسودة' : 'Copy Draft'}</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(activeCircularText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ae-pill-light h-9 px-3 text-[12.5px] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                      </a>

                      <Link
                        href={`/erp/feryal-ai?prompt=${encodeURIComponent(feryalPrompt)}`}
                        className="ae-pill-light h-9 px-3 text-[12.5px] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        <span>{isAr ? 'فريال' : 'Feryal'}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDeletePhase(phase.id)}
                        aria-label={isAr ? `حذف المرحلة: ${phase.titleAr}` : `Delete phase: ${phase.titleEn}`}
                        className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span>{isAr ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
