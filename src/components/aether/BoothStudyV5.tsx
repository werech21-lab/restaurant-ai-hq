'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react'
import {
  analyzeEventContractWithGemini,
  type ContractDeepAuditResult,
} from '@/lib/feryal-gemini-brain'
import { GLOBAL_BRAND_OPTIONS } from '@/lib/aether/global-filter-engine'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  InteractiveDonutChart,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { useLang } from '@/components/aether/ui'
import { StateBlock } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import {
  buildBoothAdvisorFallback,
  extractBrandOdooActual,
  extractOdooVerifiedPlanningActuals,
  LABEL_DETERMINISTIC_SIM,
  LABEL_MANUAL_WHAT_IF,
  LABEL_ODOO_ACTUAL,
  type PlanningAdvisorRecommendation,
  type PlanningAdvisorResponsePayload,
} from '@/lib/aether/strategic-planning-engine'

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { id: K; label: string }[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
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
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              active
                ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

type BoothPreset = 'month30' | 'weekend4' | 'season90' | 'custom'

const card =
  'ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const input =
  'ae-bento-subcard w-full rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-slate-900 transition duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-white'

const BADGE_ACTUAL_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-400/25'
const BADGE_MANUAL_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-500/25 dark:bg-indigo-950/70 dark:text-indigo-200 dark:ring-indigo-400/25'
const BADGE_SIM_CLS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-500/25 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-400/25'

const BOOTH_BRAND_OPTIONS = GLOBAL_BRAND_OPTIONS.filter((b) => b.id !== 'all')

const toBase64 = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : ''
      resolve(res.includes(',') ? res.split(',')[1] : '')
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })

const addDaysIso = (startIso: string, dayOffset: number): string => {
  const parts = startIso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return startIso
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Math.max(0, dayOffset)))
  return dt.toISOString().slice(0, 10)
}

const diffInclusiveDays = (startIso: string, endIso: string): number => {
  const s = startIso.split('-').map(Number)
  const e = endIso.split('-').map(Number)
  if (s.length !== 3 || e.length !== 3 || s.some(Number.isNaN) || e.some(Number.isNaN)) return 30
  const t1 = Date.UTC(s[0], s[1] - 1, s[2])
  const t2 = Date.UTC(e[0], e[1] - 1, e[2])
  return Math.max(1, Math.round((t2 - t1) / 86400000) + 1)
}

/**
 * Booth Feasibility & Exhibition What-If Studio (`/erp/booth-feasibility` & `/erp/events-intelligence`).
 * Strictly separates `Odoo Verified Actual` reference telemetry from `Manual What-If Input` controls
 * and `Deterministic Simulation` outputs, with AI strategic advisor recommendations.
 */
