'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  FileText,
  Lock,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  getBranchLabel,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { buildCircularSerialRef } from '@/lib/governance-compliance'
import {
  buildPlanCircularText,
  computePlanningHubSnapshot,
  FORECAST_HORIZON_OPTIONS,
  sanitizeStrategicPhases,
  SEEDED_STRATEGIC_PHASES,
  STRATEGIC_ROADMAP_STORAGE_KEY,
  type ForecastHorizonId,
  type ScenarioTierId,
  type StrategicRoadmapPhase,
} from '@/lib/aether/planning-engine'

const CARD_CLS =
  'ae-bento-card bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900'
const KPI_CARD_CLS =
  'ae-kpi-card bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3 text-[13px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-white'

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

export function StrategicPlanningStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { workspace } = useGlobalFilter()
  const {
    store,
    session,
    breaches,
    requestApproval,
    getApprovalByRef,
    approveItemWithPin,
    freezeBreachWithPin,
    unfreezeBreachWithPin,
    toggleBranchReceipt,
    confirmAllBranchesReceipt,
    issueOfficialCircularWithPin,
    openCircularPrintModal,
    openBreachStopCircularPrint,
  } = useGovernance()

  const [horizon, setHorizon] = useState<ForecastHorizonId>('90d')
  const [customFrom, setCustomFrom] = useState('2026-11-15')
  const [customTo, setCustomTo] = useState('2027-02-15')
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioTierId>('realistic')
  const [phases, setPhases] = useState<StrategicRoadmapPhase[]>(SEEDED_STRATEGIC_PHASES)
  const [formOpen, setFormOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedCircularId, setExpandedCircularId] = useState<string | null>(null)

  // New Strategic Phase form state
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('2026-11-20')
  const [newEnd, setNewEnd] = useState('2027-01-20')
  const [newOwner, setNewOwner] = useState('')
  const [newCostCap, setNewCostCap] = useState('300')
  const [newMonthlyGain, setNewMonthlyGain] = useState('1200')
  const [newKpi, setNewKpi] = useState('')

  // On-demand AI Strategic Forecast Readout state (triggered ONLY when user clicks button)
  const [aiForecastLoading, setAiForecastLoading] = useState(false)
  const [aiForecastText, setAiForecastText] = useState<string | null>(null)
  const [aiForecastModel, setAiForecastModel] = useState<string | null>(null)
  const [aiForecastUpdatedAt, setAiForecastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STRATEGIC_ROADMAP_STORAGE_KEY)
      if (raw) {
        setPhases(sanitizeStrategicPhases(JSON.parse(raw)))
      }
    } catch {}
  }, [])

  const persistPhases = useCallback((next: StrategicRoadmapPhase[]) => {
    setPhases(next)
    try {
      window.localStorage.setItem(STRATEGIC_ROADMAP_STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  const snap = useMemo(
    () => computePlanningHubSnapshot(workspace, phases, horizon, customFrom, customTo),
    [workspace, phases, horizon, customFrom, customTo],
  )

  const activeScenario = useMemo(
    () => snap.scenarios.find((s) => s.id === activeScenarioId) ?? snap.scenarios[1],
    [snap.scenarios, activeScenarioId],
  )

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
        (isAr ? 'مرحلة تشغيلية استراتيجية جديدة' : 'New Strategic Execution Phase')
      const cleanOwner =
        newOwner.trim() || (isAr ? 'إدارة التشغيل والفروع' : 'Operations & Branch Team')
      const cleanKpi =
        newKpi.trim() ||
        (isAr
          ? 'رفع صافي التدفق النقدي وضبط سقف التكلفة'
          : 'Grow net cash flow within approved cost cap')
      const created: StrategicRoadmapPhase = {
        id: `plan-phase-${Date.now()}`,
        phaseCode: `P${phases.length + 1}`,
        titleAr: cleanTitle,
        titleEn: cleanTitle,
        startDate: newStart <= newEnd ? newStart : newEnd,
        endDate: newStart <= newEnd ? newEnd : newStart,
        ownerAr: cleanOwner,
        ownerEn: cleanOwner,
        costCapKwd: Math.max(0, Number(newCostCap) || 0),
        expectedMonthlyGainKwd: Math.max(0, Number(newMonthlyGain) || 0),
        targetKpiAr: cleanKpi,
        targetKpiEn: cleanKpi,
        odooWatchMetricAr: `التزام بسقف تكلفة ${f0(Number(newCostCap) || 0)} د.ك وعدم تجاوز الخصم 3.0%`,
        odooWatchMetricEn: `Stay within ${f0(Number(newCostCap) || 0)} KWD cost cap & <=3.0% POS discount`,
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

  const handleRunStrategicAiForecast = useCallback(async () => {
    setAiForecastLoading(true)
    const fallbackSynthesis = isAr
      ? [
          `• قراءة أودو 17 والسوق الكويتي (${snap.horizonLabelAr}): خط الأساس الشهري ${f0(snap.monthlyBaselineSalesKwd)} د.ك مبيعات بصافي ${f0(snap.monthlyBaselineNetKwd)} د.ك، مع قفزة +${snap.paydayLiftPct}% في أسبوع الرواتب (٢٠–٢٨ الشهر).`,
          `• التوصية التنفيذية الأولى: اعتمد السيناريو الواقعي (${f0(activeScenario.projectedSalesKwd)} د.ك مبيعات | ${f0(activeScenario.projectedCostsKwd)} د.ك تكاليف | +${f0(activeScenario.projectedNetCashKwd)} د.ك صافي كاش) عبر تحويل الطلبات القريبة إلى أسطول TMP (15%) بدلاً من Tgo (25%).`,
          `• حماية الهامش بالعارضية والفروع السبعة: ثبّت سقف الخصومات عند ≤ 3.0% وسقف هدر مطبخ العارضية ≤ 1.8%، وشغّل طاحينة ونودل بار داخل السالمية والبروميناد لالتقاط ذروة موسم الشتاء والكشتات بدون دينار إيجار إضافي.`,
        ].join('\n')
      : [
          `• Odoo 17 & Kuwait Market Readout (${snap.horizonLabelEn}): Monthly baseline stands at ${f0(snap.monthlyBaselineSalesKwd)} KWD sales and ${f0(snap.monthlyBaselineNetKwd)} KWD net cash, backed by a +${snap.paydayLiftPct}% Kuwait payday lift (20th–28th).`,
          `• Primary CFO Recommendation: Lock the Realistic Scenario (${f0(activeScenario.projectedSalesKwd)} KWD sales | ${f0(activeScenario.projectedCostsKwd)} KWD costs | +${f0(activeScenario.projectedNetCashKwd)} KWD net cash) by shifting <=4km delivery orders from Tgo (25%) to own TMP fleet (15%).`,
          `• Margin Defense Across 7 Branches & Ardiya: Enforce <=3.0% POS promo cap and <=1.8% Ardiya prep waste while running Tahina + Noodle Bar inside Salmiya & Promenade at zero extra rent.`,
        ].join('\n')

    try {
      const systemText = isAr
        ? 'أنت المدير المالي والاستراتيجي لشركة فنتشر فودز لإدارة المطاعم في الكويت (6 علامات، 7 فروع، مطبخ العارضية المركزي). لخص التوقعات في 3 نقاط تنفيذية محددة بالأرقام (د.ك) بدون حشو.'
        : 'You are the CFO & Chief Strategy Officer of Venture Foods Kuwait (6 brands, 7 branches, Ardiya Central Kitchen). Summarize the forecast in 3 crisp, numeric KWD executive bullets with zero filler.'

      const userPrompt = isAr
        ? `حلل أفق التخطيط (${snap.horizonLabelAr}) للنطاق (${workspace.subtitleAr}):
- خط الأساس الشهري من أودو 17: المبيعات ${f0(snap.monthlyBaselineSalesKwd)} د.ك، التكاليف ${f0(snap.monthlyBaselineCostsKwd)} د.ك، الصافي ${f0(snap.monthlyBaselineNetKwd)} د.ك.
- تكلفة المواد والعارضية: ${snap.ardiyaFoodPct}% | عمولة التوصيل: ${snap.deliveryFeePct}% | حصة الصالة والمباشر: ${snap.directChannelSharePct}% | قفزة الرواتب (٢٠–٢٨): +${snap.paydayLiftPct}%.
- السيناريو الواقعي المختار: مبيعات ${f0(activeScenario.projectedSalesKwd)} د.ك، التكاليف ${f0(activeScenario.projectedCostsKwd)} د.ك، الصافي ${f0(activeScenario.projectedNetCashKwd)} د.ك، استرداد ${activeScenario.paybackLabelAr}.
أعطني ٣ توصيات استراتيجية مركزة تجمع بيانات أودو ومواسم الكويت (الشتاء والكشتات والرواتب).`
        : `Analyze planning horizon (${snap.horizonLabelEn}) for scope (${workspace.subtitleEn}):
- Odoo 17 monthly baseline: Sales ${f0(snap.monthlyBaselineSalesKwd)} KWD, Costs ${f0(snap.monthlyBaselineCostsKwd)} KWD, Net ${f0(snap.monthlyBaselineNetKwd)} KWD.
- Food/Ardiya COGS: ${snap.ardiyaFoodPct}% | Delivery cut: ${snap.deliveryFeePct}% | Direct 0%-fee share: ${snap.directChannelSharePct}% | Kuwait payday surge: +${snap.paydayLiftPct}%.
- Selected Scenario: Sales ${f0(activeScenario.projectedSalesKwd)} KWD, Costs ${f0(activeScenario.projectedCostsKwd)} KWD, Net Cash ${f0(activeScenario.projectedNetCashKwd)} KWD (${activeScenario.paybackLabelEn}).
Provide 3 concise CFO strategic bullets combining Odoo telemetry and Kuwait seasonality.`

      const res = await fetch('/api/ai/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemText,
          userPrompt,
          tier: 'daily',
          maxTokens: 1200,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; text?: string; model?: string }
        if (data.ok && data.text?.trim()) {
          setAiForecastText(data.text.trim())
          setAiForecastModel(data.model ?? 'claude-sonnet')
        } else {
          setAiForecastText(fallbackSynthesis)
          setAiForecastModel('Odoo 17 CFO Deterministic Engine')
        }
      } else {
        setAiForecastText(fallbackSynthesis)
        setAiForecastModel('Odoo 17 CFO Deterministic Engine')
      }
    } catch {
      setAiForecastText(fallbackSynthesis)
      setAiForecastModel('Odoo 17 CFO Deterministic Engine')
    } finally {
      setAiForecastUpdatedAt(
        new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
      setAiForecastLoading(false)
    }
  }, [activeScenario, isAr, snap, workspace.subtitleAr, workspace.subtitleEn])

  const totalCostCap = useMemo(
    () => phases.reduce((s, p) => s + p.costCapKwd, 0),
    [phases],
  )
  const totalMonthlyUpside = useMemo(
    () => phases.reduce((s, p) => s + p.expectedMonthlyGainKwd, 0),
    [phases],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-4 pb-10">
      {/* ───────────── 1. Executive Header + Horizon Picker + On-Demand Strategic AI Button ───────────── */}
      <header className={`${CARD_CLS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Compass className="h-4 w-4" />
            </span>
            <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 sm:text-[22px] dark:text-white">
              {isAr ? 'التخطيط والتوقعات والامتثال' : 'Strategic Planning, Forecasting & Compliance'}
            </h1>
            {session.active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Unlock className="h-3 w-3" />
                <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
              </span>
            ) : null}
          </div>
          <p className="text-xs text-neutral-400">
            {isAr
              ? `${snap.horizonLabelAr} • مبني على بيانات أودو 17 الحية لـ 6 علامات و7 فروع ومطبخ العارضية ومواسم الكويت`
              : `${snap.horizonLabelEn} • Synthesized from live Venture Foods Odoo 17 telemetry + Kuwait F&B seasonality`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidingPillTabs<ForecastHorizonId>
            ariaLabel={isAr ? 'أفق التوقعات' : 'Forecast Horizon'}
            size="sm"
            value={horizon}
            onChange={setHorizon}
            options={FORECAST_HORIZON_OPTIONS.map((h) => ({
              id: h.id,
              label: isAr ? h.ar : h.en,
            }))}
          />

          <button
            type="button"
            onClick={() => void handleRunStrategicAiForecast()}
            disabled={aiForecastLoading}
            className="ae-btn-primary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all duration-150 hover:opacity-95 disabled:opacity-60"
          >
            {aiForecastLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {aiForecastLoading
                ? isAr
                  ? 'جارٍ تحديث التوقعات...'
                  : 'Synthesizing Forecast...'
                : isAr
                  ? 'تحديث التوقعات بالذكاء الاستراتيجي ✨'
                  : 'Refresh Strategic AI Forecast ✨'}
            </span>
          </button>
        </div>
      </header>

      {/* Custom Horizon Inline Date Inputs */}
      {horizon === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900">
          <span className="text-xs font-semibold text-neutral-600 dark:text-slate-300">
            {isAr ? 'نطاق التخطيط المخصص:' : 'Custom Forecast Window:'}
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-slate-300">
            <span>{isAr ? 'من تاريخ' : 'Start Date'}</span>
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-full bg-[#F7F7F8] px-3 text-xs font-semibold tabular-nums text-neutral-900 outline-none dark:bg-[#090F15] dark:text-white"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-slate-300">
            <span>{isAr ? 'إلى تاريخ' : 'End Date'}</span>
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-full bg-[#F7F7F8] px-3 text-xs font-semibold tabular-nums text-neutral-900 outline-none dark:bg-[#090F15] dark:text-white"
            />
          </label>
          <span dir="ltr" className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {snap.horizonDays} {isAr ? 'يوم' : 'days'}
          </span>
        </div>
      ) : null}

      {/* On-Demand Strategic AI Forecast Readout Card */}
      {aiForecastText ? (
        <section className={`${CARD_CLS} ae-glow-emerald space-y-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                {isAr
                  ? 'قراءة الذكاء الاستراتيجي المحدثة (أودو 17 + سوق الكويت)'
                  : 'Updated Strategic AI Forecast Readout (Odoo 17 + Kuwait Market)'}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              {aiForecastModel ? (
                <span dir="ltr" className="rounded-full bg-[#F7F7F8] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-neutral-700 dark:bg-white/[0.06] dark:text-slate-200">
                  {aiForecastModel}
                </span>
              ) : null}
              {aiForecastUpdatedAt ? <span>{aiForecastUpdatedAt}</span> : null}
            </div>
          </div>
          <div className="whitespace-pre-line rounded-2xl bg-[#F7F7F8] p-3.5 text-[13px] leading-relaxed text-neutral-800 dark:bg-neutral-950 dark:text-slate-200">
            {aiForecastText}
          </div>
        </section>
      ) : null}

      {/* ───────────── 2. 4 Live Baseline & Kuwait Pulse KPI Cards ───────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'خط الأساس الشهري (أودو 17)' : 'Monthly Odoo 17 Baseline'}
          </div>
          <div dir="ltr" className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {f0(snap.monthlyBaselineSalesKwd)} {kwd}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr
              ? `الصافي الشهري الحالي: ${f0(snap.monthlyBaselineNetKwd)} د.ك`
              : `Current monthly net cash: ${f0(snap.monthlyBaselineNetKwd)} KWD`}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'مطبخ العارضية + عمولة التوصيل' : 'Ardiya COGS + Delivery Cut'}
          </div>
          <div dir="ltr" className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {f1(snap.ardiyaFoodPct)}% <span className="text-sm font-medium text-neutral-400">+ {f1(snap.deliveryFeePct)}%</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr
              ? `حصة الصالة والمباشر (٠٪ عمولة): ${f1(snap.directChannelSharePct)}%`
              : `Zero-fee Dine-In & Pickup share: ${f1(snap.directChannelSharePct)}%`}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'نبض الرواتب والموسم بالكويت' : 'Kuwait Payday & Seasonal Lift'}
          </div>
          <div dir="ltr" className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            +{f1(snap.paydayLiftPct)}%
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr ? 'قفزة ٢٠–٢٨ الشهر + ذروة الشتاء والكشتات' : '20th–28th salary surge + winter peak'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'عائد خارطة المراحل مقابل السقف' : 'Roadmap Return vs Cost Cap'}
          </div>
          <div dir="ltr" className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            +{f0(totalMonthlyUpside)} {kwd}
            <span className="text-xs font-medium text-neutral-400">{isAr ? '/شهر' : '/mo'}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr
              ? `سقف تكلفة المراحل الـ ${phases.length}: ${f0(totalCostCap)} د.ك`
              : `Total cost cap across ${phases.length} phases: ${f0(totalCostCap)} KWD`}
          </p>
        </article>
      </section>

      {/* ───────────── 3. 3-Scenario Forecast Cards (متحفظ / واقعي / طموح) ───────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {isAr ? 'سيناريوهات التوقعات المالية الثلاثة' : 'Three Financial Forecast Scenarios'}
            </h2>
            <p className="text-xs text-neutral-400">
              {isAr
                ? 'اضغط على أي سيناريو لربطه بالتعميم الرسمي ومؤشرات الامتثال'
                : 'Select any scenario to link with official circulars & Odoo compliance targets'}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900 dark:text-slate-200">
            {isAr ? snap.horizonLabelAr : snap.horizonLabelEn}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {snap.scenarios.map((sc) => {
            const selected = sc.id === activeScenarioId
            return (
              <article
                key={sc.id}
                onClick={() => setActiveScenarioId(sc.id)}
                className={`${CARD_CLS} cursor-pointer transition-all duration-150 ${
                  selected
                    ? 'ring-2 ring-emerald-500/80 dark:ring-emerald-400/80'
                    : 'hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        sc.id === 'realistic'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
                          : sc.id === 'ambitious'
                            ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
                            : 'bg-neutral-100 text-neutral-800 dark:bg-white/[0.08] dark:text-slate-200'
                      }`}
                    >
                      {isAr ? sc.badgeAr : sc.badgeEn}
                    </span>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      {isAr ? sc.subtitleAr : sc.subtitleEn}
                    </p>
                  </div>

                  <span
                    dir="ltr"
                    className="rounded-full bg-[#F7F7F8] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-neutral-700 dark:bg-neutral-950 dark:text-slate-200"
                  >
                    {isAr ? sc.paybackLabelAr : sc.paybackLabelEn}
                  </span>
                </div>

                {/* 3 Core Numbers: Projected Sales | Costs (التكاليف KWD) | Net Cash */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-neutral-950">
                    <div className="text-[11px] text-neutral-400">
                      {isAr ? 'المبيعات المتوقعة' : 'Projected Sales'}
                    </div>
                    <div dir="ltr" className="mt-1 text-[15px] font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {f0(sc.projectedSalesKwd)}
                    </div>
                    <div className="text-[10.5px] text-neutral-400">{kwd}</div>
                  </div>

                  <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-neutral-950">
                    <div className="text-[11px] text-neutral-400">
                      {isAr ? 'التكاليف' : 'Total Costs'}
                    </div>
                    <div dir="ltr" className="mt-1 text-[15px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {f0(sc.projectedCostsKwd)}
                    </div>
                    <div className="text-[10.5px] text-neutral-400">{kwd}</div>
                  </div>

                  <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/35">
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      {isAr ? 'صافي الكاش' : 'Net Cash'}
                    </div>
                    <div className="mt-1 text-[15px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {sc.projectedNetCashKwd >= 0 ? '+' : ''}
                      {f0(sc.projectedNetCashKwd)}
                    </div>
                    <div dir="ltr" className="text-[10.5px] font-semibold tabular-nums text-emerald-700/80 dark:text-emerald-400">
                      {f1(sc.netMarginPct)}% {kwd}
                    </div>
                  </div>
                </div>

                <ul className="mt-3.5 space-y-1.5 text-xs text-neutral-600 dark:text-slate-300">
                  {(isAr ? sc.assumptionsAr : sc.assumptionsEn).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      {/* ───────────── 4. Kuwait F&B Market & Seasonal Drivers Strip ───────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {snap.signals.map((sig) => (
          <article key={sig.id} className={CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                {isAr ? sig.titleAr : sig.titleEn}
              </h3>
              <span
                dir="ltr"
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  sig.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : sig.tone === 'sky'
                      ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                }`}
              >
                {isAr ? sig.impactBadgeAr : sig.impactBadgeEn}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-slate-300">
              {isAr ? sig.detailAr : sig.detailEn}
            </p>
          </article>
        ))}
      </section>

      {/* ───────────── 5. Interactive Phased Roadmap (`المراحل والجدول الزمني` + `+ خطة جديدة`) ───────────── */}
      <section className={`${CARD_CLS} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {isAr
                ? 'المراحل والجدول الزمني واعتماد التعميم الرسمي'
                : 'Phased Execution Roadmap & Official Circulars'}
            </h2>
            <p className="text-xs text-neutral-400">
              {isAr
                ? 'ارفع طلب موافقة المدير 🔔، واعتمد بختم المدير السري لتعميم الخطة رسمياً على الفروع الـ 7'
                : 'Submit for Manager Approval 🔔, then seal & broadcast with Secret Manager Seal across all 7 branches'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="ae-btn-primary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{formOpen ? (isAr ? 'إغلاق النموذج ✕' : 'Close ✕') : isAr ? '+ خطة جديدة' : '+ New Plan'}</span>
          </button>
        </div>

        {formOpen ? (
          <form
            onSubmit={handleAddPhase}
            className="rounded-2xl bg-[#F7F7F8] p-4 space-y-3 dark:bg-neutral-950"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                  {isAr ? 'عنوان الخطة أو المرحلة' : 'Plan / Phase Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: إطلاق منيو الشتاء في السالمية...' : 'e.g. Launch winter family bundles...'}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
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
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
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
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
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
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                  {isAr ? 'المؤشر المستهدف (Target KPI)' : 'Target KPI'}
                </label>
                <input
                  type="text"
                  required
                  value={newKpi}
                  onChange={(e) => setNewKpi(e.target.value)}
                  placeholder={isAr ? 'مثال: رفع الطلبات +30 يومياً وسقف هدر ≤ 1.8%' : 'e.g. +30 daily orders & waste <= 1.8%'}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                  {isAr ? 'العائد الشهري المتوقع (د.ك)' : 'Expected Monthly Return (KWD)'}
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
                  <button
                    type="submit"
                    className="ae-btn-primary inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-4 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isAr ? 'حفظ' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : null}

        <div className="space-y-3">
          {phases.map((phase) => {
            const refKey = `strategic-plan:${phase.id}`
            const approval = getApprovalByRef(refKey)
            const circularKey = `plan-circular:${phase.id}`
            const issuedCircular = store.issuedCirculars[circularKey]
            const receipts = store.branchReceipts[circularKey] ?? {}
            const receivedCount = APPROVED_BRANCH_IDS.filter((b) => receipts[b]).length
            const circularBodyAr = buildPlanCircularText(phase, activeScenario, true, issuedCircular?.sealId ?? approval?.seal?.sealId)
            const circularBodyEn = buildPlanCircularText(phase, activeScenario, false, issuedCircular?.sealId ?? approval?.seal?.sealId)
            const activeCircularText = isAr ? circularBodyAr : circularBodyEn
            const showCircularPanel = expandedCircularId === phase.id || Boolean(issuedCircular)

            return (
              <article
                key={phase.id}
                className="rounded-2xl bg-[#F7F7F8] p-4 transition-all duration-150 dark:bg-neutral-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
                        {phase.phaseCode}
                      </span>
                      <span dir="ltr" className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-900 dark:text-slate-200">
                        {phase.startDate} → {phase.endDate}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-slate-300">
                        {isAr ? phase.ownerAr : phase.ownerEn}
                      </span>
                      {approval?.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>
                            {isAr
                              ? `معتمد بختم المدير (${approval.seal?.sealId ?? 'VF'}) ✅`
                              : `Manager Sealed (${approval.seal?.sealId ?? 'VF'}) ✅`}
                          </span>
                        </span>
                      ) : approval?.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          <Bell className="h-3 w-3" />
                          <span>{isAr ? 'بانتظار موافقة المدير 🔔' : 'Pending Manager PIN 🔔'}</span>
                        </span>
                      ) : null}
                      {issuedCircular ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                          <Megaphone className="h-3 w-3" />
                          <span>
                            {isAr
                              ? `تم التعميم (${receivedCount}/7 فروع) 📢`
                              : `Broadcasted (${receivedCount}/7 branches) 📢`}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-[15px] font-semibold text-neutral-950 dark:text-white">
                      {isAr ? phase.titleAr : phase.titleEn}
                    </h3>

                    <p className="text-xs text-neutral-600 dark:text-slate-300">
                      <span className="font-semibold text-neutral-800 dark:text-white">
                        {isAr ? 'المستهدف: ' : 'Target KPI: '}
                      </span>
                      {isAr ? phase.targetKpiAr : phase.targetKpiEn}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-xl bg-white px-3 py-1.5 text-end shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900">
                      <div className="text-[10.5px] text-neutral-400">
                        {isAr ? 'سقف التكلفة' : 'Cost Cap'}
                      </div>
                      <div dir="ltr" className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {f0(phase.costCapKwd)} {kwd}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white px-3 py-1.5 text-end shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900">
                      <div className="text-[10.5px] text-neutral-400">
                        {isAr ? 'العائد الشهري' : 'Monthly Gain'}
                      </div>
                      <div dir="ltr" className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{f0(phase.expectedMonthlyGainKwd)} {kwd}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Governance Action Row */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/60 pt-3 dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2">
                    {!approval ? (
                      <button
                        type="button"
                        onClick={() =>
                          requestApproval({
                            refKey,
                            domain: 'planning',
                            titleAr: `اعتماد مرحلة التخطيط (${phase.phaseCode}): ${phase.titleAr}`,
                            titleEn: `Approve Strategic Phase (${phase.phaseCode}): ${phase.titleEn}`,
                            summaryAr: `الفترة ${phase.startDate} ← ${phase.endDate} • المسؤول: ${phase.ownerAr} • سقف التكلفة ${f0(phase.costCapKwd)} د.ك • العائد +${f0(phase.expectedMonthlyGainKwd)} د.ك/شهر.`,
                            summaryEn: `Window ${phase.startDate} -> ${phase.endDate} • Owner: ${phase.ownerEn} • Cost Cap ${f0(phase.costCapKwd)} KWD • Return +${f0(phase.expectedMonthlyGainKwd)} KWD/mo.`,
                            departmentAr: phase.ownerAr,
                            departmentEn: phase.ownerEn,
                            budgetOrCostKwd: phase.costCapKwd,
                            expectedMonthlyReturnKwd: phase.expectedMonthlyGainKwd,
                            href: '/erp/planning',
                          })
                        }
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Manager Approval 🔔'}</span>
                      </button>
                    ) : approval.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() =>
                          approveItemWithPin(approval.id, approval.titleAr, approval.titleEn)
                        }
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <Lock className="h-3 w-3" />
                        <span>{isAr ? 'موافقة واعتماد بـ PIN ✅' : 'Approve & Seal (PIN) ✅'}</span>
                      </button>
                    ) : null}

                    {/* PIN-Locked Official Broadcast Circular */}
                    <button
                      type="button"
                      onClick={() =>
                        issueOfficialCircularWithPin({
                          circularKey,
                          kind: 'strategic-plan',
                          titleAr: `${phase.phaseCode} — ${phase.titleAr}`,
                          titleEn: `${phase.phaseCode} — ${phase.titleEn}`,
                          circularBodyAr,
                          circularBodyEn,
                          scopeAr: `${phase.ownerAr} · الفروع السبعة المعتمدة`,
                          scopeEn: `${phase.ownerEn} · All 7 Active Branches`,
                          effectiveWindow: `${phase.startDate} → ${phase.endDate}`,
                          financialSummaryAr: `سقف التكلفة: ${f0(phase.costCapKwd)} د.ك • العائد المستهدف: +${f0(phase.expectedMonthlyGainKwd)} د.ك/شهر`,
                          financialSummaryEn: `Cost Cap: ${f0(phase.costCapKwd)} KWD • Target Return: +${f0(phase.expectedMonthlyGainKwd)} KWD/mo`,
                          mandatoryRulesAr: [
                            `تحقيق المؤشر المستهدف: ${phase.targetKpiAr}`,
                            `عدم تجاوز سقف ميزانية المرحلة المحدد بـ ${f0(phase.costCapKwd)} د.ك بدون ختم المدير التنفيذي.`,
                            'ربط التنفيذ آلياً بمراقب الامتثال الحي في أودو ١٧ وتأكيد استلام الفروع السبعة.',
                          ],
                          mandatoryRulesEn: [
                            `Deliver Target KPI: ${phase.targetKpiEn}`,
                            `Strict phase cost cap <= ${f0(phase.costCapKwd)} KWD without Executive PIN Seal.`,
                            'Monitored continuously in Odoo 17 Watchdog with 7-branch digital receipt tracking.',
                          ],
                          onIssued: () => setExpandedCircularId(phase.id),
                        })
                      }
                      className="ae-btn-primary inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-150"
                    >
                      <Megaphone className="h-3.5 w-3.5" />
                      <span>
                        {isAr
                          ? 'تعميم الخطة المعتمدة رسمياً 📢'
                          : 'Broadcast Approved Plan Officially 📢'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openCircularPrintModal({
                          circularKey,
                          serialRef:
                            issuedCircular?.serialRef ?? buildCircularSerialRef(circularKey),
                          kind: 'strategic-plan',
                          titleAr: `${phase.phaseCode} — ${phase.titleAr}`,
                          titleEn: `${phase.phaseCode} — ${phase.titleEn}`,
                          classificationAr: 'تعميم خطة استراتيجية معتمدة',
                          classificationEn: 'Approved Strategic Execution Circular',
                          scopeAr: `${phase.ownerAr} · الفروع السبعة ومطبخ العارضية`,
                          scopeEn: `${phase.ownerEn} · All 7 Active Branches & Ardiya Kitchen`,
                          issuedAtIso:
                            issuedCircular?.issuedAtIso ??
                            approval?.seal?.approvedAtIso ??
                            new Date().toISOString(),
                          effectiveWindow: `${phase.startDate} → ${phase.endDate}`,
                          sealId: issuedCircular?.sealId ?? approval?.seal?.sealId,
                          financialSummaryAr: `سقف التكلفة: ${f0(phase.costCapKwd)} د.ك • العائد المتوقع: +${f0(phase.expectedMonthlyGainKwd)} د.ك/شهر`,
                          financialSummaryEn: `Cost Cap: ${f0(phase.costCapKwd)} KWD • Expected Gain: +${f0(phase.expectedMonthlyGainKwd)} KWD/mo`,
                          mandatoryRulesAr: [
                            `المؤشر التشغيلي الإلزامي: ${phase.targetKpiAr}`,
                            `سقف الصرف المسموح لهذه المرحلة لا يتجاوز ${f0(phase.costCapKwd)} د.ك.`,
                            `السيناريو المالي المربوط: ${activeScenario.badgeAr} (صافي كاش +${f0(activeScenario.projectedNetCashKwd)} د.ك).`,
                            'يتم تجميد أي انحراف آلياً عبر جرس الامتثال في أودو ١٧.',
                          ],
                          mandatoryRulesEn: [
                            `Mandatory Target KPI: ${phase.targetKpiEn}`,
                            `Phase spending strictly capped at <= ${f0(phase.costCapKwd)} KWD.`,
                            `Linked Scenario: ${activeScenario.badgeEn} (+${f0(activeScenario.projectedNetCashKwd)} KWD net cash).`,
                            'Any deviation triggers immediate Odoo 17 Compliance Watchdog alert.',
                          ],
                          bodyAr: circularBodyAr,
                          bodyEn: circularBodyEn,
                        })
                      }
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-emerald-50 dark:bg-[#111A22] dark:text-emerald-300"
                    >
                      <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`circ-${phase.id}`, activeCircularText)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-neutral-100 dark:bg-neutral-900 dark:text-slate-200"
                    >
                      {copiedKey === `circ-${phase.id}` ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{isAr ? 'نسخ التعميم 📋' : 'Copy Circular 📋'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(activeCircularText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{isAr ? 'واتساب الفروع 📲' : 'WhatsApp 📲'}</span>
                    </a>
                  </div>

                  {!SEEDED_STRATEGIC_PHASES.some((s) => s.id === phase.id) ? (
                    <button
                      type="button"
                      onClick={() => handleDeletePhase(phase.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* 7/7 Branch Receipt Tracker & Stamped Circular Preview */}
                {showCircularPanel ? (
                  <div className="mt-3 rounded-2xl bg-white p-3.5 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>
                          {isAr
                            ? `سجل استلام الفروع السبعة للتعميم (${receivedCount}/7)`
                            : `7-Branch Circular Receipt Tracker (${receivedCount}/7)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmAllBranchesReceipt(circularKey)}
                        className="cursor-pointer rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        {isAr ? 'تأكيد استلام الـ 7 فروع ✓' : 'Mark All 7 Branches Received ✓'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {APPROVED_BRANCH_IDS.map((branchId) => {
                        const checked = Boolean(receipts[branchId])
                        return (
                          <button
                            key={branchId}
                            type="button"
                            onClick={() =>
                              toggleBranchReceipt(
                                circularKey,
                                branchId as Exclude<GlobalBranch, 'all'>,
                              )
                            }
                            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              checked
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#F7F7F8] text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-300'
                            }`}
                          >
                            {checked ? <Check className="h-3 w-3" /> : null}
                            <span>{getBranchLabel(branchId, isAr)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      {/* ───────────── 6. Live Odoo 17 Plan Compliance Monitor + PIN-Locked Violation Blocker ───────────── */}
      <section className={`${CARD_CLS} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {isAr
                  ? 'مراقب الامتثال للخطط المعتمدة في أودو 17'
                  : 'Live Odoo 17 Plan Compliance Watchdog'}
              </h2>
              <p className="text-xs text-neutral-400">
                {isAr
                  ? 'يرصد آلياً أي انحراف بالخصومات أو فواتير موردي العارضية أو الحملات الخاسرة، مع إيقاف فوري بـ PIN المدير'
                  : 'Continuously checks live Odoo POS & supplier bills against approved caps with PIN-locked freeze'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {isAr
              ? `${breaches.filter((b) => !b.frozen).length} مخالفات نشطة للقرارات`
              : `${breaches.filter((b) => !b.frozen).length} Active Deviations`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {breaches.map((b) => (
            <article
              key={b.id}
              className={`rounded-2xl p-4 transition-all ${
                b.frozen
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                  : 'bg-[#F7F7F8] dark:bg-neutral-950'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    b.frozen
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : b.breachKind === 'procedural-cap-overrun'
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                  }`}
                >
                  {b.frozen
                    ? isAr
                      ? 'تم تجميد الصرف وتعميم الإيقاف ⛔✓'
                      : 'Frozen & Stop-Order Issued ⛔✓'
                    : b.breachKind === 'procedural-cap-overrun'
                      ? isAr
                        ? '⚠️ تجاوز سقف بدون إذن مسبق'
                        : '⚠️ Unapproved Cap Overrun'
                      : isAr
                        ? '🚨 مخالفة لقرار معتمد'
                        : '🚨 Approved Rule Breach'}
                </span>

                <span
                  dir="ltr"
                  className={`text-xs font-semibold tabular-nums ${
                    b.breachKind === 'procedural-cap-overrun'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {b.badgeLabelAr && b.badgeLabelEn
                    ? isAr
                      ? b.badgeLabelAr
                      : b.badgeLabelEn
                    : `-${f0(b.monthlyLeakKwd)} ${kwd}/${isAr ? 'شهر' : 'mo'}`}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                {isAr ? b.breachHeadlineAr : b.breachHeadlineEn}
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-300">
                {isAr
                  ? `${b.approvedRuleLimitAr} • الفعلي بأودو: ${b.odooMetricProofAr}`
                  : `${b.approvedRuleLimitEn} • Live Odoo: ${b.odooMetricProofEn}`}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!b.frozen ? (
                  <button
                    type="button"
                    onClick={() => freezeBreachWithPin(b, true)}
                    className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-rose-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                    style={{ color: '#FFFFFF' }}
                  >
                    <Lock className="h-3 w-3" />
                    <span>{isAr ? 'إيقاف المخالفة فوراً ⛔' : 'Stop Breach Immediately ⛔'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => unfreezeBreachWithPin(b)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-200/80 px-3.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-300 dark:bg-white/10 dark:text-slate-200"
                  >
                    <Unlock className="h-3 w-3" />
                    <span>{isAr ? 'فك التجميد بعد التصحيح 🔓' : 'Unfreeze After Fix 🔓'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openBreachStopCircularPrint(b)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-emerald-50 dark:bg-[#111A22] dark:text-emerald-300"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `stop-${b.id}`,
                      isAr ? b.stopDirectiveAr : b.stopDirectiveEn,
                    )
                  }
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900 dark:text-slate-200"
                >
                  {copiedKey === `stop-${b.id}` ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{isAr ? 'نسخ أمر الإيقاف 📋' : 'Copy Stop Order 📋'}</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
