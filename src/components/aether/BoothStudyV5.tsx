'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  XCircle,
} from 'lucide-react'
import { analyzeEventContractWithGemini, type ContractDeepAuditResult } from '@/lib/feryal-gemini-brain'
import { BRANDS, EXB_UNIT, LEDGER } from '@/lib/aether/ledger'
import { APPROVED_BRAND_IDS, GLOBAL_BRAND_OPTIONS } from '@/lib/aether/global-filter-engine'
import {
  InteractiveDonutChart,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { buildCircularSerialRef } from '@/lib/governance-compliance'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import { useLang } from '@/components/aether/ui'

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: readonly { id: K; label: string }[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
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
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

type BoothPreset = 'month30' | 'weekend4' | 'season90' | 'custom'

const card = 'ae-bento-card p-6'
const input =
  'ae-bento-subcard w-full rounded-xl px-3.5 py-2.5 text-[14px] font-semibold text-slate-900 transition duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-white'

const APPROVED_SET = new Set<string>(APPROVED_BRAND_IDS)
const BOOTH_BRAND_OPTIONS = GLOBAL_BRAND_OPTIONS.filter((b) => b.id !== 'all')

// Odoo calibration: exhibitions unit (registers 26–29) and approved Venture Foods brand baskets
const EXB = ODOO.exhibitions[0]
const EXB_REVENUE = EXB?.pnl ? EXB.pnl.income + EXB.pnl.otherIncome : 0
const EXB_COGS_PCT = EXB_REVENUE ? ((EXB?.pnl?.cogs ?? 0) / EXB_REVENUE) * 100 : LEDGER.cogsPct
const EXB_OPEX_PCT = EXB_REVENUE ? ((EXB?.pnl?.expense ?? 0) / EXB_REVENUE) * 100 : 0
const EXB_DAILY_ORDERS = Math.max(1, Math.round((EXB_UNIT?.orders ?? 0) / LEDGER.daysInPeriod))
const RAW_LEADER = [...(EXB?.brands ?? [])]
  .filter((b) => APPROVED_SET.has(b.brand))
  .sort((a, b) => b.netKwd - a.netKwd)[0]?.brand
const DEFAULT_BOOTH_BRAND = RAW_LEADER && APPROVED_SET.has(RAW_LEADER) ? RAW_LEADER : 'china-garden'

const brandBasket = (brandId: string) => {
  const atExb = EXB?.brands.find((b) => b.brand === brandId)
  if (atExb && atExb.orders > 0) return { basket: atExb.netKwd / atExb.orders, source: 'exb' as const }
  const b = BRANDS.find((x) => x.id === brandId)
  return { basket: b?.aov ?? LEDGER.aov, source: 'brand' as const }
}

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

/** Ultra-simple Booth Calculator (`/erp/booth-feasibility` & `/erp/events-intelligence`). */
export function BoothStudyV5() {
  const { isAr, T } = useLang()
  const gov = useGovernance()
  const [preset, setPreset] = useState<BoothPreset>('month30')
  const [eventName, setEventName] = useState('')
  const [startDate, setStartDate] = useState('2026-11-20')
  const [endDate, setEndDate] = useState('2026-12-19')
  const [days, setDays] = useState(30)
  const [rent, setRent] = useState(3000)
  const [setup, setSetup] = useState(800)
  const [staff, setStaff] = useState(0)
  const [foodCostPct, setFoodCostPct] = useState<number>(Math.round(EXB_COGS_PCT * 10) / 10)
  const [dailyOrders, setDailyOrders] = useState(EXB_DAILY_ORDERS)
  const [brandId, setBrandId] = useState<string>(DEFAULT_BOOTH_BRAND)
  const [contract, setContract] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [audit, setAudit] = useState<ContractDeepAuditResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [boothSubmittedFlash, setBoothSubmittedFlash] = useState(false)

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

  const kwd = useCallback((n: number) => (isAr ? `${f0(n)} د.ك` : `${f0(n)} KWD`), [isAr])
  const brandOpt = BOOTH_BRAND_OPTIONS.find((b) => b.id === brandId) ?? BOOTH_BRAND_OPTIONS[0]
  const { basket } = brandBasket(brandId)

  const model = useMemo(() => {
    const variablePct = Math.min(0.92, Math.max(0.05, (foodCostPct + EXB_OPEX_PCT) / 100))
    const gpPerOrder = basket * (1 - variablePct)
    const fixed = rent + setup + staff
    const breakEven = days > 0 && gpPerOrder > 0 ? fixed / days / gpPerOrder : Infinity
    const scenarios = [
      { id: 'low', en: 'Conservative (60%)', ar: 'تحفظي (60%)', factor: 0.6 },
      { id: 'base', en: 'Base (100%)', ar: 'الأساسي (100%)', factor: 1 },
      { id: 'high', en: 'Upside (130%)', ar: 'متفائل (130%)', factor: 1.3 },
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

  const quickMenu = useMemo(
    () =>
      ODOO.menu
        .filter((m) => m.brand === brandId && m.qty > 0 && m.netKwd > 0 && !/drink|beverage|sauce|extra/i.test(m.category))
        .sort((a, b) => (/^EXB/i.test(b.category) ? 1 : 0) - (/^EXB/i.test(a.category) ? 1 : 0) || b.qty - a.qty)
        .slice(0, 6),
    [brandId],
  )

  const runAudit = async () => {
    setBusy(true)
    try {
      const attachmentBase64 = file ? await toBase64(file) : undefined
      const res = await analyzeEventContractWithGemini({
        contractText: contract,
        eventDescription: description,
        executiveVision: `${brandOpt.en} ${brandOpt.ar}`,
        eventName: eventName || T('Booth', 'معرض موسمي'),
        durationDays: days,
        boothRentKwd: rent,
        attachmentBase64: attachmentBase64 || undefined,
        attachmentMimeType: file?.type || undefined,
        lang: isAr ? 'ar' : 'en',
      })
      setAudit(res)
    } finally {
      setBusy(false)
    }
  }

  const verdictUi = {
    go: {
      icon: <CheckCircle2 className="h-6 w-6" />,
      en: 'Enter (Profitable)',
      ar: 'ادخل (مربح)',
      cls: 'bg-emerald-50 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-100',
    },
    conditional: {
      icon: <Scale className="h-6 w-6" />,
      en: 'Negotiate Rent',
      ar: 'فاوض الإيجار',
      cls: 'bg-amber-50 text-amber-900 ring-amber-500/25 dark:bg-amber-950/40 dark:text-amber-100',
    },
    walk: {
      icon: <XCircle className="h-6 w-6" />,
      en: 'Skip (Loss)',
      ar: 'لا تدخل (خاسر)',
      cls: 'bg-rose-50 text-rose-900 ring-rose-500/25 dark:bg-rose-950/40 dark:text-rose-100',
    },
  }[model.verdict]

  const base = model.scenarios[1]
  const low = model.scenarios[0]
  const be = Number.isFinite(model.breakEven) ? model.breakEven : 0

  const scenarioChartData: MultiSeriesBarDatum[] = useMemo(
    () =>
      model.scenarios.map((s) => ({
        id: s.id,
        label: isAr ? s.ar : s.en,
        tooltipTitle: isAr ? s.ar : s.en,
        primaryValue: Math.max(0, s.revenue),
        secondaryValue: Math.max(0, s.profit),
        badgeText: `${s.profit >= 0 ? '+' : ''}${f0(s.roi)}%`,
        badgeTone: s.profit > 0 ? 'emerald' : s.profit === 0 ? 'amber' : 'rose',
        lines: [
          { label: T('Orders', 'الطلبات'), value: f0(s.orders), tone: 'neutral' },
          { label: T('Sales', 'المبيعات'), value: kwd(s.revenue), tone: 'neutral', bold: true },
          { label: T('Fixed Cost', 'التكاليف الثابتة'), value: kwd(model.fixed), tone: 'slate' },
          {
            label: T('Net Profit', 'الصافي'),
            value: `${s.profit >= 0 ? '+' : '-'}${kwd(Math.abs(s.profit))}`,
            tone: s.profit >= 0 ? 'emerald' : 'rose',
            bold: true,
          },
        ],
      })),
    [isAr, kwd, model.fixed, model.scenarios, T],
  )

  const boothDonutSlices: DonutSliceDatum[] = useMemo(() => {
    const revBase = Math.max(1, base.revenue)
    const varCost = Math.max(0, base.revenue - base.gp)
    const rentVal = Math.max(0, rent)
    const setupStaffVal = Math.max(0, setup + staff)
    const netVal = Math.max(0, base.profit)
    const pct = (v: number) => `${f1((v / revBase) * 100)}%`

    return [
      {
        id: 'net',
        label: T('Net Profit', 'الصافي بالجيب'),
        value: netVal,
        valueFormatted: kwd(netVal),
        pctFormatted: pct(netVal),
        color: '#10B981',
      },
      {
        id: 'var',
        label: T('Food & Ops', 'المواد والتشغيل'),
        value: varCost,
        valueFormatted: kwd(varCost),
        pctFormatted: pct(varCost),
        color: '#0EA5E9',
      },
      {
        id: 'rent',
        label: T('Booth Rent', 'إيجار البوث'),
        value: rentVal,
        valueFormatted: kwd(rentVal),
        pctFormatted: pct(rentVal),
        color: '#F59E0B',
      },
      {
        id: 'setup',
        label: T('Setup & Staff', 'التجهيز والطاقم'),
        value: setupStaffVal,
        valueFormatted: kwd(setupStaffVal),
        pctFormatted: pct(setupStaffVal),
        color: '#64748B',
      },
    ]
  }, [base.gp, base.profit, base.revenue, kwd, rent, setup, staff, T])

  const pros = [
    be > 0 &&
      be <= dailyOrders * 0.6 &&
      T(
        `You cover costs at just ${f0(be)} orders/day.`,
        `تغطي كل التكاليف عند ${f0(be)} طلب باليوم فقط.`,
      ),
    model.rentShare > 0 &&
      model.rentShare <= 20 &&
      T(
        `Rent is a safe ${f1(model.rentShare)}% of expected sales.`,
        `الإيجار يمثل ${f1(model.rentShare)}% فقط من المبيعات المتوقعة.`,
      ),
    base.profit > 0 &&
      T(
        `Expected net profit is ${kwd(base.profit)}.`,
        `الربح الصافي المتوقع ${kwd(base.profit)}.`,
      ),
  ].filter(Boolean) as string[]

  const risks = [
    be > dailyOrders &&
      T(
        `Needs ${f0(be)} orders/day, higher than ${f0(dailyOrders)} expected.`,
        `يحتاج ${f0(be)} طلب يومياً لتغطية التكلفة وهو أعلى من المتوقع.`,
      ),
    low.profit < 0 &&
      T(
        `If traffic is slow, you lose ${kwd(-low.profit)}.`,
        `لو الإقبال ضعيف ستخسر ${kwd(-low.profit)}.`,
      ),
    model.rentShare > 25 &&
      T(
        `Rent eats ${f1(model.rentShare)}% of sales.`,
        `الإيجار يأكل ${f1(model.rentShare)}% من المبيعات.`,
      ),
  ].filter(Boolean) as string[]

  const high = model.scenarios[2]
  const resolvedEventName =
    eventName.trim() || (isAr ? `معرض ${brandOpt.ar} الموسمي` : `${brandOpt.en} Pop-Up Booth`)
  const totalBoothBudgetKwd = Math.max(
    100,
    Math.round(model.fixed + base.revenue * (foodCostPct / 100)),
  )
  const dailyCostCapKwd = Math.max(10, Math.round(totalBoothBudgetKwd / Math.max(1, days)))
  const exbActualSpendKwd = Math.round((EXB?.pnl?.cogs ?? 1820) + (EXB?.pnl?.expense ?? 2490))
  const exbActualDailyCostKwd = Math.round(exbActualSpendKwd / 30)
  const beCoveragePct = be > 0 ? Math.min(100, Math.round((dailyOrders / be) * 100)) : 100

  const boothRefKey = `booth:${brandId}:${startDate}`
  const boothApproval = gov.getApprovalByRef(boothRefKey)
  const allApprovedBoothRules = gov.store.approvedRuleCaps?.boothExbPlans ?? {}
  const lockedBoothCap =
    allApprovedBoothRules[boothRefKey] ?? Object.values(allApprovedBoothRules)[0]
  const boothBreaches = useMemo(
    () => gov.breaches.filter((b) => b.category === 'exb-budget-cap'),
    [gov.breaches],
  )

  const handleRequestBoothApproval = () => {
    gov.requestApproval({
      refKey: boothRefKey,
      domain: 'booth-exb',
      titleAr: `مشاركة معرض (${resolvedEventName}) — ${brandOpt.ar} (${startDate} ← ${endDate})`,
      titleEn: `Booth Participation (${resolvedEventName}) — ${brandOpt.en} (${startDate} -> ${endDate})`,
      summaryAr: `المدة ${days} يوم · إيجار ${f0(rent)} د.ك · سقف ميزانية المعرض ${f0(totalBoothBudgetKwd)} د.ك (${f0(dailyCostCapKwd)} د.ك/يوم) · الصافي المتوقع ${base.profit >= 0 ? '+' : '-'}${f0(Math.abs(base.profit))} د.ك.`,
      summaryEn: `${days} days · Rent ${f0(rent)} KWD · Total Budget Cap ${f0(totalBoothBudgetKwd)} KWD (${f0(dailyCostCapKwd)} KWD/day) · Expected Net ${base.profit >= 0 ? '+' : '-'}${f0(Math.abs(base.profit))} KWD.`,
      departmentAr: 'المعارض والمشاركات الموسمية (EXB)',
      departmentEn: 'Exhibitions & Pop-Up Unit (EXB)',
      budgetOrCostKwd: totalBoothBudgetKwd,
      expectedMonthlyReturnKwd: Math.round(base.profit),
      href: '/erp/booth-feasibility',
      meta: {
        boothCap: {
          eventName: resolvedEventName,
          brandId,
          brandAr: brandOpt.ar,
          brandEn: brandOpt.en,
          startDate,
          endDate,
          days,
          totalBudgetCapKwd: totalBoothBudgetKwd,
          dailyCostCapKwd,
          rentKwd: rent,
          foodCostCapPct: foodCostPct,
          expectedNetKwd: Math.round(base.profit),
        },
      },
    })
    setBoothSubmittedFlash(true)
    setTimeout(() => setBoothSubmittedFlash(false), 3000)
  }

  const handlePrintBoothCircular = () => {
    const activeRule = lockedBoothCap ?? {
      refKey: boothRefKey,
      eventName: resolvedEventName,
      brandId,
      brandAr: brandOpt.ar,
      brandEn: brandOpt.en,
      startDate,
      endDate,
      days,
      totalBudgetCapKwd: totalBoothBudgetKwd,
      dailyCostCapKwd,
      rentKwd: rent,
      foodCostCapPct: foodCostPct,
      expectedNetKwd: Math.round(base.profit),
      sealId: boothApproval?.seal?.sealId,
      approvedAtIso: boothApproval?.seal?.approvedAtIso ?? new Date().toISOString(),
    }
    const circularKey = `circular:${activeRule.refKey}`
    const issued = gov.store.issuedCirculars[circularKey]

    gov.openCircularPrintModal({
      circularKey,
      serialRef: issued?.serialRef || buildCircularSerialRef(circularKey),
      kind: 'booth-plan',
      titleAr: `تعميم خطة المشاركة وسقف ميزانية معرض (${activeRule.eventName}) — ${activeRule.brandAr}`,
      titleEn: `Official Booth Plan & Budget Cap Circular (${activeRule.eventName}) — ${activeRule.brandEn}`,
      classificationAr: 'تعميم تشغيلي ومالي ملزم لوحدة المعارض EXB',
      classificationEn: 'Mandatory Exhibition & Pop-Up Operations Circular (EXB)',
      scopeAr: `وحدة المعارض (EXB ٢٦–٢٩) · ${activeRule.brandAr} · مطبخ العارضية المركزي`,
      scopeEn: `Exhibitions Unit (EXB 26–29) · ${activeRule.brandEn} · Ardiya Central Kitchen`,
      issuedAtIso: issued?.issuedAtIso || activeRule.approvedAtIso,
      effectiveWindow: `${activeRule.startDate} -> ${activeRule.endDate} (${activeRule.days} ${isAr ? 'يوم' : 'days'})`,
      sealId: issued?.sealId || activeRule.sealId,
      financialSummaryAr: `سقف ميزانية المعرض المعتمدة: ${f0(activeRule.totalBudgetCapKwd)} د.ك (${f0(activeRule.dailyCostCapKwd)} د.ك/يوم) · الصافي المستهدف: ${activeRule.expectedNetKwd >= 0 ? '+' : '-'}${f0(Math.abs(activeRule.expectedNetKwd))} د.ك`,
      financialSummaryEn: `Approved Booth Budget Cap: ${f0(activeRule.totalBudgetCapKwd)} KWD (${f0(activeRule.dailyCostCapKwd)} KWD/day) · Target Net: ${activeRule.expectedNetKwd >= 0 ? '+' : '-'}${f0(Math.abs(activeRule.expectedNetKwd))} KWD`,
      mandatoryRulesAr: [
        `فترة التشغيل المعتمدة من ${activeRule.startDate} إلى ${activeRule.endDate} (${activeRule.days} يوم) بحد إيجار أقصى ${f0(activeRule.rentKwd)} د.ك.`,
        `سقف إجمالي الصرف المعتمد (ثابت + تموين مواد) لا يتجاوز ${f0(activeRule.totalBudgetCapKwd)} د.ك وبحد يومي أقصى ${f0(activeRule.dailyCostCapKwd)} د.ك/يوم على كاشيرات أودو (EXB ٢٦–٢٩).`,
        `سقف تكلفة المواد الخام المسحوبة من مطبخ العارضية المركزي لا يتجاوز ${f1(activeRule.foodCostCapPct)}% من مبيعات المعرض.`,
        'أي تجاوز للسقف المعتمد على كاشيرات أودو EXB يُفعّل تنبيه مخالفة فوري وأمر تجميد صرف بختم المدير.',
      ],
      mandatoryRulesEn: [
        `Authorized operating window: ${activeRule.startDate} to ${activeRule.endDate} (${activeRule.days} days) with rent locked at ${f0(activeRule.rentKwd)} KWD.`,
        `Total booth spend cap (fixed + COGS) strictly capped at ${f0(activeRule.totalBudgetCapKwd)} KWD and ${f0(activeRule.dailyCostCapKwd)} KWD/day across Odoo EXB registers 26–29.`,
        `Food cost drawn from Ardiya Central Kitchen must not exceed ${f1(activeRule.foodCostCapPct)}% of booth revenue.`,
        'Any spend overrun on Odoo EXB triggers an immediate Watchdog violation alert and PIN-locked spend freeze.',
      ],
    })
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-10">
      {/* Finance V2 × Verdelo Executive Masthead */}
      <header className="ae-bento-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
            {T('Booth Calculator', 'حاسبة المعارض')}
          </h1>
          <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              'Calculate booth profit or loss before signing the contract.',
              'احسب ربح أو خسارة أي معرض موسمي قبل توقيع العقد.',
            )}
          </p>
        </div>

        <EmeraldPillTabs<BoothPreset>
          value={preset}
          onChange={applyPreset}
          size="sm"
          ariaLabel={T('Booth Duration Preset', 'قوالب مدة المعرض')}
          options={[
            { id: 'month30', label: T('30-Day Expo', 'معرض ٣٠ يوم') },
            { id: 'weekend4', label: T('4-Day Weekend', 'ويكند ٤ أيام') },
            { id: 'season90', label: T('90-Day Season', 'موسم ٩٠ يوم') },
            { id: 'custom', label: T('Custom', 'مخصص') },
          ]}
        />
      </header>

      {/* 4 Top KPI Summary Cards (Finance V2 × Verdelo Micro-Lift) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ae-kpi-card p-5">
          <div className="flex items-center justify-between gap-2 text-[13.5px] font-bold text-slate-500 dark:text-slate-400">
            <span>{T('Decision', 'قرار الدخول')}</span>
            <span
              className={
                model.verdict === 'go'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : model.verdict === 'conditional'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }
            >
              {verdictUi.icon}
            </span>
          </div>
          <div className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-950 sm:text-[30px] dark:text-white">
            {isAr ? verdictUi.ar : verdictUi.en}
          </div>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            {isAr ? `${brandOpt.ar} • ${days} يوم` : `${brandOpt.en} • ${days} days`}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="text-[13.5px] font-bold text-slate-500 dark:text-slate-400">
            {T('Expected Net', 'الصافي المتوقع')}
          </div>
          <div
            dir="ltr"
            className={`mt-2 text-[28px] font-extrabold tabular-nums sm:text-[32px] ${
              base.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {base.profit >= 0 ? '+' : '-'}
            {kwd(Math.abs(base.profit))}
          </div>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            {T(`Sales ${kwd(base.revenue)}`, `من إجمالي مبيعات ${kwd(base.revenue)}`)}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="text-[13.5px] font-bold text-slate-500 dark:text-slate-400">
            {T('Break-Even', 'طلبات التعادل')}
          </div>
          <div className="mt-2 text-[28px] font-extrabold tabular-nums text-slate-950 sm:text-[32px] dark:text-white">
            {be ? `${f0(be)} ${T('orders/day', 'طلب/يوم')}` : '—'}
          </div>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            {T(`Order profit ${f3(model.gpPerOrder)} KWD`, `ربح الطلب الواحد ${f3(model.gpPerOrder)} د.ك`)}
          </p>
        </div>

        <div className="ae-kpi-card p-5">
          <div className="text-[13.5px] font-bold text-slate-500 dark:text-slate-400">
            {T('Safe Rent Limit', 'أعلى إيجار مناسب')}
          </div>
          <div dir="ltr" className="mt-2 text-[28px] font-extrabold tabular-nums text-slate-950 sm:text-[32px] dark:text-white">
            {kwd(model.rentCeiling)}
          </div>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            {rent > model.rentCeiling
              ? T(`Ask ${kwd(rent - model.rentCeiling)} off`, `فاوض لتخفيض ${kwd(rent - model.rentCeiling)}`)
              : T('Rent is within safe limit', 'الإيجار الحالي ضمن السقف الآمن')}
          </p>
        </div>
      </section>

      {/* Finance V2 Bento Split: 8-Col Skerry Capsule Scenarios + 4-Col Cost Donut */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="ae-bento-card space-y-4 p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                {T('Traffic Scenarios', 'مقارنة حالات الإقبال')}
              </h2>
              <p className="text-xs text-neutral-400 dark:text-slate-400">
                {T(
                  `${startDate} -> ${endDate} · Conservative / Base / Upside Net KWD`,
                  `${startDate} ← ${endDate} · صافي التحفظي والأساسي والمتفائل`,
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold tabular-nums">
              <span
                dir="ltr"
                className={`rounded-full px-2.5 py-1 ${
                  low.profit >= 0
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
                }`}
              >
                60%: {low.profit >= 0 ? '+' : '-'}
                {kwd(Math.abs(low.profit))}
              </span>
              <span
                dir="ltr"
                className={`rounded-full px-2.5 py-1 ${
                  base.profit >= 0
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                }`}
              >
                100%: {base.profit >= 0 ? '+' : '-'}
                {kwd(Math.abs(base.profit))}
              </span>
              <span
                dir="ltr"
                className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
              >
                130%: {high.profit >= 0 ? '+' : '-'}
                {kwd(Math.abs(high.profit))}
              </span>
            </div>
          </div>

          <InteractiveHoverBarChart
            data={scenarioChartData}
            isAr={isAr}
            primaryLegend={T('Sales', 'المبيعات')}
            secondaryLegend={T('Net Profit', 'الصافي')}
            primaryColor="#334155"
            secondaryColor="#10B981"
            heightClass="h-56"
          />

          {/* Visual Breakeven Coverage Bar */}
          <div className="ae-bento-subcard space-y-2 rounded-2xl p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {T(
                  `Breakeven Coverage: ${f0(dailyOrders)} expected vs ${be ? f0(be) : '—'} break-even orders/day`,
                  `تغطية التعادل اليومي: ${f0(dailyOrders)} طلب متوقع مقابل ${be ? f0(be) : '—'} طلب تعادل/يوم`,
                )}
              </span>
              <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                {T(`Daily Cost Cap: ${kwd(dailyCostCapKwd)}/day`, `السقف اليومي للتكلفة: ${kwd(dailyCostCapKwd)}/يوم`)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div
                style={{ width: `${Math.max(6, beCoveragePct)}%` }}
                className={`h-full rounded-full transition-all duration-150 ${
                  dailyOrders >= be ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="ae-bento-card flex flex-col justify-between p-5 sm:p-6 xl:col-span-4">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
              {T('Sales Breakdown', 'توزيع مبيعات المعرض')}
            </h2>
            <p className="text-xs text-neutral-400 dark:text-slate-400">
              {T('Where expected booth sales go', 'وين تروح مبيعات البوث المتوقعة')}
            </p>
          </div>
          <InteractiveDonutChart
            slices={boothDonutSlices}
            centerValue={`${f1(model.rentShare)}%`}
            centerLabel={T('Rent Share', 'حصة الإيجار')}
            summaryRows={[
              {
                label: T('Fixed Costs', 'التكاليف الثابتة'),
                value: kwd(rent + setup + staff),
                tone: 'neutral',
              },
              {
                label: T('Expected Net', 'الصافي المتوقع'),
                value: `${base.profit >= 0 ? '+' : '-'}${kwd(Math.abs(base.profit))}`,
                tone: base.profit >= 0 ? 'emerald' : 'rose',
              },
            ]}
            isAr={isAr}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* Left: Simple Inputs */}
        <section className={`${card} grid grid-cols-1 gap-4 sm:grid-cols-2 xl:sticky xl:top-24 xl:col-span-5`}>
          <label className="space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Event Name', 'اسم المعرض')}
            </span>
            <input
              className={input}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={T('e.g. Winter Wonderland', 'مثال: ونتر وندرلاند')}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
              {T('Brand', 'المطعم')}
            </span>
            <select className={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {BOOTH_BRAND_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.ar : b.en}
                </option>
              ))}
            </select>
          </label>

          {/* Start Date -> End Date Window */}
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
                en: 'Days',
                ar: 'عدد الأيام',
              },
              { v: rent, set: setRent, en: 'Rent (KWD)', ar: 'قيمة الإيجار' },
              { v: setup, set: setSetup, en: 'Setup (KWD)', ar: 'تكلفة التجهيز' },
              { v: staff, set: setStaff, en: 'Staff (KWD)', ar: 'رواتب الطاقم' },
              {
                v: foodCostPct,
                set: (n: number) => setFoodCostPct(Math.min(75, Math.max(10, n))),
                en: 'Food Cost %',
                ar: 'تكلفة المواد %',
              },
              { v: dailyOrders, set: setDailyOrders, en: 'Daily Orders', ar: 'الطلبات اليومية' },
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
              {T('Contract Text', 'بنود العقد')}
            </span>
            <textarea
              className={`${input} min-h-[96px]`}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              placeholder={T('Paste contract terms (optional)…', 'الصق شروط العقد هنا لفحصها (اختياري)…')}
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
            <label className="ae-bento-subcard inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:opacity-90 dark:text-slate-200">
              <FileUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{file ? file.name : T('Attach Contract', 'إرفاق العقد')}</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={runAudit}
              disabled={busy}
              className="btn-colored inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {T('Check Contract', 'فحص العقد')}
            </button>
          </div>
        </section>

        {/* Right: 2-Word Verdict + Simple Breakdown */}
        <div className="min-w-0 space-y-5 xl:col-span-7">
          {/* 1. Clear 2-Word Verdict */}
          <section className={`rounded-2xl p-6 ring-1 ${verdictUi.cls}`}>
            <div className="text-[12px] font-bold opacity-80">{T('Decision', 'قرار الدخول')}</div>
            <div className="mt-1.5 flex items-center gap-3">
              {verdictUi.icon}
              <h2 className="text-[24px] font-extrabold tracking-tight">{isAr ? verdictUi.ar : verdictUi.en}</h2>
            </div>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">
              {T(
                `Expected ${base.profit >= 0 ? 'profit' : 'loss'}: ${kwd(Math.abs(base.profit))} · Break-even: ${be ? f0(be) : '—'} orders/day.`,
                `${base.profit >= 0 ? 'الربح المتوقع' : 'الخسارة المتوقعة'}: ${kwd(Math.abs(base.profit))} · تحتاج ${be ? f0(be) : '—'} طلب يومياً لتغطية التكاليف.`,
              )}
            </p>
            {audit ? (
              <p className="mt-2 text-[13.5px] font-bold">{isAr ? audit.verdictBadgeAr : audit.verdictBadgeEn}</p>
            ) : null}
          </section>

          {/* 1B. Executive Booth Governance & Live Odoo EXB Budget Watchdog */}
          <section className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold tracking-tight text-slate-950 dark:text-white">
                    {T(
                      'Executive Booth Approval & EXB Watchdog',
                      'اعتماد مشاركة المعرض ورقابة ميزانية أودو EXB',
                    )}
                  </h2>
                  {lockedBoothCap || boothApproval?.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{T('Sealed by Manager PIN', 'معتمد بختم الإدارة التنفيذية')}</span>
                    </span>
                  ) : boothApproval?.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                      <Bell className="h-3.5 w-3.5" />
                      <span>{T('Awaiting Manager PIN', 'بانتظار موافقة المدير')}</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-neutral-400 dark:text-slate-400">
                  {T(
                    'Once sealed via Manager PIN, locks Booth Budget & Daily Cost Cap against live Odoo EXB (registers 26–29).',
                    'فور الاعتماد بختم المدير السري، يُقفل سقف ميزانية المعرض والسقف اليومي ويرتبط آلياً بكاشيرات أودو EXB (٢٦–٢٩).',
                  )}
                </p>
              </div>
            </div>

            {/* Budget Cap vs Live Odoo EXB Actuals */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="ae-bento-subcard rounded-2xl p-3">
                <div className="text-[11px] font-semibold text-neutral-400 dark:text-slate-400">
                  {T('Planned Booth Budget Cap', 'سقف ميزانية المعرض')}
                </div>
                <div dir="ltr" className="mt-1 text-[17px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                  {kwd(lockedBoothCap?.totalBudgetCapKwd ?? totalBoothBudgetKwd)}
                </div>
                <div className="mt-0.5 text-[11px] font-medium tabular-nums text-neutral-400">
                  {T('Fixed + Food COGS', 'التكاليف الثابتة + المواد')}
                </div>
              </div>

              <div className="ae-bento-subcard rounded-2xl p-3">
                <div className="text-[11px] font-semibold text-neutral-400 dark:text-slate-400">
                  {T('Daily Cost Cap', 'سقف الصرف اليومي')}
                </div>
                <div dir="ltr" className="mt-1 text-[17px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {kwd(lockedBoothCap?.dailyCostCapKwd ?? dailyCostCapKwd)}/{isAr ? 'يوم' : 'day'}
                </div>
                <div className="mt-0.5 text-[11px] font-medium tabular-nums text-neutral-400">
                  {startDate} {'->'} {endDate}
                </div>
              </div>

              <div className="ae-bento-subcard rounded-2xl p-3">
                <div className="text-[11px] font-semibold text-neutral-400 dark:text-slate-400">
                  {T('Live Odoo EXB Spend', 'صرف أودو EXB الفعلي')}
                </div>
                <div
                  dir="ltr"
                  className={`mt-1 text-[17px] font-extrabold tabular-nums ${
                    lockedBoothCap && exbActualSpendKwd > lockedBoothCap.totalBudgetCapKwd
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-950 dark:text-white'
                  }`}
                >
                  {kwd(exbActualSpendKwd)}
                </div>
                <div className="mt-0.5 text-[11px] font-medium tabular-nums text-neutral-400">
                  {T(`${kwd(exbActualDailyCostKwd)}/day · Reg 26–29`, `${kwd(exbActualDailyCostKwd)}/يوم · كاشير ٢٦–٢٩`)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestBoothApproval}
                  className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>
                    {T(
                      'Request Manager Approval for Booth 🔔',
                      'طلب موافقة المدير على مشاركة المعرض 🔔',
                    )}
                  </span>
                </button>

                {boothApproval?.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() =>
                      gov.approveItemWithPin(
                        boothApproval.id,
                        boothApproval.titleAr,
                        boothApproval.titleEn,
                      )
                    }
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-[12px] font-bold text-emerald-900 transition duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>{T('Approve with Manager PIN ✅', 'اعتماد المشاركة بـ PIN المدير ✅')}</span>
                  </button>
                ) : null}

                {lockedBoothCap || boothApproval?.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={handlePrintBoothCircular}
                    className="ae-bento-subcard inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-slate-800 transition duration-150 hover:bg-emerald-50 hover:text-emerald-900 dark:text-slate-100 dark:hover:bg-emerald-950/50"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{T('Circulate Booth Plan 📄', 'تعميم خطة المعرض 📄')}</span>
                  </button>
                ) : null}
              </div>

              {boothSubmittedFlash ? (
                <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {T('Sent to Manager Bell across devices ✓', 'تم الرفع لجرس المدير ومزامنة الأجهزة ✓')}
                </span>
              ) : null}
            </div>

            {/* Live EXB Budget Cap Breaches */}
            {boothBreaches.length > 0 ? (
              <div className="space-y-2 pt-1">
                {boothBreaches.map((b) => (
                  <div
                    key={b.id}
                    className={`flex flex-col gap-2.5 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                      b.frozen
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'bg-rose-50/75 dark:bg-rose-950/30'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-bold text-slate-900 dark:text-white">
                        <ShieldAlert
                          className={`h-4 w-4 shrink-0 ${
                            b.frozen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        />
                        <span>{isAr ? b.breachHeadlineAr : b.breachHeadlineEn}</span>
                      </div>
                      <p className="text-[11.5px] text-slate-600 dark:text-slate-300">
                        {isAr ? b.odooMetricProofAr : b.odooMetricProofEn}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {b.frozen ? (
                        <button
                          type="button"
                          onClick={() => gov.unfreezeBreachWithPin(b)}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-[11.5px] font-bold text-emerald-800 transition duration-150 hover:bg-emerald-100 dark:bg-white/10 dark:text-emerald-200"
                        >
                          <Unlock className="h-3 w-3" />
                          <span>{T('Unfreeze 🔓', 'فك التجميد 🔓')}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => gov.freezeBreachWithPin(b, true)}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-rose-600 px-3 text-[11.5px] font-bold text-white transition duration-150 hover:bg-rose-700"
                        >
                          <Lock className="h-3 w-3" />
                          <span>{T('Stop EXB Spend ⛔', 'إيقاف المخالفة وتجميد صرف المعرض ⛔')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => gov.openBreachStopCircularPrint(b)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-[11.5px] font-bold text-slate-800 transition duration-150 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200"
                      >
                        <FileText className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{T('Print Stop Order 📄', 'طباعة أمر الإيقاف 📄')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {/* 2. Pros & Risks */}
            <section className={`${card} space-y-4`}>
              <h2 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                {T('Pros & Risks', 'المميزات والمخاطر')}
              </h2>

              <div className="space-y-1.5">
                <div className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                  {T('Pros', 'المميزات')}
                </div>
                {pros.length ? (
                  pros.map((s) => (
                    <p key={s} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {s}
                    </p>
                  ))
                ) : (
                  <p className="text-[13.5px] text-slate-400">—</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-[12px] font-bold text-rose-700 dark:text-rose-400">
                  {T('Risks', 'المخاطر')}
                </div>
                {risks.length ? (
                  risks.map((s) => (
                    <p key={s} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {s}
                    </p>
                  ))
                ) : (
                  <p className="text-[13.5px] text-slate-400">—</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {T('Contract Notes', 'ملاحظات العقد')}
                </div>
                {audit ? (
                  (isAr ? audit.risksAr : audit.risksEn).map((r) => (
                    <p key={r} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                      • {r}
                    </p>
                  ))
                ) : (
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    {T('Attach or paste the contract to check terms.', 'أرفق العقد أو الصق بنوده لفحص الشروط.')}
                  </p>
                )}
              </div>
            </section>

            {/* 3. Expected Profit */}
            <section className={`${card} space-y-4`}>
              <h2 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                {T('Expected Profit', 'حسبة الأرباح')}
              </h2>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Avg Bill', 'متوسط الفاتورة')}</div>
                  <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {isAr ? `${f3(basket)} د.ك` : `${f3(basket)} KWD`}
                  </div>
                </div>
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Order Profit', 'ربح الطلب')}</div>
                  <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {isAr ? `${f3(model.gpPerOrder)} د.ك` : `${f3(model.gpPerOrder)} KWD`}
                  </div>
                </div>
                <div className="ae-bento-subcard rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Break-even', 'طلبات التعادل')}</div>
                  <div className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {be ? f0(be) : '—'}
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-xl ring-1 ring-slate-950/[0.04] dark:ring-white/[0.06]">
                <table className="w-full min-w-[400px] text-[14px]">
                  <thead className="bg-[#F4F6F9] text-slate-600 dark:bg-[#0C141B] dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-bold">{T('Case', 'الإقبال')}</th>
                      <th className="px-3 py-2.5 text-end font-bold">{T('Orders', 'الطلبات')}</th>
                      <th className="px-3 py-2.5 text-end font-bold">{T('Sales', 'المبيعات')}</th>
                      <th className="px-3 py-2.5 text-end font-bold">{T('Net', 'الصافي')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {model.scenarios.map((s) => (
                      <tr key={s.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/[0.05]">
                        <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                          {isAr ? s.ar : s.en}
                        </td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{f0(s.orders)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">{kwd(s.revenue)}</td>
                        <td
                          className={`whitespace-nowrap px-3 py-2.5 text-end font-extrabold tabular-nums ${
                            s.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {kwd(s.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* 4. Rent & Menu */}
          <section className={`${card} grid grid-cols-1 gap-5 lg:grid-cols-3`}>
            <div className="lg:col-span-3">
              <h2 className="text-[16px] font-extrabold text-slate-950 dark:text-white">
                {T('Rent & Menu', 'التفاوض والمنيو')}
              </h2>
            </div>

            <div className="space-y-1.5">
              <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{T('Safe Rent Limit', 'أعلى إيجار مناسب')}</div>
              <p className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                •{' '}
                {T(
                  `Max safe rent is ${kwd(model.rentCeiling)}${rent > model.rentCeiling ? ` — ask for ${kwd(rent - model.rentCeiling)} off.` : '.'}`,
                  `السقف الآمن للإيجار ${kwd(model.rentCeiling)}${rent > model.rentCeiling ? ` — فاوض لتخفيض ${kwd(rent - model.rentCeiling)}.` : '.'}`,
                )}
              </p>
              {(audit ? (isAr ? audit.counterClausesAr : audit.counterClausesEn) : []).map((c) => (
                <p key={c} className="text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                  • {c}
                </p>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">
                {T('Best Booth Items', 'أفضل أصناف البوث')}
              </div>
              {quickMenu.length ? (
                quickMenu.map((m) => (
                  <div
                    key={`${m.code}-${m.name}`}
                    className="ae-bento-subcard flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px]"
                  >
                    <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                      {m.name}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold text-slate-600 dark:text-slate-300">
                      {isAr ? `${f3(m.priceKwd)} د.ك` : `${f3(m.priceKwd)} KWD`}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[13.5px] text-slate-400">—</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400">{T('Quick Prep', 'تجهيز سريع')}</div>
              {(audit
                ? isAr
                  ? audit.solutionsAr
                  : audit.solutionsEn
                : [
                    T('Prep items at the central kitchen and finish on site.', 'تحضير الأصناف بالمطبخ المركزي والتسوية في البوث.'),
                    T('Use a handheld KNET device during peak queues.', 'توفير جهاز كي نت متنقل وقت الزحمة.'),
                    T('Open a separate POS register in Odoo for the booth.', 'فتح كاشير مستقل للمعرض في أودو.'),
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