export function BoothStudyV5() {
  const { isAr, T } = useLang()
  const locale = isAr ? 'ar' : 'en'
  const unavailableTip = getUnavailableTooltip(locale)
  const { liveSummary, workspace, isAuditor } = useGlobalFilter()

  const [preset, setPreset] = useState<BoothPreset>('month30')
  const [eventName, setEventName] = useState('')
  const [startDate, setStartDate] = useState('2026-11-20')
  const [endDate, setEndDate] = useState('2026-12-19')
  const [days, setDays] = useState(30)
  const [rent, setRent] = useState(3000)
  const [setup, setSetup] = useState(800)
  const [staffCount, setStaffCount] = useState(0)
  const [staff, setStaff] = useState(0)
  const [avgTicketKwd, setAvgTicketKwd] = useState<number>(3.5)
  const [foodCostPct, setFoodCostPct] = useState<number>(28)
  const [dailyOrders, setDailyOrders] = useState<number>(80)
  const [brandId, setBrandId] = useState<string>('china-garden')
  const [contract, setContract] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [contractReview, setContractReview] = useState<ContractDeepAuditResult | null>(null)
  const [contractError, setContractError] = useState(false)
  const [busy, setBusy] = useState(false)

  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [advisorRecs, setAdvisorRecs] = useState<PlanningAdvisorRecommendation[] | null>(null)
  const [advisorModelLabel, setAdvisorModelLabel] = useState<string | null>(null)
  const [advisorUpdatedAt, setAdvisorUpdatedAt] = useState<string | null>(null)

  const applyPreset = (next: BoothPreset) => {
    setPreset(next)
    if (next === 'month30') {
      setDays(30)
      setEndDate(addDaysIso(startDate, 29))
      setRent(3000)
      setSetup(800)
    } else if (next === 'weekend4') {
      setDays(4)
      setEndDate(addDaysIso(startDate, 3))
      setRent(650)
      setSetup(350)
    } else if (next === 'season90') {
      setDays(90)
      setEndDate(addDaysIso(startDate, 89))
      setRent(7500)
      setSetup(1500)
    }
  }

  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return
    setPreset('custom')
    setStartDate(nextStart)
    if (nextStart > endDate) {
      const nextEnd = addDaysIso(nextStart, Math.max(0, days - 1))
      setEndDate(nextEnd)
    } else {
      setDays(diffInclusiveDays(nextStart, endDate))
    }
  }

  const handleEndDateChange = (nextEnd: string) => {
    if (!nextEnd) return
    setPreset('custom')
    if (nextEnd < startDate) {
      setEndDate(startDate)
      setDays(1)
    } else {
      setEndDate(nextEnd)
      setDays(diffInclusiveDays(startDate, nextEnd))
    }
  }

  const kwd = useCallback((n: number | null | undefined) => formatKwd(n, locale), [locale])
  const intFmt = useCallback((n: number | null | undefined) => formatInt(n, locale), [locale])
  const pctFmt = useCallback(
    (n: number | null | undefined, signed = false) =>
      formatPct(n, { locale, decimals: 1, signed }),
    [locale],
  )
  const brandOpt = BOOTH_BRAND_OPTIONS.find((b) => b.id === brandId) ?? BOOTH_BRAND_OPTIONS[0]
  const basket = Math.max(0.25, avgTicketKwd)

  const actuals = useMemo(
    () => extractOdooVerifiedPlanningActuals(liveSummary, workspace),
    [liveSummary, workspace],
  )

  const brandActual = useMemo(
    () => extractBrandOdooActual(liveSummary, brandId),
    [brandId, liveSummary],
  )

  const model = useMemo(() => {
    const variablePct = Math.min(0.92, Math.max(0.05, foodCostPct / 100))
    const gpPerOrder = basket * (1 - variablePct)
    const fixed = rent + setup + staff
    const breakEven = days > 0 && gpPerOrder > 0 ? fixed / days / gpPerOrder : Infinity
    const scenarios = [
      { id: 'low', en: 'Conservative (60%)', ar: 'سيناريو تحفظي (60%)', factor: 0.6 },
      { id: 'base', en: 'Base (100%)', ar: 'سيناريو أساسي (100%)', factor: 1 },
      { id: 'high', en: 'Upside (130%)', ar: 'سيناريو متفائل (130%)', factor: 1.3 },
    ].map((s) => {
      const orders = dailyOrders * s.factor * days
      const revenue = orders * basket
      const gp = orders * gpPerOrder
      const profit = gp - fixed
      return { ...s, orders, revenue, gp, profit, roi: fixed > 0 ? (profit / fixed) * 100 : 0 }
    })
    const low = scenarios[0]
    const base = scenarios[1]
    const verdict: 'go' | 'conditional' | 'walk' =
      base.profit <= 0 ? 'walk' : low.profit >= 0 ? 'go' : 'conditional'
    const rentCeiling = Math.max(0, low.gp - setup - staff)
    const rentShare = base.revenue > 0 ? (rent / base.revenue) * 100 : 0
    return { gpPerOrder, fixed, breakEven, scenarios, verdict, rentCeiling, rentShare }
  }, [basket, dailyOrders, days, foodCostPct, rent, setup, staff])

  const base = model.scenarios[1]
  const low = model.scenarios[0]
  const high = model.scenarios[2]
  const be = Number.isFinite(model.breakEven) && model.breakEven > 0 ? model.breakEven : null
  const beCoveragePct = be ? Math.min(100, Math.round((dailyOrders / be) * 100)) : 100
  const totalBoothBudgetKwd = Math.max(0, model.fixed + base.revenue * (foodCostPct / 100))
  const dailyCostCapKwd = Math.max(0, totalBoothBudgetKwd / Math.max(1, days))

  const boothInputsPayload = useMemo(
    () => ({
      brandId,
      brandLabelEn: brandOpt.en,
      brandLabelAr: brandOpt.ar,
      days,
      rentKwd: rent,
      setupKwd: setup,
      staffCount,
      staffCostKwd: staff,
      avgTicketKwd: basket,
      foodCostPct,
      expectedDailyOrders: dailyOrders,
    }),
    [basket, brandId, brandOpt.ar, brandOpt.en, dailyOrders, days, foodCostPct, rent, setup, staff, staffCount],
  )

  const defaultAdvisorRecs = useMemo(
    () =>
      buildBoothAdvisorFallback({
        actuals,
        brandActual,
        boothInputs: boothInputsPayload,
        sim: {
          fixedCostKwd: model.fixed,
          gpPerOrderKwd: model.gpPerOrder,
          breakEvenDailyOrders: be !== null ? Math.round(be) : null,
          baseRevenueKwd: base.revenue,
          baseProfitKwd: base.profit,
          conservativeProfitKwd: low.profit,
          upsideProfitKwd: high.profit,
          rentCeilingKwd: model.rentCeiling,
          rentSharePct: model.rentShare,
          verdict: model.verdict,
        },
      }),
    [actuals, base.profit, base.revenue, be, boothInputsPayload, brandActual, high.profit, low.profit, model],
  )

  const runBoothAdvisor = useCallback(async () => {
    if (isAuditor) return
    setAdvisorLoading(true)
    try {
      const res = await fetch('/api/erp/planning-advisor', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'booth-feasibility',
          boothInputs: boothInputsPayload,
        }),
      })
      if (res.ok) {
        const payload = (await res.json()) as PlanningAdvisorResponsePayload
        if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
          setAdvisorRecs(payload.recommendations)
          setAdvisorModelLabel(isAr ? payload.modelLabelAr : payload.modelLabelEn)
          setAdvisorUpdatedAt(
            formatDateTime(new Date(payload.updatedAtIso), { locale, showZone: true }),
          )
        }
      }
    } catch {
      // Deterministic recommendations remain displayed seamlessly.
    } finally {
      setAdvisorLoading(false)
    }
  }, [boothInputsPayload, isAr, isAuditor, locale])

  useEffect(() => {
    if (!actuals.available || isAuditor) return
    const timer = window.setTimeout(() => {
      void runBoothAdvisor()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [
    actuals.available,
    brandId,
    days,
    rent,
    setup,
    staff,
    basket,
    foodCostPct,
    dailyOrders,
    isAuditor,
    runBoothAdvisor,
  ])

  const handleCheckContract = async () => {
    setBusy(true)
    setContractError(false)
    try {
      const attachmentBase64 = file ? await toBase64(file) : undefined
      const res = await analyzeEventContractWithGemini({
        contractText: contract,
        eventDescription: description,
        executiveVision: `${brandOpt.en} ${brandOpt.ar}`,
        eventName: eventName || T('Booth Simulator', 'محاكي معرض موسمي'),
        durationDays: days,
        boothRentKwd: rent,
        attachmentBase64: attachmentBase64 || undefined,
        attachmentMimeType: file?.type || undefined,
        lang: isAr ? 'ar' : 'en',
      })
      setContractReview(res)
    } catch {
      setContractError(true)
    } finally {
      setBusy(false)
    }
  }

  const verdictUi = {
    go: {
      icon: <CheckCircle2 className="h-6 w-6" />,
      en: 'Simulation Verdict: Profitable',
      ar: 'نتيجة المحاكاة: مربح افتراضياً',
      cls: 'bg-emerald-50 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-100',
    },
    conditional: {
      icon: <Scale className="h-6 w-6" />,
      en: 'Simulation Verdict: Negotiate Rent',
      ar: 'نتيجة المحاكاة: فاوض الإيجار',
      cls: 'bg-sky-50 text-sky-950 ring-sky-500/25 dark:bg-sky-950/40 dark:text-sky-100',
    },
    walk: {
      icon: <XCircle className="h-6 w-6" />,
      en: 'Simulation Verdict: Loss',
      ar: 'نتيجة المحاكاة: خاسر افتراضياً',
      cls: 'bg-rose-50 text-rose-900 ring-rose-500/25 dark:bg-rose-950/40 dark:text-rose-100',
    },
  }[model.verdict]

  const scenarioChartData: MultiSeriesBarDatum[] = useMemo(
    () =>
      model.scenarios.map((s) => ({
        id: s.id,
        label: isAr ? s.ar : s.en,
        tooltipTitle: isAr ? s.ar : s.en,
        primaryValue: Math.max(0, s.revenue),
        secondaryValue: Math.max(0, s.profit),
        badgeText: pctFmt(s.roi, true),
        badgeTone: s.profit > 0 ? 'emerald' : s.profit === 0 ? 'amber' : 'rose',
        lines: [
          { label: T('Simulated Orders', 'الطلبات المحاكاة'), value: intFmt(s.orders), tone: 'neutral' },
          { label: T('Simulated Sales', 'المبيعات المحاكاة'), value: kwd(s.revenue), tone: 'neutral', bold: true },
          { label: T('Fixed Cost Input', 'التكاليف الثابتة المدخلة'), value: kwd(model.fixed), tone: 'slate' },
          {
            label: T('Simulated Net', 'الصافي المحاكى'),
            value: formatKwd(s.profit, { locale, signed: true }),
            tone: s.profit >= 0 ? 'emerald' : 'rose',
            bold: true,
          },
        ],
      })),
    [intFmt, isAr, kwd, locale, model.fixed, model.scenarios, pctFmt, T],
  )

  const boothDonutSlices: DonutSliceDatum[] = useMemo(() => {
    const revBase = Math.max(1, base.revenue)
    const varCost = Math.max(0, base.revenue - base.gp)
    const rentVal = Math.max(0, rent)
    const setupStaffVal = Math.max(0, setup + staff)
    const netVal = Math.max(0, base.profit)
    const pct = (v: number) => pctFmt((v / revBase) * 100)

    return [
      {
        id: 'net',
        label: T('Simulated Net', 'الصافي المحاكى'),
        value: netVal,
        valueFormatted: kwd(netVal),
        pctFormatted: pct(netVal),
        color: '#10B981',
      },
      {
        id: 'var',
        label: T('Food Cost Input', 'تكلفة المواد المدخلة'),
        value: varCost,
        valueFormatted: kwd(varCost),
        pctFormatted: pct(varCost),
        color: '#0EA5E9',
      },
      {
        id: 'rent',
        label: T('Booth Rent Input', 'إيجار البوث المدخل'),
        value: rentVal,
        valueFormatted: kwd(rentVal),
        pctFormatted: pct(rentVal),
        color: '#6366F1',
      },
      {
        id: 'setup',
        label: T('Setup & Staff Input', 'التجهيز والطاقم المدخل'),
        value: setupStaffVal,
        valueFormatted: kwd(setupStaffVal),
        pctFormatted: pct(setupStaffVal),
        color: '#64748B',
      },
    ]
  }, [base.gp, base.profit, base.revenue, kwd, pctFmt, rent, setup, staff, T])

  const pros = [
    be !== null &&
      be <= dailyOrders * 0.6 &&
      T(
        `Covers entered fixed costs at ${intFmt(be)} orders/day.`,
        `يغطي التكاليف المدخلة عند ${intFmt(be)} طلب باليوم.`,
      ),
    model.rentShare > 0 &&
      model.rentShare <= 20 &&
      T(
        `Entered rent represents ${pctFmt(model.rentShare)} of simulated sales.`,
        `الإيجار المدخل يمثل ${pctFmt(model.rentShare)} من المبيعات المحاكاة.`,
      ),
    base.profit > 0 &&
      T(
        `Simulated base net result is ${kwd(base.profit)}.`,
        `الصافي المحاكى للحالة الأساسية ${kwd(base.profit)}.`,
      ),
  ].filter(Boolean) as string[]

  const risks = [
    be !== null &&
      be > dailyOrders &&
      T(
        `Needs ${intFmt(be)} orders/day vs ${intFmt(dailyOrders)} entered.`,
        `يحتاج ${intFmt(be)} طلب يومياً لتغطية التكلفة مقابل ${intFmt(dailyOrders)} مدخلة.`,
      ),
    low.profit < 0 &&
      T(
        `At 60% traffic, simulated loss is ${kwd(-low.profit)}.`,
        `عند إقبال 60% تكون الخسارة المحاكاة ${kwd(-low.profit)}.`,
      ),
    model.rentShare > 25 &&
      T(
        `Rent consumes ${pctFmt(model.rentShare)} of simulated sales.`,
        `الإيجار يستهلك ${pctFmt(model.rentShare)} من المبيعات المحاكاة.`,
      ),
  ].filter(Boolean) as string[]

  const displayedAdvisorRecs = advisorRecs ?? defaultAdvisorRecs
  const infoText = T(
    'Hypothetical Tool — Not Actual Data: simulator outputs are calculated deterministically from your Manual What-If Inputs alongside read-only Odoo Verified Actual benchmarks.',
    'أداة افتراضية — ليست بيانات: مخرجات الحاسبة تُحسب بمعادلات حتمية من مدخلات المحاكاة اليدوية جنباً إلى جنب مع المرجعيات الفعلية الموثّقة من أودو.',
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] min-w-0 mx-auto space-y-5 pb-10">
      {/* Slim Executive Preset, Provenance Legend & Compact (i) Info Bar */}
      <div className={`${card} !p-3.5 sm:!p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <EmeraldPillTabs<BoothPreset>
          value={preset}
          onChange={applyPreset}
          size="sm"
          ariaLabel={T('Booth Duration Preset', 'قوالب مدة المحاكاة')}
          options={[
            { id: 'month30', label: T('30-Day Template', 'قالب 30 يوم') },
            { id: 'weekend4', label: T('4-Day Template', 'قالب 4 أيام') },
            { id: 'season90', label: T('90-Day Template', 'قالب 90 يوم') },
            { id: 'custom', label: T('Custom Inputs', 'مخصص') },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15">
            <span>{isAr ? 'أداة افتراضية — ليست بيانات' : 'Hypothetical Tool — Not Actual Data'}</span>
          </span>
          <CompactInfoTooltip
            isAr={isAr}
            text={infoText}
            label={T('Simulator methodology boundary', 'توضيح حدود أداة المحاكاة')}
          />
          {!isAuditor ? (
            <button
              type="button"
              data-run-booth-advisor="true"
              onClick={() => void runBoothAdvisor()}
              disabled={advisorLoading}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            >
              {advisorLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>
                {advisorLoading
                  ? T('Analyzing…', 'جارٍ التحليل...')
                  : T('Run AI Booth Advisor ✨', 'استشارة الذكاء للمعرض ✨')}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Odoo Verified Actuals Reference Strip (When Connected) */}
      {actuals.available ? (
        <section data-booth-odoo-actuals="true" className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                {T('Odoo 17 Reference Benchmarks (For Calibration)', 'مرجعيات أودو 17 الفعلية (للمعايرة قبل التعاقد)')}
              </h2>
              <span data-badge-kind="odoo-verified-actual" className={BADGE_ACTUAL_CLS}>
                {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
              {`pos.order · ${actuals.periodFrom} → ${actuals.periodTo}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {T('30d Company Daily Run-Rate', 'المعدل اليومي للشركة (30 يوم)')}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div dir="ltr" className="mt-1.5 text-lg sm:text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {kwd(actuals.month30dDailyRunRateKwd)}/{isAr ? 'يوم' : 'd'}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {T(
                  `30d Net Sales: ${kwd(actuals.month30dNetSalesKwd)}`,
                  `صافي 30 يوم: ${kwd(actuals.month30dNetSalesKwd)}`,
                )}
              </p>
            </div>

            <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {T('Observed POS AOV', 'متوسط قيمة الطلب الفعلي')}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span dir="ltr" className="text-lg sm:text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {actuals.month30dAovKwd !== null ? kwd(actuals.month30dAovKwd) : UNAVAILABLE_DASH}
                </span>
                {actuals.month30dAovKwd !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPreset('custom')
                      setAvgTicketKwd(actuals.month30dAovKwd!)
                    }}
                    className="shrink-0 cursor-pointer text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300"
                  >
                    {T('Apply AOV', 'تطبيق بالمحاكي')}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {T(
                  `${intFmt(actuals.month30dOrders)} posted 30d orders`,
                  `عبر ${intFmt(actuals.month30dOrders)} طلب فعلي`,
                )}
              </p>
            </div>

            <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? `مبيعات ${brandOpt.ar} (30 يوم)` : `${brandOpt.en} 30d Actual`}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div dir="ltr" className="mt-1.5 text-lg sm:text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {brandActual.available ? kwd(brandActual.netKwd) : kwd(actuals.month30dNetSalesKwd)}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {brandActual.available && brandActual.orders !== null
                  ? T(
                      `${intFmt(brandActual.orders)} orders · AOV ${kwd(brandActual.aovKwd)}`,
                      `${intFmt(brandActual.orders)} طلب · متوسط ${kwd(brandActual.aovKwd)}`,
                    )
                  : T('Selected brand POS baseline', 'مرجع العلامة المختارة في أودو')}
              </p>
            </div>

            <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
              <div className="flex items-center justify-between gap-1.5">
                <span className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {actuals.exhibitionsActuals.available
                    ? T('Exhibitions EXB Actuals', 'فعليات بوثات المعارض المتنقلة')
                    : T('Branch Median Benchmark', 'وسيط الفرع النشط يومياً')}
                </span>
                <span className={BADGE_ACTUAL_CLS}>
                  {isAr ? LABEL_ODOO_ACTUAL.ar : LABEL_ODOO_ACTUAL.en}
                </span>
              </div>
              <div dir="ltr" className="mt-1.5 text-lg sm:text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {actuals.exhibitionsActuals.available
                  ? kwd(actuals.exhibitionsActuals.netKwd)
                  : actuals.branchDailyMedianKwd !== null
                    ? `${kwd(actuals.branchDailyMedianKwd)}/${isAr ? 'يوم' : 'd'}`
                    : kwd(actuals.month30dDailyRunRateKwd)}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {actuals.exhibitionsActuals.available
                  ? T(
                      `${intFmt(actuals.exhibitionsActuals.orders)} exhibition POS orders`,
                      `${intFmt(actuals.exhibitionsActuals.orders)} طلب مسجل في نقاط بيع المعارض`,
                    )
                  : actuals.branchDailyMedianOrders !== null
                    ? T(
                        `Peer median: ${intFmt(actuals.branchDailyMedianOrders)} orders/d`,
                        `وسيط الطلبات: ${intFmt(actuals.branchDailyMedianOrders)} طلب/يوم`,
                      )
                    : T('Odoo active POS benchmark', 'مرجع نقاط البيع النشطة')}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* 4 Top Deterministic Simulation Summary Cards */}
      <section data-booth-simulation-output="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="min-w-0 truncate">{T('Simulator Verdict', 'نتيجة المحاكاة')}</span>
            <span data-badge-kind="deterministic-simulation" className={BADGE_SIM_CLS}>
              {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2 text-base sm:text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {isAr ? verdictUi.ar : verdictUi.en}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {isAr ? `${brandOpt.ar} • ${intFmt(days)} يوم` : `${brandOpt.en} • ${intFmt(days)}d window`}
          </p>
        </div>

        <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="min-w-0 truncate">{T('Simulated Net (100%)', 'الصافي المحاكى (100%)')}</span>
            <span className={BADGE_SIM_CLS}>
              {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
            </span>
          </div>
          <div
            dir="ltr"
            className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums ${
              base.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatKwd(base.profit, { locale, signed: true })}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {T(`Simulated sales ${kwd(base.revenue)}`, `من مبيعات محاكاة ${kwd(base.revenue)}`)}
          </p>
        </div>

        <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="min-w-0 truncate">{T('Break-Even Orders', 'نقطة التعادل اليومية')}</span>
            <span className={BADGE_SIM_CLS}>
              {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
            </span>
          </div>
          <div
            dir="ltr"
            title={be === null ? unavailableTip : undefined}
            className="mt-1.5 sm:mt-2 text-lg sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
          >
            {be !== null ? `${intFmt(be)} ${T('orders/d', 'طلب/يوم')}` : UNAVAILABLE_DASH}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {T(
              `Gross margin/order ${kwd(model.gpPerOrder)}`,
              `هامش الطلب المحاكى ${kwd(model.gpPerOrder)}`,
            )}
          </p>
        </div>

        <div className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
          <div className="flex items-center justify-between gap-1.5 text-xs sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="min-w-0 truncate">{T('Max Break-Even Rent (60%)', 'سقف الإيجار الآمن (60%)')}</span>
            <span className={BADGE_SIM_CLS}>
              {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
            </span>
          </div>
          <div
            dir="ltr"
            className="mt-1.5 sm:mt-2 text-lg sm:text-2xl xl:text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
          >
            {kwd(model.rentCeiling)}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {rent > model.rentCeiling
              ? T(`Reduce rent by ${kwd(rent - model.rentCeiling)}`, `أعلى من السقف بـ ${kwd(rent - model.rentCeiling)}`)
              : T('Within 60% traffic break-even', 'ضمن تعادل سيناريو 60%')}
          </p>
        </div>
      </section>

      {/* AI Booth & Exhibition Strategic Advisor (`POST /api/erp/planning-advisor`) */}
      {displayedAdvisorRecs.length > 0 ? (
        <section data-booth-ai-advisor="true" className={`${card} ae-glow-emerald space-y-3.5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <h2 className="text-[15.5px] font-semibold text-slate-950 dark:text-white">
                {T(
                  'AI Booth & Exhibition Strategic Recommendations',
                  'التوصيات الاستراتيجية الذكية لجدوى المعرض والتفاوض',
                )}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-200">
                {advisorModelLabel ??
                  T(
                    'CFO Deterministic Advisor • Odoo 17 Grounded',
                    'مستشار مالي رقمي حتمي • موثّق من أودو 17',
                  )}
              </span>
              {advisorUpdatedAt ? (
                <span dir="ltr" className="tabular-nums">
                  {advisorUpdatedAt}
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-3.5 ${
              displayedAdvisorRecs.length === 1
                ? 'lg:grid-cols-1'
                : displayedAdvisorRecs.length === 2
                  ? 'lg:grid-cols-2'
                  : 'lg:grid-cols-3'
            }`}
          >
            {displayedAdvisorRecs.map((rec) => (
              <article
                key={rec.id}
                className="ae-bento-subcard flex min-w-0 flex-col justify-between gap-2 rounded-2xl p-3.5"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-slate-900 dark:text-white">
                      {isAr ? rec.titleAr : rec.titleEn}
                    </h3>
                    <span dir="ltr" className={BADGE_SIM_CLS}>
                      {isAr ? rec.badgeAr : rec.badgeEn}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                    {isAr ? rec.bodyAr : rec.bodyEn}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Scenarios Bar Chart + Allocation Donut */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${card} min-w-0 space-y-4 xl:col-span-8`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  {T('Traffic Sensitivity Scenarios', 'مقارنة حساسية الإقبال')}
                </h2>
                <span className={BADGE_SIM_CLS}>
                  {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {T(
                  `${startDate} -> ${endDate} · Formula-based scenario curve`,
                  `${startDate} ← ${endDate} · منحنى الحساسية الرقمي`,
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold tabular-nums">
              <span
                dir="ltr"
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 ${
                  low.profit >= 0
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
                }`}
              >
                60%: {formatKwd(low.profit, { locale, signed: true })}
              </span>
              <span
                dir="ltr"
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 ${
                  base.profit >= 0
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                }`}
              >
                100%: {formatKwd(base.profit, { locale, signed: true })}
              </span>
              <span
                dir="ltr"
                className="shrink-0 whitespace-nowrap rounded-lg bg-sky-50 px-2.5 py-1 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
              >
                130%: {formatKwd(high.profit, { locale, signed: true })}
              </span>
            </div>
          </div>

          <InteractiveHoverBarChart
            data={scenarioChartData}
            isAr={isAr}
            primaryLegend={T('Simulated Sales', 'المبيعات المحاكاة')}
            secondaryLegend={T('Simulated Net', 'الصافي المحاكى')}
            primaryColor="#334155"
            secondaryColor="#10B981"
            heightClass="h-56"
          />

          <div className="ae-bento-subcard space-y-2 rounded-2xl p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {T(
                  `Simulator Breakeven: ${intFmt(dailyOrders)} entered vs ${be !== null ? intFmt(be) : UNAVAILABLE_DASH} break-even orders/day`,
                  `تعادل المحاكاة: ${intFmt(dailyOrders)} طلب مدخل مقابل ${be !== null ? intFmt(be) : UNAVAILABLE_DASH} طلب تعادل/يوم`,
                )}
              </span>
              <span dir="ltr" className="font-extrabold tabular-nums text-slate-800 dark:text-slate-200">
                {T(
                  `Simulated Daily Cost: ${kwd(dailyCostCapKwd)}/day`,
                  `متوسط التكلفة المحاكاة: ${kwd(dailyCostCapKwd)}/يوم`,
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div
                style={{ width: `${Math.max(6, beCoveragePct)}%` }}
                className={`h-full rounded-full transition-all duration-150 ${
                  be !== null && dailyOrders >= be ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </div>
          </div>
        </div>

        <div className={`${card} min-w-0 flex flex-col justify-between xl:col-span-4`}>
          <div className="mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                {T('Simulated Revenue Split', 'توزيع المبيعات المحاكاة')}
              </h2>
              <span className={BADGE_SIM_CLS}>
                {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {T('Computed from manual what-if inputs', 'محسوب من مدخلات المحاكاة اليدوية')}
            </p>
          </div>
          <InteractiveDonutChart
            slices={boothDonutSlices}
            centerValue={pctFmt(model.rentShare)}
            centerLabel={T('Rent Share', 'نسبة الإيجار')}
            summaryRows={[
              {
                label: T('Fixed Cost Input', 'التكاليف الثابتة المدخلة'),
                value: kwd(rent + setup + staff),
                tone: 'neutral',
              },
              {
                label: T('Simulated Net', 'الصافي المحاكى'),
                value: formatKwd(base.profit, { locale, signed: true }),
                tone: base.profit >= 0 ? 'emerald' : 'rose',
              },
            ]}
            isAr={isAr}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* Left: User Manual What-If Simulator Inputs */}
        <section
          data-booth-manual-inputs="true"
          className={`${card} min-w-0 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:sticky xl:top-24 xl:col-span-5`}
        >
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
                {T('Manual Simulator Parameters', 'معاملات المحاكاة اليدوية')}
              </h3>
            </div>
            <span data-badge-kind="manual-what-if-input" className={BADGE_MANUAL_CLS}>
              {isAr ? LABEL_MANUAL_WHAT_IF.ar : LABEL_MANUAL_WHAT_IF.en}
            </span>
          </div>

          <label className="space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Event Name', 'اسم المعرض')}
            </span>
            <input
              className={input}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={T('e.g. Winter Booth', 'مثال: معرض شتوي')}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Brand', 'العلامة التجارية')}
            </span>
            <select className={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {BOOTH_BRAND_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.ar : b.en}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {T('Start Date', 'تاريخ البداية')}
            </span>
            <input
              type="date"
              dir="ltr"
              className={`${input} tabular-nums`}
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </label>

          <label className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {T('End Date', 'تاريخ النهاية')}
            </span>
            <input
              type="date"
              dir="ltr"
              className={`${input} tabular-nums`}
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3.5 sm:col-span-2">
            {[
              {
                v: days,
                set: (n: number) => {
                  const safeDays = Math.max(1, Math.round(n))
                  setDays(safeDays)
                  setEndDate(addDaysIso(startDate, safeDays - 1))
                },
                en: 'Event Days',
                ar: 'عدد أيام المعرض',
              },
              {
                v: avgTicketKwd,
                set: (n: number) => setAvgTicketKwd(Math.max(0.25, n)),
                en: 'Avg Ticket (KWD)',
                ar: 'متوسط الفاتورة (د.ك)',
              },
              { v: rent, set: setRent, en: 'Booth Rent (KWD)', ar: 'إيجار البوث (د.ك)' },
              { v: setup, set: setSetup, en: 'Setup Cost (KWD)', ar: 'تكلفة التجهيز (د.ك)' },
              {
                v: staffCount,
                set: (n: number) => {
                  const cnt = Math.max(0, Math.round(n))
                  setStaffCount(cnt)
                  setStaff(cnt * 15 * days)
                },
                en: 'Staff Count',
                ar: 'عدد أفراد الطاقم',
              },
              { v: staff, set: setStaff, en: 'Staff Cost (KWD)', ar: 'إجمالي أجور الطاقم (د.ك)' },
              {
                v: foodCostPct,
                set: (n: number) => setFoodCostPct(Math.min(85, Math.max(5, n))),
                en: 'Food Cost %',
                ar: 'تكلفة المواد %',
              },
              {
                v: dailyOrders,
                set: setDailyOrders,
                en: 'Expected Daily Orders',
                ar: 'الطلبات اليومية المتوقعة',
              },
            ].map((f) => (
              <label key={f.en} className="min-w-0 space-y-1.5">
                <span className="block truncate text-[12.5px] font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? f.ar : f.en}
                </span>
                <input
                  className={input}
                  inputMode="decimal"
                  value={f.v}
                  onChange={(e) => {
                    setPreset('custom')
                    f.set(Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0))
                  }}
                />
              </label>
            ))}
          </div>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Contract Text', 'بنود العقد (اختياري)')}
            </span>
            <textarea
              className={`${input} min-h-[96px]`}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              placeholder={T(
                'Paste contract terms (optional)…',
                'الصق شروط العقد هنا لمراجعتها (اختياري)…',
              )}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Extra Notes', 'ملاحظات إضافية')}
            </span>
            <textarea
              className={`${input} min-h-[76px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="flex flex-col justify-end gap-2.5">
            <label className="ae-bento-subcard inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/60 hover:opacity-90 dark:text-slate-200">
              <FileUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span className="truncate">
                {file ? file.name : T('Attach Contract', 'إرفاق العقد')}
              </span>
              <input
                type="file"
                accept="application/pdf,image/*"
                aria-label={T('Attach Contract', 'إرفاق العقد')}
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={handleCheckContract}
              disabled={busy}
              className="btn-colored inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {T('Review Contract Terms', 'مراجعة شروط العقد')}
            </button>
          </div>
        </section>

        {/* Right: Simulator Output Breakdown */}
        <div className="min-w-0 space-y-5 xl:col-span-7">
          {busy ? (
            <StateBlock
              state="loading"
              compact
              locale={locale}
              title={T('Reviewing contract clauses…', 'جارٍ مراجعة شروط العقد…')}
            />
          ) : null}
          {contractError ? (
            <StateBlock
              state="error"
              compact
              locale={locale}
              title={T('Unable to review contract right now', 'تعذّر إتمام مراجعة العقد حالياً')}
              description={T(
                'Please check the uploaded file or text and try again.',
                'يرجى التحقق من النص أو الملف المرفق ثم المحاولة مجدداً.',
              )}
              onRetry={() => void handleCheckContract()}
            />
          ) : null}

          {/* 1. Simulator Verdict */}
          <section className={`rounded-2xl p-6 ring-1 ${verdictUi.cls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-bold opacity-85">
                {T('Simulator Output', 'مخرجات المحاكاة الرقمية')}
              </span>
              <span className={BADGE_SIM_CLS}>
                {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              {verdictUi.icon}
              <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight">
                {isAr ? verdictUi.ar : verdictUi.en}
              </h2>
            </div>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">
              {T(
                `Simulated ${base.profit >= 0 ? 'net' : 'loss'}: ${kwd(Math.abs(base.profit))} · Break-even: ${be !== null ? intFmt(be) : UNAVAILABLE_DASH} orders/day.`,
                `${base.profit >= 0 ? 'الصافي المحاكى' : 'الخسارة المحاكاة'}: ${kwd(Math.abs(base.profit))} · نقطة التعادل: ${be !== null ? intFmt(be) : UNAVAILABLE_DASH} طلب/يوم.`,
              )}
            </p>
            {contractReview ? (
              <p className="mt-2 text-[13.5px] font-bold">
                {isAr ? contractReview.verdictBadgeAr : contractReview.verdictBadgeEn}
              </p>
            ) : null}
          </section>

          {/* 1B. Simulated Budget Envelope */}
          <section className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {T('Simulated Budget Envelope', 'ملخص الميزانية المحاكاة')}
                  </h2>
                  <span className={BADGE_SIM_CLS}>
                    {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {T(
                    'Calculated strictly from Fixed Costs + (Simulated Sales × Food Cost %).',
                    'المعادلة الظاهرة: التكاليف الثابتة المدخلة + (المبيعات المحاكاة × نسبة المواد المدخلة).',
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled
                title={
                  isAr
                    ? 'معطّل — هذه أداة محاكاة وليست بيانات فعلية من Odoo'
                    : 'Disabled — simulator output, not realized Odoo GL actuals'
                }
                className="ae-bento-subcard inline-flex h-9 shrink-0 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-bold text-slate-600 opacity-65 dark:text-slate-300"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {T(
                    'Print Official Circular (Disabled)',
                    'طباعة / تصدير تعميم رسمي (معطّل)',
                  )}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="ae-bento-subcard rounded-2xl p-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {T('Simulated Total Spend', 'إجمالي التكلفة المحاكاة (ثابت + مواد)')}
                </div>
                <div
                  dir="ltr"
                  className="mt-1 text-[17px] font-extrabold tabular-nums text-slate-950 dark:text-white"
                >
                  {kwd(totalBoothBudgetKwd)}
                </div>
                <div className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {T('Fixed + Variable Food Input', 'التكاليف الثابتة + تكلفة المواد المدخلة')}
                </div>
              </div>

              <div className="ae-bento-subcard rounded-2xl p-3">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {T('Simulated Daily Spend', 'المتوسط اليومي للتكلفة المحاكاة')}
                </div>
                <div
                  dir="ltr"
                  className="mt-1 text-[17px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400"
                >
                  {kwd(dailyCostCapKwd)}/{isAr ? 'يوم' : 'day'}
                </div>
                <div dir="ltr" className="mt-0.5 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-400">
                  {startDate} {'->'} {endDate}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {/* 2. Pros & Risks */}
            <section className={`${card} space-y-4`}>
              <h2 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                {T('Simulator Pros & Risks', 'قراءة المحاكاة والمخاطر')}
              </h2>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {T('Strengths (What-If)', 'نقاط القوة المحاكاة')}
                </div>
                {pros.length ? (
                  pros.map((s) => (
                    <p key={s} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {s}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-slate-600 dark:text-slate-300">
                    {T(
                      'No standout strengths triggered under current inputs.',
                      'لا توجد نقاط قوة إضافية ضمن المدخلات الحالية.',
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  {T('Risks (What-If)', 'المخاطر المحاكاة')}
                </div>
                {risks.length ? (
                  risks.map((s) => (
                    <p key={s} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {s}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-slate-600 dark:text-slate-300">
                    {T(
                      'No risk flags triggered under current inputs.',
                      'لا توجد مخاطر مسجلة ضمن المدخلات الحالية.',
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {T('Contract Notes', 'ملاحظات العقد')}
                </div>
                {contractReview ? (
                  (isAr ? contractReview.risksAr : contractReview.risksEn).map((r) => (
                    <p key={r} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {r}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-slate-600 dark:text-slate-300">
                    {T(
                      'Attach or paste the contract to review terms.',
                      'أرفق العقد أو الصق بنوده لمراجعة الشروط.',
                    )}
                  </p>
                )}
              </div>
            </section>

            {/* 3. Deterministic Scenario Formula Table */}
            <section className={`${card} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                  {T('Simulator Formula Table', 'جدول معادلات المحاكاة')}
                </h2>
                <span className={BADGE_SIM_CLS}>
                  {isAr ? LABEL_DETERMINISTIC_SIM.ar : LABEL_DETERMINISTIC_SIM.en}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {T('Avg Ticket Input', 'متوسط الفاتورة المدخل')}
                  </div>
                  <div dir="ltr" className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {kwd(basket)}
                  </div>
                </div>
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {T('Margin / Order', 'هامش الطلب المحاكى')}
                  </div>
                  <div dir="ltr" className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {kwd(model.gpPerOrder)}
                  </div>
                </div>
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {T('Break-Even', 'نقطة التعادل')}
                  </div>
                  <div
                    dir="ltr"
                    title={be === null ? unavailableTip : undefined}
                    className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white"
                  >
                    {be !== null ? intFmt(be) : UNAVAILABLE_DASH}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
                <div className="w-full overflow-hidden rounded-xl ring-1 ring-slate-950/[0.04] dark:ring-emerald-500/10">
                  <table className="w-full min-w-[420px] text-[14px] tabular-nums">
                    <thead className="bg-[#F4F6F9] text-slate-700 dark:bg-[#09110E] dark:text-slate-300">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2.5 text-start font-bold">
                          {T('Case', 'الحالة')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-end font-bold">
                          {T('Orders', 'الطلبات')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-end font-bold">
                          {T('Sales', 'المبيعات')}
                        </th>
                        <th className="whitespace-nowrap px-3 py-2.5 text-end font-bold">
                          {T('Net', 'الصافي')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {model.scenarios.map((s) => (
                        <tr key={s.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/[0.05]">
                          <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                            {isAr ? s.ar : s.en}
                          </td>
                          <td dir="ltr" className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">
                            {intFmt(s.orders)}
                          </td>
                          <td dir="ltr" className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">
                            {kwd(s.revenue)}
                          </td>
                          <td
                            dir="ltr"
                            className={`whitespace-nowrap px-3 py-2.5 text-end font-extrabold tabular-nums ${
                              s.profit >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatKwd(s.profit, { locale, signed: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* 4. Negotiation & Operational Checklist */}
          <section className={`${card} grid grid-cols-1 gap-5 lg:grid-cols-2`}>
            <div className="space-y-1.5">
              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                {T('Rent Negotiation Ceiling', 'سقف التفاوض على الإيجار')}
              </div>
              <p className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                •{' '}
                {T(
                  `Max break-even rent at 60% traffic is ${kwd(model.rentCeiling)}${rent > model.rentCeiling ? ` — negotiate ${kwd(rent - model.rentCeiling)} lower.` : '.'}`,
                  `السقف الآمن للإيجار عند إقبال 60% هو ${kwd(model.rentCeiling)}${rent > model.rentCeiling ? ` — فاوض لتخفيض ${kwd(rent - model.rentCeiling)}.` : '.'}`,
                )}
              </p>
              {(contractReview
                ? isAr
                  ? contractReview.counterClausesAr
                  : contractReview.counterClausesEn
                : []
              ).map((c) => (
                <p key={c} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                  • {c}
                </p>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                {T('Operational Checklist', 'قائمة التجهيز التشغيلي')}
              </div>
              {(contractReview
                ? isAr
                  ? contractReview.solutionsAr
                  : contractReview.solutionsEn
                : [
                    T(
                      'Prep core items at Ardiya Central Kitchen and finish on site.',
                      'تجهيز التحضيرات الأساسية في مطبخ العارضية المركزي والتسوية في الموقع.',
                    ),
                    T(
                      'Provide dedicated KNET terminal during peak hours.',
                      'توفير جهاز كي نت مستقل خلال ساعات الذروة.',
                    ),
                    T(
                      'Link any real exhibition POS register in Odoo before operations start.',
                      'ربط نقطة بيع مستقلة في Odoo عند التعاقد الفعلي لتسجيل المبيعات الحقيقية.',
                    ),
                  ]
              ).map((s) => (
                <p key={s} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                  • {s}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
