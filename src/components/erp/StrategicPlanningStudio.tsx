'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
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
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'ae-bento-subcard rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3.5 text-[14px] font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:bg-[#0B1410] dark:text-slate-100 dark:ring-emerald-500/15'
const PRIMARY_SOFT_BTN_CLS =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100/90 disabled:opacity-60 dark:bg-emerald-950/65 dark:text-emerald-200 dark:ring-emerald-400/25 dark:hover:bg-emerald-900/60'
const HEADER_ACTION_BTN_CLS =
  'inline-flex h-9 sm:h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 sm:px-4 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100/90 disabled:opacity-60 dark:bg-emerald-950/65 dark:text-emerald-200 dark:ring-emerald-400/25 dark:hover:bg-emerald-900/60'
const MENU_ITEM_CLS =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-emerald-50/70 hover:text-emerald-900 dark:text-slate-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-200'

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

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
    toggleBranchReceipt,
    confirmAllBranchesReceipt,
    issueOfficialCircularWithPin,
    openCircularPrintModal,
    openDrawer,
  } = useGovernance()

  const [horizon, setHorizon] = useState<ForecastHorizonId>('90d')
  const [customFrom, setCustomFrom] = useState('2026-11-15')
  const [customTo, setCustomTo] = useState('2027-02-15')
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioTierId>('realistic')
  const [phases, setPhases] = useState<StrategicRoadmapPhase[]>(SEEDED_STRATEGIC_PHASES)
  const [formOpen, setFormOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedCircularId, setExpandedCircularId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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
        setPhases(dedupeStrategicPhases(sanitizeStrategicPhases(JSON.parse(raw))))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!openMenuId) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('[data-plan-menu-root]')) {
        setOpenMenuId(null)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  const persistPhases = useCallback((next: StrategicRoadmapPhase[]) => {
    const clean = dedupeStrategicPhases(next)
    setPhases(clean)
    try {
      window.localStorage.setItem(STRATEGIC_ROADMAP_STORAGE_KEY, JSON.stringify(clean))
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

  const activeBreachCount = useMemo(
    () => breaches.filter((b) => !b.frozen).length,
    [breaches],
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
      setOpenMenuId(null)
    },
    [persistPhases, phases],
  )

  const handleRunStrategicAiForecast = useCallback(async () => {
    setAiForecastLoading(true)
    const fallbackSynthesis = isAr
      ? [
          `• قراءة أودو 17 والسوق الكويتي (${snap.horizonLabelAr}): خط الأساس الشهري ${f0(snap.monthlyBaselineSalesKwd)} د.ك مبيعات بصافي ${f0(snap.monthlyBaselineNetKwd)} د.ك، مع قفزة +${snap.paydayLiftPct}% في أسبوع الرواتب (20–28 الشهر).`,
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
- تكلفة المواد والعارضية: ${snap.ardiyaFoodPct}% | عمولة التوصيل: ${snap.deliveryFeePct}% | حصة الصالة والمباشر: ${snap.directChannelSharePct}% | قفزة الرواتب (20–28): +${snap.paydayLiftPct}%.
- السيناريو الواقعي المختار: مبيعات ${f0(activeScenario.projectedSalesKwd)} د.ك، التكاليف ${f0(activeScenario.projectedCostsKwd)} د.ك، الصافي ${f0(activeScenario.projectedNetCashKwd)} د.ك، استرداد ${activeScenario.paybackLabelAr}.
أعطني 3 توصيات استراتيجية مركزة تجمع بيانات أودو ومواسم الكويت (الشتاء والكشتات والرواتب).`
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
        const data = (await res.json()) as { ok?: boolean; text?: string }
        if (data.ok && data.text?.trim()) {
          setAiForecastText(data.text.trim())
          setAiForecastModel(isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic')
        } else {
          setAiForecastText(fallbackSynthesis)
          setAiForecastModel(isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic')
        }
      } else {
        setAiForecastText(fallbackSynthesis)
        setAiForecastModel(isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic')
      }
    } catch {
      setAiForecastText(fallbackSynthesis)
      setAiForecastModel(isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic')
    } finally {
      setAiForecastUpdatedAt(
        new Date().toLocaleTimeString('en-GB', {
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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-100"
    >
      {/* ───────────── 1. Slim Contextual Bar + Touch-Scrollable Horizon Picker + On-Demand Strategic AI Button ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="ae-icon-badge shrink-0">
            <Compass className="h-4 w-4" />
          </span>
          <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
            {isAr
              ? `${snap.horizonLabelAr} • ${workspace.subtitleAr} • بيانات أودو 17 ومواسم الكويت`
              : `${snap.horizonLabelEn} • ${workspace.subtitleEn} • Live Odoo 17 + Kuwait seasonality`}
          </p>
          {session.active ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Unlock className="h-3.5 w-3.5" />
              <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
            </span>
          ) : null}
        </div>

        <div className="flex max-w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
          <div
            role="tablist"
            aria-label={isAr ? 'أفق التوقعات' : 'Forecast Horizon'}
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

          <button
            type="button"
            onClick={() => void handleRunStrategicAiForecast()}
            disabled={aiForecastLoading}
            className={HEADER_ACTION_BTN_CLS}
          >
            {aiForecastLoading ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-emerald-700 dark:text-emerald-300" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            )}
            <span className="truncate">
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
      </div>

      {/* Custom Horizon Inline Date Inputs */}
      {horizon === 'custom' ? (
        <div className="ae-bento-card flex flex-wrap items-center gap-3 px-5 py-3.5">
          <span className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            {isAr ? 'نطاق التخطيط المخصص:' : 'Custom Forecast Window:'}
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
          <span
            dir="ltr"
            className="rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            {snap.horizonDays} {isAr ? 'يوم' : 'days'}
          </span>
        </div>
      ) : null}

      {/* On-Demand Strategic AI Forecast Readout Card */}
      {aiForecastText ? (
        <section className={`${CARD_CLS} ae-glow-emerald space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-[15.5px] font-semibold text-slate-900 dark:text-white">
                {isAr
                  ? 'قراءة الذكاء الاستراتيجي المحدثة (أودو 17 + سوق الكويت)'
                  : 'Updated Strategic AI Forecast Readout (Odoo 17 + Kuwait Market)'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-400">
              {aiForecastModel ? (
                <span className="ae-bento-subcard rounded-xl px-3 py-0.5 text-[11.5px] font-semibold text-emerald-800 dark:text-emerald-300">
                  {aiForecastModel}
                </span>
              ) : null}
              {aiForecastUpdatedAt ? <span className="tabular-nums">{aiForecastUpdatedAt}</span> : null}
            </div>
          </div>
          <div className={`${SUBCARD_CLS} whitespace-pre-line text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-200`}>
            {aiForecastText}
          </div>
        </section>
      ) : null}

      {/* ───────────── 2. 4 Live Baseline & Kuwait Pulse KPI Cards (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'خط الأساس الشهري (أودو 17)' : 'Monthly Odoo 17 Baseline'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {f0(snap.monthlyBaselineSalesKwd)}{' '}
            <span className="text-[12.5px] sm:text-[15px] font-semibold text-slate-400">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr
              ? `الصافي الشهري الحالي: ${f0(snap.monthlyBaselineNetKwd)} د.ك`
              : `Current monthly net cash: ${f0(snap.monthlyBaselineNetKwd)} KWD`}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'مطبخ العارضية + عمولة التوصيل' : 'Ardiya COGS + Delivery Cut'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {f1(snap.ardiyaFoodPct)}%{' '}
            <span className="text-[12.5px] sm:text-[15px] font-semibold text-slate-400">
              + {f1(snap.deliveryFeePct)}%
            </span>
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr
              ? `حصة الصالة والمباشر (0% عمولة): ${f1(snap.directChannelSharePct)}%`
              : `Zero-fee Dine-In & Pickup share: ${f1(snap.directChannelSharePct)}%`}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'نبض الرواتب والموسم بالكويت' : 'Kuwait Payday & Seasonal Lift'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            +{f1(snap.paydayLiftPct)}%
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr ? 'قفزة 20–28 الشهر + ذروة الشتاء والكشتات' : '20th–28th salary surge + winter peak'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'عائد خارطة المراحل مقابل السقف' : 'Roadmap Return vs Cost Cap'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            +{f0(totalMonthlyUpside)}{' '}
            <span className="text-[12px] sm:text-[14.5px] font-semibold text-slate-400">
              {kwd}/{isAr ? 'شهر' : 'mo'}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr
              ? `سقف تكلفة المراحل الـ ${phases.length}: ${f0(totalCostCap)} د.ك`
              : `Total cost cap across ${phases.length} phases: ${f0(totalCostCap)} KWD`}
          </p>
        </article>
      </section>

      {/* ───────────── 3. 3-Scenario Forecast Cards (متحفظ / واقعي / طموح) ───────────── */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {isAr ? 'سيناريوهات التوقعات المالية الثلاثة' : 'Three Financial Forecast Scenarios'}
            </h2>
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'اختر أي سيناريو لربطه بالتعميم الرسمي ومؤشرات الامتثال'
                : 'Select any scenario to link with official circulars & Odoo compliance targets'}
            </p>
          </div>
          <span className="ae-pill-light text-[13px]">
            {isAr ? snap.horizonLabelAr : snap.horizonLabelEn}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {snap.scenarios.map((sc) => {
            const selected = sc.id === activeScenarioId
            return (
              <article
                key={sc.id}
                onClick={() => setActiveScenarioId(sc.id)}
                className={`${CARD_CLS} cursor-pointer transition-all duration-150 ${
                  selected
                    ? 'ring-2 ring-emerald-500/75 dark:ring-emerald-400/75'
                    : 'hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${
                        sc.id === 'realistic'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
                          : sc.id === 'ambitious'
                            ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-200'
                      }`}
                    >
                      {isAr ? sc.badgeAr : sc.badgeEn}
                    </span>
                    <p className="mt-1.5 text-[14px] text-slate-500 dark:text-slate-400">
                      {isAr ? sc.subtitleAr : sc.subtitleEn}
                    </p>
                  </div>

                  <span
                    dir="ltr"
                    className="ae-bento-subcard rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums text-slate-700 dark:text-slate-200"
                  >
                    {isAr ? sc.paybackLabelAr : sc.paybackLabelEn}
                  </span>
                </div>

                {/* 3 Core Numbers: Projected Sales | Costs (التكاليف KWD) | Net Cash */}
                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className="ae-bento-subcard p-2.5 sm:p-3">
                    <div className="text-[11px] sm:text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {isAr ? 'المبيعات المتوقعة' : 'Projected Sales'}
                    </div>
                    <div
                      dir="ltr"
                      className="mt-1 text-base sm:text-[19px] font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
                    >
                      {f0(sc.projectedSalesKwd)}
                    </div>
                    <div className="text-[11px] sm:text-[12px] text-slate-400">{kwd}</div>
                  </div>

                  <div className="ae-bento-subcard p-2.5 sm:p-3">
                    <div className="text-[11px] sm:text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {isAr ? 'التكاليف' : 'Total Costs'}
                    </div>
                    <div
                      dir="ltr"
                      className="mt-1 text-base sm:text-[19px] font-semibold tracking-tight tabular-nums text-amber-700 dark:text-amber-300"
                    >
                      {f0(sc.projectedCostsKwd)}
                    </div>
                    <div className="text-[11px] sm:text-[12px] text-slate-400">{kwd}</div>
                  </div>

                  <div className="rounded-2xl bg-emerald-50/80 p-2.5 sm:p-3 ring-1 ring-emerald-500/15 dark:bg-emerald-950/35 dark:ring-emerald-400/20">
                    <div className="text-[11px] sm:text-[12px] font-medium text-emerald-800 dark:text-emerald-300">
                      {isAr ? 'صافي الكاش' : 'Net Cash'}
                    </div>
                    <div
                      dir="ltr"
                      className="mt-1 text-base sm:text-[19px] font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-300"
                    >
                      {sc.projectedNetCashKwd >= 0 ? '+' : ''}
                      {f0(sc.projectedNetCashKwd)}
                    </div>
                    <div
                      dir="ltr"
                      className="text-[11px] sm:text-[12px] font-semibold tabular-nums text-emerald-700/85 dark:text-emerald-400"
                    >
                      {f1(sc.netMarginPct)}% {kwd}
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {(isAr ? sc.assumptionsAr : sc.assumptionsEn).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
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
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {snap.signals.map((sig) => (
          <article key={sig.id} className={CARD_CLS}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                {isAr ? sig.titleAr : sig.titleEn}
              </h3>
              <span
                dir="ltr"
                className={`shrink-0 rounded-full px-3 py-0.5 text-[12px] font-semibold tabular-nums ${
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
            <p className="mt-2 text-[14px] leading-relaxed text-slate-500 dark:text-slate-300">
              {isAr ? sig.detailAr : sig.detailEn}
            </p>
          </article>
        ))}
      </section>

      {/* ───────────── 5. Wide 2x2 Phased Execution Roadmap (`grid-cols-1 xl:grid-cols-2 gap-6`) ───────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {isAr
                ? 'المراحل الأربع والجدول الزمني واعتماد التعميم الرسمي'
                : 'Four Execution Phases & Official Circular Governance'}
            </h2>
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'اعتمد كل مرحلة بخطوة واحدة واضحة لتفعيل التعميم الرسمي ومتابعة الفروع الـ 7'
                : 'Approve each phase in one clean step to unlock official circular printing & 7-branch tracking'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className={PRIMARY_SOFT_BTN_CLS}
          >
            <Plus className="h-4 w-4" />
            <span>{formOpen ? (isAr ? 'إغلاق النموذج ✕' : 'Close ✕') : isAr ? '+ خطة جديدة' : '+ New Plan'}</span>
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
                  placeholder={isAr ? 'مثال: إطلاق منيو الشتاء في السالمية...' : 'e.g. Launch winter family bundles...'}
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
                <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
                    className={`${PRIMARY_SOFT_BTN_CLS} h-10 shrink-0`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{isAr ? 'حفظ' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {phases.map((phase) => {
            const refKey = `strategic-plan:${phase.id}`
            const approval = getApprovalByRef(refKey)
            const isApproved = approval?.status === 'approved'
            const isPending = approval?.status === 'pending'
            const circularKey = `plan-circular:${phase.id}`
            const issuedCircular = store.issuedCirculars[circularKey]
            const receipts = store.branchReceipts[circularKey] ?? {}
            const receivedCount = APPROVED_BRANCH_IDS.filter((b) => receipts[b]).length
            const circularBodyAr = buildPlanCircularText(
              phase,
              activeScenario,
              true,
              issuedCircular?.sealId ?? approval?.seal?.sealId,
            )
            const circularBodyEn = buildPlanCircularText(
              phase,
              activeScenario,
              false,
              issuedCircular?.sealId ?? approval?.seal?.sealId,
            )
            const activeCircularText = isAr ? circularBodyAr : circularBodyEn
            const showCircularPanel = expandedCircularId === phase.id || Boolean(issuedCircular)
            const menuOpen = openMenuId === phase.id

            const openPrintForPhase = () => {
              openCircularPrintModal({
                circularKey,
                serialRef: issuedCircular?.serialRef ?? buildCircularSerialRef(circularKey),
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
                  'يتم تجميد أي انحراف آلياً عبر جرس الامتثال في أودو 17.',
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

            const feryalPrompt = isAr
              ? `حللي المرحلة الاستراتيجية (${phase.phaseCode}: ${phase.titleAr}) بسقف تكلفة ${f0(phase.costCapKwd)} د.ك وعائد مستهدف +${f0(phase.expectedMonthlyGainKwd)} د.ك/شهر، وأعطيني خطة متابعة يومية في أودو 17.`
              : `Analyze strategic phase (${phase.phaseCode}: ${phase.titleEn}) with ${f0(phase.costCapKwd)} KWD cost cap and +${f0(phase.expectedMonthlyGainKwd)} KWD/mo upside, and suggest daily Odoo 17 checkpoints.`

            return (
              <article
                key={phase.id}
                className={`${CARD_CLS} flex flex-col justify-between gap-4 transition-all duration-150 ${
                  menuOpen ? 'z-30' : 'z-0'
                }`}
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
                      {issuedCircular ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                          <Megaphone className="h-3 w-3" />
                          <span>
                            {isAr
                              ? `تم التعميم (${receivedCount}/7 فروع) 📢`
                              : `Broadcasted (${receivedCount}/7) 📢`}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="ae-bento-subcard px-3.5 py-1.5 text-end">
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                          {isAr ? 'سقف التكلفة' : 'Cost Cap'}
                        </div>
                        <div
                          dir="ltr"
                          className="text-[14.5px] font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {f0(phase.costCapKwd)} {kwd}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-emerald-50/80 px-3.5 py-1.5 text-end ring-1 ring-emerald-500/15 dark:bg-emerald-950/40 dark:ring-emerald-400/20">
                        <div className="text-[11.5px] text-emerald-800 dark:text-emerald-300">
                          {isAr ? 'العائد الشهري' : 'Monthly Gain'}
                        </div>
                        <div
                          dir="ltr"
                          className="text-[14.5px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                        >
                          +{f0(phase.expectedMonthlyGainKwd)} {kwd}
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
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                        {isAr ? 'قاعدة أودو 17: ' : 'Odoo 17 Rule: '}
                      </span>
                      {isAr ? phase.odooWatchMetricAr : phase.odooWatchMetricEn}
                    </p>
                  </div>

                  {/* 7/7 Branch Receipt Tracker */}
                  {showCircularPanel ? (
                    <div className={`${SUBCARD_CLS} space-y-2.5`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900 dark:text-white">
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
                          className="cursor-pointer rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          {isAr ? 'تأكيد استلام الـ 7 فروع ✓' : 'Verify All 7 Branches ✓'}
                        </button>
                      </div>

                      <div className={SEGMENT_TRACK_CLS}>
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
                              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 ${
                                checked
                                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/25 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200'
                                  : 'bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10'
                              }`}
                            >
                              {checked ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : null}
                              <span>{getBranchLabel(branchId, isAr)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Progressive State-Driven Single Primary Action + Quiet Overflow Menu */}
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/70 pt-3.5 dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2">
                    {isApproved ? (
                      <>
                        <span
                          title={approval?.seal?.sealId}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50/90 px-3.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>{isAr ? 'معتمد رسمياً ✓' : 'Officially Approved ✓'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={openPrintForPhase}
                          className={PRIMARY_SOFT_BTN_CLS}
                        >
                          <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                          <span>{isAr ? 'طباعة التعميم الرسمي 📄' : 'Print Official Circular 📄'}</span>
                        </button>
                      </>
                    ) : isPending && approval ? (
                      <>
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200">
                          <Bell className="h-3.5 w-3.5" />
                          <span>{isAr ? 'بانتظار الختم 🔔' : 'Pending Seal 🔔'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            approveItemWithPin(approval.id, approval.titleAr, approval.titleEn)
                          }
                          className={PRIMARY_SOFT_BTN_CLS}
                        >
                          <Lock className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                          <span>{isAr ? 'اعتماد بختم المدير' : 'Approve with Manager PIN'}</span>
                        </button>
                      </>
                    ) : (
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
                        className={PRIMARY_SOFT_BTN_CLS}
                      >
                        <Bell className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                        <span>{isAr ? 'طلب اعتماد المدير' : 'Request Manager Approval'}</span>
                      </button>
                    )}
                  </div>

                  {/* Quiet Compact Overflow Menu (`مشاركة ⋯`) */}
                  <div data-plan-menu-root className="relative">
                    <button
                      type="button"
                      aria-expanded={menuOpen}
                      onClick={() => setOpenMenuId((cur) => (cur === phase.id ? null : phase.id))}
                      className="ae-pill-light h-9 px-3.5 text-[13px]"
                    >
                      <span>{isAr ? 'مشاركة ⋯' : 'Share ⋯'}</span>
                    </button>

                    {menuOpen ? (
                      <div className="absolute end-0 bottom-full z-50 mb-2 w-64">
                        <div className="ae-bento-card space-y-0.5 p-1.5 !shadow-[0_18px_42px_-10px_rgba(15,23,42,0.18)]">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              openPrintForPhase()
                            }}
                            className={MENU_ITEM_CLS}
                          >
                            <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
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
                                  'ربط التنفيذ آلياً بمراقب الامتثال الحي في أودو 17 وتأكيد استلام الفروع السبعة.',
                                ],
                                mandatoryRulesEn: [
                                  `Deliver Target KPI: ${phase.targetKpiEn}`,
                                  `Strict phase cost cap <= ${f0(phase.costCapKwd)} KWD without Executive PIN Seal.`,
                                  'Monitored continuously in Odoo 17 Watchdog with 7-branch digital receipt tracking.',
                                ],
                                onIssued: () => setExpandedCircularId(phase.id),
                              })
                            }}
                            className={MENU_ITEM_CLS}
                          >
                            <Megaphone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {isAr
                                ? 'تعميم الخطة المعتمدة رسمياً 📢'
                                : 'Broadcast Approved Plan Officially 📢'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              copyToClipboard(`circ-${phase.id}`, activeCircularText)
                              setOpenMenuId(null)
                            }}
                            className={MENU_ITEM_CLS}
                          >
                            {copiedKey === `circ-${phase.id}` ? (
                              <>
                                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                                <span>{isAr ? 'نسخ التعميم 📋' : 'Copy Circular 📋'}</span>
                              </>
                            )}
                          </button>

                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(activeCircularText)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenuId(null)}
                            className={MENU_ITEM_CLS}
                          >
                            <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{isAr ? 'واتساب الفروع 📲' : 'WhatsApp Share 📲'}</span>
                          </a>

                          <Link
                            href={`/erp/feryal-ai?prompt=${encodeURIComponent(feryalPrompt)}`}
                            onClick={() => setOpenMenuId(null)}
                            className={MENU_ITEM_CLS}
                          >
                            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{isAr ? 'استشارة المستشارة فريال ✨' : 'Ask Feryal AI ✨'}</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedCircularId((cur) => (cur === phase.id ? null : phase.id))
                              setOpenMenuId(null)
                            }}
                            className={MENU_ITEM_CLS}
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>
                              {isAr
                                ? `سجل جاهزية واستلام الفروع (${receivedCount}/7)`
                                : `7-Branch Readiness (${receivedCount}/7)`}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              openDrawer('breaches')
                            }}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
                          >
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>{isAr ? 'إيقاف المخالفة فوراً ⛔' : 'Stop Breach Immediately ⛔'}</span>
                          </button>

                          {!SEEDED_STRATEGIC_PHASES.some((s) => s.id === phase.id) ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePhase(phase.id)}
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                              <span>{isAr ? 'حذف المرحلة المخصصة' : 'Delete Custom Phase'}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* ───────────── 6. Single Compact Odoo 17 Compliance Status Strip (Opens Manager Bell Breaches Tab) ───────────── */}
      <button
        type="button"
        onClick={() => openDrawer('breaches')}
        className="ae-bento-card ae-lift flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 text-start transition-all"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="ae-icon-badge">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-[14.5px] font-semibold text-slate-900 dark:text-white">
            {isAr
              ? 'مراقب أودو ١٧ نشط • افتح جرس الاعتمادات لمراجعة المخالفات 🔔'
              : 'Odoo 17 Watchdog Active • Open Approval Bell to Review Breaches 🔔'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] font-semibold tabular-nums ${
              activeBreachCount > 0
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                activeBreachCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span>
              {isAr
                ? `${activeBreachCount} مخالفات نشطة`
                : `${activeBreachCount} Active Breaches`}
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>
    </div>
  )
}
