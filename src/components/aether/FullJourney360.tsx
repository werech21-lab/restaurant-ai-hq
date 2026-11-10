'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  Landmark,
  MessageCircle,
  Radar,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from 'lucide-react'
import {
  JOURNEY_KPI_NOW,
  JOURNEY_META,
  JOURNEY_PLAYS,
  JOURNEY_SHORTCUTS,
  JOURNEY_STAGES,
  arItemName,
  buildDispatchBrief,
  buildVendorCreditNoteRequest,
  enItemName,
  evaluateKuwaitCashCycle,
  journeyKpiFormat,
  simulatePlay,
  type JourneyPlay,
  type JourneyStage,
  type KuwaitCalendarPulse,
  type PlayKpi,
} from '@/lib/full-journey-enterprise-brain'
import { BRANCHES, BRANDS, feryalHref } from '@/lib/aether/ledger'
import { useLang } from '@/components/aether/ui'

type Tab = 'shortcuts' | 'decisions' | 'tracker'
type Glow = 'emerald' | 'amber' | 'sky' | 'rose'
type TrackerStatus = 'verified' | 'monitoring' | 'stalled'
type Live = {
  status: 'idle' | 'scanning' | 'done' | 'unauthorized' | 'error'
  at?: string
  live?: boolean
  mtdPerDay?: number
  mtdNet?: number
  rollingNet?: number
  priorNet?: number
  restricted?: string[]
}

interface Approval {
  id: string
  approvedAt: string
  snapshotAt: string
  kpi: PlayKpi
  monthlyKwd: number
  titleEn: string
  titleAr: string
  ownerRoleEn?: string
  ownerRoleAr?: string
  livePerDay?: number
}

const STORE = 'vf-journey-approvals-v1'
const CYCLE_DAYS = 14
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const SILENT_REFRESH_KEY = 'vf_erp_silent_refresh_v11'
const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const GLOW_CLASS: Record<Glow, string> = {
  emerald: 'ae-glow-emerald',
  amber: 'ae-glow-amber',
  sky: 'ae-glow-sky',
  rose: 'ae-glow-rose',
}

const card = 'ae-studio-card relative overflow-hidden'
const pill =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6F7F9] px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-800 shadow-[0_0_0_1px_rgba(15,23,42,0.05)] transition-all duration-150 hover:bg-slate-200/70 active:scale-[0.97] dark:bg-white/[0.06] dark:text-slate-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] dark:hover:bg-white/[0.1]'

const SEVERITY: Record<JourneyPlay['severity'], { en: string; ar: string; cls: string }> = {
  critical: { en: 'Top Priority', ar: 'أولوية قصوى', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  high: { en: 'Important', ar: 'مهم', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  medium: { en: 'Helpful', ar: 'تحسين إضافي', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

function Shortcut({
  glow,
  title,
  metric,
  sub,
  takeaway,
  action,
  children,
}: {
  glow: Glow
  title: string
  metric: ReactNode
  sub?: string
  takeaway: ReactNode
  action: ReactNode
  children?: ReactNode
}) {
  return (
    <article
      className={`${card} ${GLOW_CLASS[glow]} group flex min-h-[224px] flex-col gap-3 p-6 transition-transform duration-200 hover:-translate-y-0.5`}
      style={{ transitionTimingFunction: SPRING }}
    >
      <h2 className="relative text-[14px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <div className="relative">
        <div className="break-words text-[26px] font-bold leading-tight tracking-tight tabular-nums text-slate-950 dark:text-white">{metric}</div>
        {sub && <div className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
      {children}
      <p className="relative text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{takeaway}</p>
      <div className="relative mt-auto flex flex-wrap items-center justify-end gap-2 pt-1.5">
        {action}
      </div>
    </article>
  )
}

/** ملخص أداء الشركة وفرص زيادة الربح — Plain-Language Executive Workspace (1540px). */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const [tab, setTab] = useState<Tab>('shortcuts')
  const [stage, setStage] = useState<JourneyStage | 'all'>('all')
  const [highlightedPlayId, setHighlightedPlayId] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [live, setLive] = useState<Live>({ status: 'idle' })

  // Superpower #1: What-If Simulator state per play id
  const [openSim, setOpenSim] = useState<Record<string, boolean>>({})
  const [simValues, setSimValues] = useState<Record<string, [number, number]>>({})

  // Superpower #2 & #5: Dispatch Brief & Vendor Credit-Note drawers + copy feedback
  const [openBrief, setOpenBrief] = useState<Record<string, 'dispatch' | 'vendor' | null>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Tracker filter
  const [trackerFilter, setTrackerFilter] = useState<'all' | TrackerStatus>('all')

  // Live Kuwait Cash-Cycle Calendar Pulse (refreshed to exact client time on mount)
  const [calPulse, setCalPulse] = useState<KuwaitCalendarPulse>(() => JOURNEY_SHORTCUTS.kuwaitCalendar)
  const [calTab, setCalTab] = useState<'paydayZwarah' | 'midMonthShield'>(() =>
    JOURNEY_SHORTCUTS.kuwaitCalendar.activeMode === 'payday-zwarah' ? 'paydayZwarah' : 'midMonthShield',
  )

  useEffect(() => {
    const fresh = evaluateKuwaitCashCycle(new Date())
    setCalPulse(fresh)
    setCalTab(fresh.activeMode === 'payday-zwarah' ? 'paydayZwarah' : 'midMonthShield')
  }, [])

  useEffect(() => {
    try {
      setApprovals(JSON.parse(localStorage.getItem(STORE) || '[]'))
    } catch {
      // ignore malformed storage
    }
  }, [])

  const persist = (next: Approval[]) => {
    setApprovals(next)
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
    } catch {
      // ignore storage quota errors
    }
  }

  const scan = useCallback(async (silent = false) => {
    if (!silent) setLive({ status: 'scanning' })
    try {
      const res = await fetch('/api/odoo-sync', { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (res.status === 401) {
        if (!silent) setLive({ status: 'unauthorized' })
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      try {
        localStorage.setItem(SILENT_REFRESH_KEY, String(Date.now()))
      } catch {
        // ignore
      }
      setLive({
        status: 'done',
        at: d.syncedAt,
        live: d.source === 'live',
        mtdNet: d.journeyPulse?.mtd?.netKwd ?? d.totals?.netSalesKwd,
        mtdPerDay: d.journeyPulse?.mtd?.perDayKwd,
        rollingNet: d.journeyPulse?.rolling30?.netKwd,
        priorNet: d.journeyPulse?.prior30?.netKwd,
        restricted: d.access?.restricted,
      })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
    } catch {
      if (!silent) setLive({ status: 'error' })
    }
  }, [])

  // Handle ?stage=, ?play=, ?print=1 deep-links from ⌘K + 6h silent background refresh check
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const qStage = sp.get('stage') as JourneyStage | null
    const qPlay = sp.get('play')
    const qPrint = sp.get('print')
    if (qStage && JOURNEY_STAGES.some((s) => s.id === qStage)) {
      setStage(qStage)
      setTab('decisions')
    }
    if (qPlay) {
      setTab('decisions')
      setHighlightedPlayId(qPlay)
      window.setTimeout(() => {
        document.getElementById(`play-card-${qPlay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 180)
    }
    if (qPrint === '1') {
      window.setTimeout(() => window.print(), 350)
    }

    // Silent 6h refresh check on /erp mount
    try {
      const last = Number(localStorage.getItem(SILENT_REFRESH_KEY) || '0')
      const age = Date.now() - new Date(JOURNEY_META.syncedAt).getTime()
      if ((!last || Date.now() - last > SIX_HOURS_MS) && age > SIX_HOURS_MS) {
        const t = window.setTimeout(() => {
          void scan(true)
        }, 1600)
        return () => window.clearTimeout(t)
      }
    } catch {
      // ignore
    }
  }, [scan])

  const getPlaySimulated = useCallback(
    (p: JourneyPlay) => {
      const vals = simValues[p.id] ?? [p.simulator.sliders[0].defaultValue, p.simulator.sliders[1].defaultValue]
      return { vals, res: simulatePlay(p, vals[0], vals[1]) }
    },
    [simValues],
  )

  const approve = (p: JourneyPlay, customMonthlyKwd?: number) => {
    if (approvals.some((a) => a.id === p.id)) return persist(approvals.filter((a) => a.id !== p.id))
    persist([
      ...approvals,
      {
        id: p.id,
        approvedAt: new Date().toISOString(),
        snapshotAt: JOURNEY_META.syncedAt,
        kpi: p.kpi,
        monthlyKwd: customMonthlyKwd ?? p.monthlyKwd,
        titleEn: p.titleEn,
        titleAr: p.titleAr,
        ownerRoleEn: p.ownerRoleEn,
        ownerRoleAr: p.ownerRoleAr,
        livePerDay: live.mtdPerDay,
      },
    ])
  }

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  const kwd = (n: number, d = 0) => (isAr ? `${d ? f3(n) : f0(n)} د.ك` : `${d ? f3(n) : f0(n)} KWD`)
  const loc = (id: string | undefined) => {
    const b = BRANCHES.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id === 'central-kitchen' ? T('Ardiya Central Kitchen', 'المطبخ المركزي بالعارضية') : id ?? ''
  }
  const brand = (id: string | undefined) => {
    const b = BRANDS.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id ?? ''
  }

  const openStage = (s: JourneyStage | 'all', targetPlayId?: string) => {
    setStage(s)
    setTab('decisions')
    if (targetPlayId) {
      setHighlightedPlayId(targetPlayId)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          document.getElementById(`play-card-${targetPlayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 140)
      }
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goTo = (s: JourneyStage | 'all', label: string) => (
    <button type="button" onClick={() => openStage(s)} className={pill}>
      {label}
      <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
    </button>
  )

  const S = JOURNEY_SHORTCUTS
  const period = isAr ? JOURNEY_META.rollingAr : JOURNEY_META.rollingEn
  const visible = useMemo(() => (stage === 'all' ? JOURNEY_PLAYS : JOURNEY_PLAYS.filter((p) => p.stage === stage)), [stage])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: JOURNEY_PLAYS.length }
    for (const p of JOURNEY_PLAYS) c[p.stage] = (c[p.stage] ?? 0) + 1
    return c
  }, [])
  const visibleMonthly = visible.reduce((sumAcc, p) => sumAcc + getPlaySimulated(p).res.monthlyKwd, 0)

  const tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'shortcuts', en: 'Quick Summary', ar: 'الخلاصة السريعة' },
    { id: 'decisions', en: 'Steps to Grow Profit & Cut Waste', ar: 'خطوات زيادة الربح وتقليل الهدر' },
    { id: 'tracker', en: 'Results Tracker (Before & After)', ar: 'نتائج التنفيذ (قبل وبعد)' },
  ]
  const tabIndex = tabs.findIndex((t) => t.id === tab)
  const side = isAr ? 'right' : 'left'
  const scanLabel =
    live.status === 'scanning'
      ? T('Updating from Odoo…', 'جارٍ تحديث بيانات أودو…')
      : live.status === 'unauthorized'
        ? T('Sign in to update', 'سجّل الدخول للتحديث')
        : live.status === 'error'
          ? T('Update failed — retry', 'تعذّر التحديث — أعد المحاولة')
          : T('Refresh Odoo data now', 'تحديث البيانات من أودو الآن')

  // 10.000 KWD Pocket-Split Proportional Bar segments
  const pocketSegments = [
    {
      key: 'food',
      labelEn: 'Food Cost & Packaging',
      labelAr: 'تكلفة الأكل والتغليف',
      val: S.netPocket.foodAndPack10,
      barCls: 'bg-amber-400',
      dotCls: 'bg-amber-400',
    },
    {
      key: 'platform',
      labelEn: 'Delivery App Fees & Promos',
      labelAr: 'عمولات وخصومات تطبيقات التوصيل',
      val: S.netPocket.platformCut10,
      barCls: 'bg-rose-400',
      dotCls: 'bg-rose-400',
    },
    {
      key: 'opex',
      labelEn: 'Branch Rent, Salaries & Bills',
      labelAr: 'الإيجار والرواتب ومصاريف الفرع',
      val: S.netPocket.branchOpexRent10,
      barCls: 'bg-sky-400',
      dotCls: 'bg-sky-400',
    },
    {
      key: 'net',
      labelEn: 'Final Net Profit in Pocket',
      labelAr: 'الربح الصافي النهائي في الجيب',
      val: S.netPocket.trueNetCash10,
      barCls: 'bg-emerald-500',
      dotCls: 'bg-emerald-500',
    },
  ]

  // Classify approvals into the 3 states
  const evaluatedApprovals = useMemo(() => {
    return approvals.map((a) => {
      const days = Math.max(0, Math.floor((Date.now() - new Date(a.approvedAt).getTime()) / 86400000))
      const cycle = Math.floor(days / CYCLE_DAYS) + 1
      const next = new Date(new Date(a.approvedAt).getTime() + cycle * CYCLE_DAYS * 86400000)
      const now = JOURNEY_KPI_NOW[a.kpi.id]
      const fresh = new Date(JOURNEY_META.syncedAt).getTime() > new Date(a.approvedAt).getTime() && now !== undefined
      const delta = fresh && now !== undefined ? now - a.kpi.value : 0
      const improved = fresh && (a.kpi.better === 'down' ? delta < 0 : delta > 0)
      const regressed = fresh && (a.kpi.better === 'down' ? delta > 0 : delta < 0)
      const status: TrackerStatus = improved ? 'verified' : regressed || (days >= CYCLE_DAYS && !improved) ? 'stalled' : 'monitoring'
      return { a, days, cycle, next, now, fresh, delta, improved, status }
    })
  }, [approvals])

  const filteredApprovals = useMemo(
    () => (trackerFilter === 'all' ? evaluatedApprovals : evaluatedApprovals.filter((x) => x.status === trackerFilter)),
    [evaluatedApprovals, trackerFilter],
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-6">
      {/* Studio Masthead */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-950 sm:text-[26px] dark:text-white">
            {T('Company Summary & Profit Opportunities', 'ملخص أداء الشركة وفرص زيادة الربح')}
          </h1>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
            {T(
              `Live sales and expenses across our 7 branches from Odoo · ${period} · ${f1(JOURNEY_META.growthPct)}% vs prior 30 days`,
              `قراءة مباشرة لمبيعات ومصاريف فروعنا السبعة من أودو · ${period} · ${f1(JOURNEY_META.growthPct)}% مقارنة بالشهر السابق`,
            )}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={T('View', 'طريقة العرض')}
          className="relative grid w-full shrink-0 grid-cols-3 rounded-full bg-slate-200/75 p-1 xl:w-auto dark:bg-white/[0.07]"
        >
          <span
            aria-hidden
            className="absolute bottom-1 top-1 rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.06)] dark:bg-slate-900"
            style={
              {
                width: 'calc(33.333% - 2.67px)',
                [side]: `calc(${tabIndex * 33.333}% + ${4 - tabIndex * 1.33}px)`,
                transition: `${side} 200ms ${SPRING}`,
              } as CSSProperties
            }
          />
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative z-10 truncate rounded-full px-3 py-2 text-[12.5px] font-semibold transition-colors duration-150 sm:px-5 sm:text-[13px] ${
                tab === t.id ? 'text-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>
      </header>

      {/* ─────────────── Tab 1 — 10 KWD Breakdown + 8 Quick Summary Cards ─────────────── */}
      {tab === 'shortcuts' && (
        <div className="space-y-5">
          {/* Effortless Micro-Visual: 10.000 KWD Breakdown */}
          <section className={`${card} ae-glow-emerald p-6`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[12px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {T('Clear Breakdown per 10 KWD', 'توزيع مبسط لكل ١٠ دنانير مبيعات')}
                  </span>
                </div>
                <h2 className="mt-1 text-[17px] font-bold text-slate-950 dark:text-white">
                  {T(
                    'Where Does Every 10 KWD in Sales Go?',
                    'وين تروح كل ١٠ دنانير مبيعات؟',
                  )}
                </h2>
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
                  {T(
                    `Final Net Profit in Pocket (${f2(S.netPocket.trueNetCash10)} KWD)`,
                    `الربح الصافي النهائي في الجيب (${f2(S.netPocket.trueNetCash10)} د.ك)`,
                  )}
                </span>
                <span dir="ltr" className="rounded-full bg-emerald-50 px-3.5 py-1 text-[16px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {f3(S.netPocket.trueNetCash10)} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
            </div>

            {/* Proportional Bar */}
            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 dark:bg-white/[0.06]" role="img" aria-label={T('10 KWD pocket split bar', 'شريط توزيع كل 10 دنانير')}>
              {pocketSegments.map((seg) => (
                <div
                  key={seg.key}
                  style={{ width: `${Math.max(4, (seg.val / 10) * 100)}%` }}
                  className={`${seg.barCls} h-full first:rounded-s-full last:rounded-e-full transition-all duration-500`}
                  title={`${isAr ? seg.labelAr : seg.labelEn}: ${f3(seg.val)} KWD`}
                />
              ))}
            </div>

            {/* 4 Segment Callouts */}
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {pocketSegments.map((seg) => (
                <div
                  key={seg.key}
                  className={`ae-studio-subcard flex items-center justify-between gap-2 px-4 py-3 ${
                    seg.key === 'net' ? 'ring-1 ring-emerald-500/25' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.dotCls}`} />
                      <span className="truncate text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                        {isAr ? seg.labelAr : seg.labelEn}
                      </span>
                    </div>
                    <div dir="ltr" className="mt-1 text-[17px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                      {f3(seg.val)} <span className="text-[11.5px] font-semibold text-slate-400">/ 10.000</span>
                    </div>
                  </div>
                  <span dir="ltr" className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 shadow-sm dark:bg-white/[0.08] dark:text-slate-200">
                    {f1((seg.val / 10) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Real-World Field-Execution Row: Kuwait Calendar Tactical Mode + End-of-Month Cash Runway Pulse */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Card A: Kuwait Payday, Zwarah & Mid-Month Tactical Engine */}
            <section className={`${card} ${calPulse.activeMode === 'payday-zwarah' ? 'ae-glow-emerald' : 'ae-glow-amber'} flex flex-col gap-4 p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {isAr ? calPulse.badgeAr : calPulse.badgeEn}
                    </span>
                    <span dir="ltr" className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                      {(isAr ? calPulse.weekdayAr : calPulse.weekdayEn)} · {calPulse.kuwaitDateIso}
                    </span>
                  </div>
                  <h2 className="text-[16.5px] font-bold leading-snug text-slate-950 dark:text-white">
                    {isAr ? calPulse.headlineAr : calPulse.headlineEn}
                  </h2>
                </div>

                {/* 2-Mode Tactical Switcher */}
                <div className="inline-flex shrink-0 rounded-full bg-[#F6F7F9] p-1 dark:bg-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCalTab('paydayZwarah')}
                    className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                      calTab === 'paydayZwarah'
                        ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {T('Payday & Zwarah (20–29)', 'الرواتب والزوارة (٢٠–٢٩)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalTab('midMonthShield')}
                    className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                      calTab === 'midMonthShield'
                        ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {T('Mid-Month Offers (10–19)', 'عروض منتصف الشهر (١٠–١٩)')}
                  </button>
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr ? calPulse.directiveAr : calPulse.directiveEn}
              </p>

              {(() => {
                const activePack = calPulse.modes[calTab]
                const bundles = isAr ? activePack.bundlesAr : activePack.bundlesEn
                return (
                  <div className="ae-studio-subcard space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-bold text-slate-900 dark:text-white">
                        {isAr ? activePack.titleAr : activePack.titleEn}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm dark:bg-white/[0.08] dark:text-slate-300">
                        {isAr ? activePack.windowAr : activePack.windowEn}
                      </span>
                    </div>
                    <ul className="space-y-1 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
                      {bundles.map((b) => (
                        <li key={b} className="leading-relaxed">• {b}</li>
                      ))}
                    </ul>
                    <p className="pt-1 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {isAr ? activePack.opsRuleAr : activePack.opsRuleEn}
                    </p>
                  </div>
                )
              })()}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] font-medium text-slate-400">
                  {T(
                    `Payday/Zwarah avg ${kwd(calPulse.paydayAvgKwd)}/day vs Mid-Month ${kwd(calPulse.midAvgKwd)}/day (+${f0(calPulse.surgeKwdPct)}%)`,
                    `متوسط الرواتب والزوارة ${kwd(calPulse.paydayAvgKwd)}/يوم مقابل منتصف الشهر ${kwd(calPulse.midAvgKwd)}/يوم (+${f0(calPulse.surgeKwdPct)}٪)`,
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openStage('kitchen', 'kitchen-ardiya-prep-par-shield')} className={pill}>
                    {T('Ardiya Prep Schedule', 'جدول تحضير العارضية')}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </button>
                  <button type="button" onClick={() => openStage('menu', 'menu-kuwait-calendar-tactical')} className={pill}>
                    {T('Monthly Offers', 'عروض الشهر')}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </button>
                </div>
              </div>
            </section>

            {/* Card B: End-of-Month Cash Commitments */}
            <section className={`${card} ae-glow-sky flex flex-col gap-4 p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-0.5 text-[11.5px] font-bold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                      <Landmark className="h-3.5 w-3.5" />
                      {T('End-of-Month Obligations & Cash Readiness', 'التزامات نهاية الشهر وجاهزية السيولة')}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {T(
                        `${f1(S.cashRunway.coverageRatio)}x covered · +${kwd(S.cashRunway.netCashBufferKwd)} surplus`,
                        `تغطية ${f1(S.cashRunway.coverageRatio)} مرة · فائض +${kwd(S.cashRunway.netCashBufferKwd)}`,
                      )}
                    </span>
                  </div>
                  <h2 className="text-[16.5px] font-bold leading-snug text-slate-950 dark:text-white">
                    {T(
                      `${kwd(S.cashRunway.totalCommitmentsKwd)} Monthly Obligations vs ${kwd(S.cashRunway.rollingPosInflowKwd)} 30d Sales`,
                      `${kwd(S.cashRunway.totalCommitmentsKwd)} التزامات شهرية مقابل ${kwd(S.cashRunway.rollingPosInflowKwd)} مبيعات ٣٠ يوماً`,
                    )}
                  </h2>
                </div>
                <span className="rounded-full bg-[#F6F7F9] px-3 py-1 text-[11.5px] font-bold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                  {T(`${S.cashRunway.daysToMonthEnd}d to month-end`, `باقي ${S.cashRunway.daysToMonthEnd} يوماً لنهاية الشهر`)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="ae-studio-subcard p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Branch Rents', 'إيجارات الفروع')}</div>
                  <div dir="ltr" className="mt-1 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {kwd(S.cashRunway.rentKwd)}
                  </div>
                </div>
                <div className="ae-studio-subcard p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Salaries & Housing', 'الرواتب والسكن')}</div>
                  <div dir="ltr" className="mt-1 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {kwd(S.cashRunway.payrollKwd)}
                  </div>
                </div>
                <div className="ae-studio-subcard p-3">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{T('Supplier Bills', 'فواتير الموردين')}</div>
                  <div dir="ltr" className="mt-1 text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                    {kwd(S.cashRunway.vendorKwd)}
                  </div>
                </div>
                <div className="rounded-2xl bg-amber-50/75 p-3 ring-1 ring-amber-500/20 dark:bg-amber-950/25">
                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300">{T('Pending App Payouts', 'مستحقات منصات معلقة')}</div>
                  <div dir="ltr" className="mt-1 text-[15px] font-extrabold tabular-nums text-amber-950 dark:text-amber-100">
                    {kwd(S.cashRunway.openClearingKwd)}
                  </div>
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr ? S.cashRunway.verdictAr : S.cashRunway.verdictEn}
              </p>

              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => openStage('delivery', 'delivery-unsettled-clearing')} className={pill}>
                  {T('Match App Payouts', 'متابعة تحصيل المنصات')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
                <Link
                  href={feryalHref(
                    isAr
                      ? 'راجعي معي التزامات نهاية الشهر (الإيجارات والرواتب وفواتير الموردين) وخطة تحصيل مستحقات طلبات وكيتا قبل ١٥ يوماً من نهاية الشهر.'
                      : 'Walk me through our End-of-Month Obligations (Rent, Salaries & Supplier bills) and collecting Talabat & Keeta payouts 15 days before month-end.',
                  )}
                  className={pill}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {T('Review with Feryal', 'مراجعة السيولة مع فريال')}
                </Link>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Shortcut
              glow="sky"
              title={T(
                `Sales Left Before Rent & Salaries (${f2(S.netPocket.per10)} KWD)`,
                `متبقي المبيعات قبل الإيجار والرواتب (${f2(S.netPocket.per10)} د.ك)`,
              )}
              metric={kwd(S.netPocket.per10, 3)}
              sub={T('out of every 10 KWD after food, packaging & app fees', 'من كل ١٠ دنانير بعد تكلفة الأكل والتغليف والعمولات')}
              takeaway={T(
                `Out of every 10 KWD: food takes ${f3(S.netPocket.food)}, app fees ${f3(S.netPocket.fees)}, discounts ${f3(S.netPocket.promos)} and packaging ${f3(S.netPocket.packaging)} KWD — before paying rent & salaries.`,
                `من كل ١٠ دنانير مبيعات: يذهب ${f3(S.netPocket.food)} للأكل و${f3(S.netPocket.fees)} لعمولات التطبيقات و${f3(S.netPocket.promos)} للخصومات و${f3(S.netPocket.packaging)} للتغليف — قبل دفع الإيجار والرواتب.`,
              )}
              action={goTo('kitchen', T('How to improve it', 'كيف نزيده'))}
            />
            <Shortcut
              glow="emerald"
              title={T('Total Potential Extra Profit per Year', 'إجمالي الزيادة الممكنة في أرباح السنة')}
              metric={kwd(S.unlockable.annualKwd)}
              sub={T(`${kwd(S.unlockable.monthlyKwd)} per month`, `${kwd(S.unlockable.monthlyKwd)} شهرياً`)}
              takeaway={T(
                `${S.unlockable.plays} practical steps across ${JOURNEY_META.stagesCovered} areas, each with a quick profit calculator, team brief & 14-day follow-up.`,
                `${S.unlockable.plays} خطوة عملية واضحة في ${JOURNEY_META.stagesCovered} مجالات، مع حاسبة ربح سريعة ورسالة توجيه جاهزة لفريق العمل.`,
              )}
              action={goTo('all', T('View all steps', 'عرض كل الخطوات'))}
            />
            <Shortcut
              glow="amber"
              title={T('Purchasing Savings & Kitchen Waste Reduction', 'توفير المشتريات وتقليل هدر المطبخ')}
              metric={kwd(S.shield.monthlyKwd)}
              sub={T('monthly savings opportunity', 'فرصة توفير شهرية')}
              takeaway={T(
                `Stock count differences add ${f1(S.shield.variancePctOfFood)}% above recipe usage (${kwd(S.shield.varianceKwd)} in 30 days)${S.shield.topCreep ? `; ${enItemName(S.shield.topCreep.name)} rose ${f1(S.shield.topCreep.creepPct)}% from suppliers` : ''}.`,
                `فروقات المخزون تضيف ${f1(S.shield.variancePctOfFood)}% فوق استهلاك الوصفات (${kwd(S.shield.varianceKwd)} خلال ٣٠ يوماً)${S.shield.topCreep ? `؛ وارتفع سعر ${arItemName(S.shield.topCreep.name)} بنسبة ${f1(S.shield.topCreep.creepPct)}% من الموردين` : ''}.`,
              )}
              action={goTo('procurement', T('Purchasing steps', 'خطوات التوفير'))}
            />
            <Shortcut
              glow="rose"
              title={T('Expense Control, Petty Cash & Equipment Repairs', 'ضبط المصاريف والعُهد وصيانة المعدات')}
              metric={kwd(S.hiddenOpex.monthlyKwd)}
              sub={T('waste, emergency repairs & untagged bills (30d)', 'هدر وصيانة طارئة وفواتير غير مربوطة بفرع (٣٠ يوم)')}
              takeaway={T(
                `Includes stock differences, scrap and emergency repairs, ${kwd(S.hiddenOpex.unallocatedKwd)} in untagged bills, plus ${kwd(S.hiddenOpex.custodyKwd)} in open petty cash.${S.hiddenOpex.repairLoop ? ` Note: ${S.hiddenOpex.repairLoop.titleEn}.` : ''}`,
                `تشمل الهدر وفواتير الصيانة الطارئة، و${kwd(S.hiddenOpex.unallocatedKwd)} فواتير بدون تحديد فرع، و${kwd(S.hiddenOpex.custodyKwd)} عُهد نقدية مفتوحة.${S.hiddenOpex.repairLoop ? ` ملاحظة: ${S.hiddenOpex.repairLoop.titleAr}.` : ''}`,
              )}
              action={goTo('opex', T('View fixes', 'عرض الحلول'))}
            />
            <Shortcut
              glow={S.ops.groupScore >= 80 ? 'emerald' : 'amber'}
              title={T('Branch Operations & Cashier Performance', 'تقييم التزام الفروع والكاشير')}
              metric={
                <span>
                  {S.ops.groupScore}
                  <span className="text-slate-300 dark:text-slate-600"> / 100</span>
                </span>
              }
              sub={T('overall branch commitment score', 'تقييم شامل لالتزام الفروع من ١٠٠')}
              takeaway={T(
                `Top branch: ${loc(S.ops.best?.id)} (${S.ops.best?.score}). Needs follow-up: ${loc(S.ops.worst?.id)} (${S.ops.worst?.score}) on discounts, cancellations & opening times.`,
                `الأفضل التزاماً: ${loc(S.ops.best?.id)} (${S.ops.best?.score}). يحتاج متابعة: ${loc(S.ops.worst?.id)} (${S.ops.worst?.score}) في الخصومات والإلغاءات ووقت الفتح.`,
              )}
              action={goTo('operations', T('Branch steps', 'خطوات الفروع'))}
            >
              <div className="relative flex flex-wrap gap-1.5">
                {S.ops.rows.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${r.score >= 85 ? 'bg-emerald-500' : r.score >= 65 ? 'bg-amber-400' : 'bg-rose-500'}`} />
                    {loc(r.id)} {r.score}
                  </span>
                ))}
              </div>
            </Shortcut>
            <Shortcut
              glow="emerald"
              title={T(
                'Update Top-Seller Prices & Keep Core Meal Prices Fixed',
                'تحسين أسعار الأطباق الأكثر طلباً وتثبيت أسعار الأصناف الأساسية',
              )}
              metric={kwd(S.menu.monthlyKwd)}
              sub={T('extra monthly profit from menu & bundles', 'ربح شهري إضافي من تسعير المنيو والوجبات')}
              takeaway={
                S.menu.hero
                  ? T(
                      `${enItemName(S.menu.hero.name)} leads China Garden (${f0(S.menu.hero.qty)} sold at ${f3(S.menu.hero.avgPriceKwd)} KWD); ${S.menu.plays.length} steps grow basket value while keeping core meal prices unchanged.`,
                      `يتصدر ${arItemName(S.menu.hero.name)} مبيعات تشاينا جاردن (${f0(S.menu.hero.qty)} طلب بسعر ${f3(S.menu.hero.avgPriceKwd)} د.ك)؛ ${S.menu.plays.length} خطوات لزيادة ربح المنيو مع تثبيت أسعار وجبات الكومبو الأساسية.`,
                    )
                  : ''
              }
              action={goTo('menu', T('Menu steps', 'خطوات المنيو'))}
            />
            <Shortcut
              glow="sky"
              title={T(
                'Run an Extra Brand in the Same Kitchen (Zero Extra Rent)',
                'تشغيل مطعم إضافي بنفس المطبخ (بدون إيجار جديد)',
              )}
              metric={S.host ? kwd(S.host.contribution) : '—'}
              sub={
                S.host
                  ? T(
                      `per month · ${brand(S.host.brand)} inside ${loc(S.host.target.id)}`,
                      `شهرياً · ${brand(S.host.brand)} داخل مطبخ ${loc(S.host.target.id)}`,
                    )
                  : undefined
              }
              takeaway={
                S.host
                  ? T(
                      `${loc(S.host.target.id)} pays ${f1(S.host.target.rentPct)}% of sales in rent (needs +${kwd(S.host.dailyGapKwd)}/day · ${S.host.dailyGapOrders} orders/day); running ${brand(S.host.brand)} there brings rent down to ${f1(S.host.rentAfterPct)}%.`,
                      `يدفع فرع ${loc(S.host.target.id)} إيجاراً يعادل ${f1(S.host.target.rentPct)}% من مبيعاته (يحتاج +${kwd(S.host.dailyGapKwd)}/يوم أي ${S.host.dailyGapOrders} طلب إضافي)؛ وتشغيل ${brand(S.host.brand)} بنفس المطبخ يخفض عبء الإيجار إلى ${f1(S.host.rentAfterPct)}%.`,
                    )
                  : T('Every restaurant covers its rent comfortably.', 'كل الفروع تغطي إيجاراتها بشكل مريح.')
              }
              action={goTo('opex', T('View plan', 'تفاصيل الخطوة'))}
            />
            <Shortcut
              glow="amber"
              title={T('Delivery App Payouts & Commission Savings', 'مستحقات وتوفير من تطبيقات التوصيل')}
              metric={kwd(S.delivery.monthlyKwd)}
              sub={T('monthly savings from delivery apps', 'توفير شهري من عمولات وعروض المنصات')}
              takeaway={T(
                `Stop costly co-funded promos, check commission overcharges and shift nearby orders from Tgo (17%) to TMP (10%) — plus ${kwd(S.delivery.openClearingKwd)} awaiting bank matching.`,
                `إيقاف الخصومات المشتركة المكلفة، ومراجعة فروقات العمولات وتحويل الطلبات القريبة إلى توصيل سائقينا (10%) — مع متابعة ${kwd(S.delivery.openClearingKwd)} مستحقات معلقة.`,
              )}
              action={
                <Link href="/erp/aggregator-radar" className={pill}>
                  <Radar className="h-3.5 w-3.5" />
                  {T('Open Forensic Radar', 'فتح الرادار الجنائي للتوصيل')}
                </Link>
              }
            />
          </div>
        </div>
      )}

      {/* ─────────────── Tab 2 — Journey Decisions + What-If Simulator + Dispatch Briefs ─────────────── */}
      {tab === 'decisions' && (
        <div className="space-y-5">
          <section className={`${card} flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="min-w-0 space-y-1">
              <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                {T(
                  `${visible.length} practical steps in view · +${kwd(visibleMonthly)} / month · +${kwd(visibleMonthly * 12)} / year`,
                  `${visible.length} خطوة عملية في العرض · +${kwd(visibleMonthly)} شهرياً · +${kwd(visibleMonthly * 12)} سنوياً`,
                )}
              </p>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                {live.status === 'done'
                  ? T(
                      `${live.live ? 'Live Odoo data' : 'Verified Odoo snapshot'} · Nov MTD ${kwd(live.mtdNet ?? 0)}${live.mtdPerDay ? ` · ${kwd(live.mtdPerDay)}/day` : ''}`,
                      `${live.live ? 'بيانات أودو المباشرة' : 'بيانات أودو الموثقة'} · منذ بداية نوفمبر ${kwd(live.mtdNet ?? 0)}${live.mtdPerDay ? ` · ${kwd(live.mtdPerDay)} يومياً` : ''}`,
                    )
                  : T(
                      `Last synced ${new Date(JOURNEY_META.syncedAt).toLocaleString('en-GB')} · ${JOURNEY_META.mtdEn}`,
                      `آخر تحديث من أودو ${new Date(JOURNEY_META.syncedAt).toLocaleString('en-GB')} · ${JOURNEY_META.mtdAr}`,
                    )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void scan(false)}
              disabled={live.status === 'scanning'}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#0F172A] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              <RefreshCw className={`h-4 w-4 ${live.status === 'scanning' ? 'animate-spin' : ''}`} />
              {scanLabel}
            </button>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {JOURNEY_STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={stage === s.id}
                onClick={() => setStage(s.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all ${
                  stage === s.id
                    ? 'bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-slate-950'
                    : 'bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)] hover:bg-slate-50 dark:bg-[#0F1626] dark:text-slate-200 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                }`}
              >
                {isAr ? s.ar : s.en}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${stage === s.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.08]'}`}>
                  {counts[s.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className={`${card} p-6 text-[14px] text-slate-500`}>
              {T('No action needed in this section for the current Odoo period.', 'لا توجد ملاحظات تحتاج تدخلاً في هذا القسم حالياً.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {visible.map((p) => {
                const approved = approvals.some((a) => a.id === p.id)
                const sev = SEVERITY[p.severity]
                const stageLabel = JOURNEY_STAGES.find((s) => s.id === p.stage)
                const { vals, res: sim } = getPlaySimulated(p)
                const isSimOpen = Boolean(openSim[p.id])
                const activeBriefMode = openBrief[p.id] ?? null
                const vendorClaimText = buildVendorCreditNoteRequest(p, isAr)
                const dispatchText = buildDispatchBrief(p, isAr, sim.monthlyKwd)
                const isHighlighted = highlightedPlayId === p.id

                const prompt = isAr
                  ? `ناقشي معي خطوات تنفيذ "${p.titleAr}" (${p.subjectAr}) مع (${p.ownerRoleAr})، وكيف نحقق +${f0(sim.monthlyKwd)} د.ك شهرياً خلال 14 يوماً.`
                  : `Let's walk through "${p.titleEn}" (${p.subjectEn}) with ${p.ownerRoleEn}, and verify +${f0(sim.monthlyKwd)} KWD/month within 14 days.`

                const blocks = [
                  { n: T('1', '١'), title: T('What We Found', 'المشكلة أو الفرصة المرصودة'), body: isAr ? p.leakAr : p.leakEn, tone: 'plain' },
                  { n: T('2', '٢'), title: T('Practical Step to Take', 'الخطوة العملية المقترحة'), body: isAr ? p.actionAr : p.actionEn, tone: 'plain' },
                  { n: T('3', '٣'), title: T('Effect on Food & Service Quality', 'الأثر على جودة الأكل والخدمة'), body: isAr ? p.qualityAr : p.qualityEn, tone: 'plain' },
                  { n: T('4', '٤'), title: T('Expected Monthly & Annual Gain', 'التوفير أو الربح الإضافي المتوقع'), body: isAr ? p.impactAr : p.impactEn, tone: 'outcome' },
                ]

                return (
                  <article
                    id={`play-card-${p.id}`}
                    key={p.id}
                    className={`${card} flex flex-col gap-4 p-6 transition-shadow ${
                      approved
                        ? 'ring-2 ring-emerald-500/60'
                        : isHighlighted
                          ? 'ring-2 ring-sky-500/70'
                          : ''
                    }`}
                  >
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sev.cls}`}>{isAr ? sev.ar : sev.en}</span>
                          <span className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                            {isAr ? stageLabel?.ar : stageLabel?.en}
                          </span>
                          <span className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                            {p.basis === 'posted' ? T('Recorded in Odoo', 'مسجل فعلياً في أودو') : T('Estimated gain', 'تقدير محسوب بوضوح')}
                          </span>
                        </div>
                        <h2 className="text-[16.5px] font-bold leading-snug text-slate-950 dark:text-white">{isAr ? p.titleAr : p.titleEn}</h2>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">{isAr ? p.subjectAr : p.subjectEn}</p>
                        <p className="text-[11.5px] font-semibold text-sky-700 dark:text-sky-300">
                          {T('Owner:', 'المسؤول:')} {isAr ? p.ownerRoleAr : p.ownerRoleEn}
                        </p>
                      </div>

                      <div className="shrink-0 text-end">
                        <div
                          dir="ltr"
                          className="whitespace-nowrap rounded-full bg-emerald-50 px-3.5 py-1 text-[13.5px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {p.monthlyKwd > 0
                            ? isAr
                              ? `+${f0(sim.monthlyKwd)} د.ك / شهر`
                              : `+${f0(sim.monthlyKwd)} KWD / mo`
                            : T('Control & cash', 'متابعة وسيولة')}
                        </div>
                        {sim.annualKwd > 0 && (
                          <div dir="ltr" className="mt-1 text-[11.5px] font-bold tabular-nums text-slate-400">
                            {isAr ? `+${f0(sim.annualKwd)} د.ك سنوياً` : `+${f0(sim.annualKwd)} KWD / yr`}
                            {sim.deltaVsDefaultKwd !== 0 && (
                              <span className={sim.deltaVsDefaultKwd > 0 ? 'ms-1 text-emerald-600' : 'ms-1 text-amber-600'}>
                                ({sim.deltaVsDefaultKwd > 0 ? '+' : ''}
                                {f0(sim.deltaVsDefaultKwd)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </header>

                    {/* Superpower #3: RMS / Juicer Price Elasticity & Traffic-Driver Guardrail */}
                    {p.elasticityGuardrail && (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div className="rounded-2xl bg-emerald-50/70 p-3.5 dark:bg-emerald-950/25">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-800 dark:text-emerald-300">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            {T('Popular Dishes Safe for Small Price Step', 'أصناف تتحمل تعديل بسيط بالسعر')}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-[12px] font-medium text-emerald-950 dark:text-emerald-100">
                            {p.elasticityGuardrail.inelastic.map((it) => (
                              <li key={it.name} className="flex items-center justify-between gap-2">
                                <span className="truncate">{isAr ? arItemName(it.name) : enItemName(it.name)}</span>
                                <span dir="ltr" className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800 dark:bg-white/10 dark:text-emerald-200">
                                  +{it.suggestedFils} {isAr ? 'فلس' : 'fils'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl bg-amber-50/75 p-3.5 dark:bg-amber-950/25">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-amber-900 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {T('Core Value Dishes — Keep Price Fixed', 'أصناف أساسية تجذب الزبائن (يبقى سعرها ثابتاً)')}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-[12px] font-medium text-amber-950 dark:text-amber-100">
                            {p.elasticityGuardrail.trafficDrivers.map((td) => (
                              <li key={td.name} className="truncate" title={isAr ? td.ruleAr : td.ruleEn}>
                                • {isAr ? arItemName(td.name) : enItemName(td.name)} ({f3(td.priceKwd)} {isAr ? 'د.ك' : 'KWD'})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Superpower #5: MarginEdge / Supy Affected Dishes Pill Strip */}
                    {p.vendorShield && (
                      <div className="rounded-2xl bg-amber-50/65 p-3.5 dark:bg-amber-950/25">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-amber-900 dark:text-amber-300">
                            {T('Ingredients With Price Increases Affecting These Dishes:', 'مواد ارتفع سعرها وتؤثر على هذه الأطباق:')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenBrief((prev) => ({ ...prev, [p.id]: prev[p.id] === 'vendor' ? null : 'vendor' }))}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-900 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-amber-950 dark:bg-amber-400 dark:text-slate-950"
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                            {T('Vendor Price-Lock & Credit Request', 'طلب تثبيت السعر وتعويض الفرق من المورد')}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[...new Set(p.vendorShield.items.flatMap((i) => i.affectedDishes))].map((dish) => (
                            <span key={dish} className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow-sm dark:bg-white/10 dark:text-slate-200">
                              {isAr ? arItemName(dish) : enItemName(dish)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Field-Execution #2: Ardiya Central Kitchen Dynamic Prep-Par & Zero-Stockout Strip */}
                    {p.prepParSpec && (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <div className="rounded-2xl bg-sky-50/75 p-3 dark:bg-sky-950/25">
                          <div className="text-[11px] font-bold text-sky-900 dark:text-sky-300">
                            {T('Sun–Tue Spoilage Cap', 'سقف تحضير الأحد–الثلاثاء')}
                          </div>
                          <div dir="ltr" className="mt-1 text-[16px] font-extrabold tabular-nums text-sky-950 dark:text-sky-100">
                            {p.prepParSpec.weekdayMultiplier}x
                          </div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50/75 p-3 dark:bg-emerald-950/25">
                          <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                            {isAr ? p.prepParSpec.dispatchCutoffAr : p.prepParSpec.dispatchCutoffEn}
                          </div>
                          <div dir="ltr" className="mt-1 text-[16px] font-extrabold tabular-nums text-emerald-950 dark:text-emerald-100">
                            {p.prepParSpec.weekendMultiplier}x (+{p.prepParSpec.surgePct}%)
                          </div>
                        </div>
                        <div className="rounded-2xl bg-amber-50/75 p-3 dark:bg-amber-950/25">
                          <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                            {T('Zero-Stockout Guard Window', 'نافذة منع نفاد الأصناف')}
                          </div>
                          <div className="mt-1 text-[12px] font-bold text-amber-950 dark:text-amber-100">
                            {isAr ? p.prepParSpec.peakWindowAr : p.prepParSpec.peakWindowEn}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Field-Execution #4: Self-Funded Cashier Upsell Scripts & Micro-Incentive Rule */}
                    {p.cashierUpsell && (
                      <div className="rounded-2xl bg-emerald-50/65 p-3.5 dark:bg-emerald-950/25">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-emerald-900 dark:text-emerald-300">
                            {T('1-Line Counter Upsell Scripts · Self-Funded Bonus Gate:', 'جمل البيع الإضافي للكاشير · قاعدة الحافز المموّل ذاتياً:')}
                          </span>
                          <span dir="ltr" className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {isAr
                              ? `${p.cashierUpsell.weeklyBonusKwd} د.ك/أسبوع بعد +${p.cashierUpsell.unlockThresholdNetKwd} د.ك هامش صافي`
                              : `${p.cashierUpsell.weeklyBonusKwd} KWD/wk after +${p.cashierUpsell.unlockThresholdNetKwd} KWD net`}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {p.cashierUpsell.scripts.map((sc) => (
                            <div key={sc.brandId} className="rounded-xl bg-white/85 px-3 py-2 text-[12px] shadow-sm dark:bg-white/[0.07]">
                              <div className="flex items-center justify-between gap-2 font-bold text-slate-900 dark:text-white">
                                <span>{isAr ? sc.brandAr : sc.brandEn}</span>
                                <span dir="ltr" className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                  +{f3(sc.addonPriceKwd)} {isAr ? 'د.ك' : 'KWD'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600 dark:text-slate-300">
                                {isAr ? sc.scriptAr : sc.scriptEn}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11.5px] font-semibold text-emerald-800 dark:text-emerald-300">
                          {isAr ? p.cashierUpsell.ruleAr : p.cashierUpsell.ruleEn}
                        </p>
                      </div>
                    )}

                    {/* Field-Execution #5: Zero-Commission Corporate Towers & Kuwaiti Diwaniya Direct Boxes */}
                    {p.directBoxPlaybook && (
                      <div className="rounded-2xl bg-sky-50/70 p-3.5 dark:bg-sky-950/25">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-sky-900 dark:text-sky-300">
                            {T('0%-Commission Corporate & Diwaniya Direct Boxes:', 'بوكسات الأبراج والديوانيات المباشرة (عمولة ٠٪):')}
                          </span>
                          <span className="rounded-full bg-sky-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {T('0% Platform Commission', 'صفر عمولة منصات')}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {p.directBoxPlaybook.boxes.map((bx) => (
                            <div key={bx.id} className="rounded-xl bg-white/90 p-2.5 text-[11.5px] shadow-sm dark:bg-white/[0.07]">
                              <div className="flex items-center justify-between gap-1 font-bold text-slate-900 dark:text-white">
                                <span className="truncate">{isAr ? bx.boxNameAr : bx.boxNameEn}</span>
                                <span dir="ltr" className="shrink-0 text-emerald-700 dark:text-emerald-300">
                                  {f3(bx.priceKwd)} {isAr ? 'د.ك' : 'KWD'}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                {isAr ? `${bx.segmentAr} · ${bx.hubBranchAr}` : `${bx.segmentEn} · ${bx.hubBranchEn}`}
                              </div>
                              <p className="mt-1 leading-snug text-slate-600 dark:text-slate-300">
                                {isAr ? bx.contentsAr : bx.contentsEn}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11.5px] font-semibold text-sky-900 dark:text-sky-300">
                          {isAr ? p.directBoxPlaybook.qrRetentionRuleAr : p.directBoxPlaybook.qrRetentionRuleEn}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {blocks.map((b) => (
                        <div
                          key={b.title}
                          className={
                            b.tone === 'outcome'
                              ? 'rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30'
                              : 'ae-studio-subcard p-4'
                          }
                        >
                          <div className={`text-[12px] font-bold ${b.tone === 'outcome' ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                            {b.n}. {b.title}
                          </div>
                          <p className={`mt-1 text-[13.5px] leading-[1.78] ${b.tone === 'outcome' ? 'text-emerald-950 dark:text-emerald-50' : 'text-slate-800 dark:text-slate-100'}`}>
                            {b.body}
                          </p>
                        </div>
                      ))}
                    </div>

                    {p.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.evidence.map((e) => (
                          <span key={e.en} className="rounded-full bg-[#F6F7F9] px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                            {isAr ? e.ar : e.en}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Superpower #1: Palantir AIP Interactive "What-If" Simulator Drawer */}
                    {isSimOpen && p.monthlyKwd > 0 && (
                      <div className="ae-pop rounded-2xl bg-slate-900/[0.03] p-4 ring-1 ring-slate-900/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.08]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12.5px] font-bold text-slate-900 dark:text-white">
                            {T('Quick Profit Calculator (Adjust Numbers)', 'حاسبة الربح السريعة (جرّب تعديل النسب)')}
                          </span>
                          <span dir="ltr" className="rounded-full bg-emerald-600 px-3 py-0.5 text-[12px] font-extrabold tabular-nums text-white">
                            +{f0(sim.monthlyKwd)} {isAr ? 'د.ك/شهر' : 'KWD/mo'} · +{f0(sim.annualKwd)} {isAr ? 'د.ك/سنة' : 'KWD/yr'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {p.simulator.sliders.map((sl, idx) => {
                            const val = vals[idx]
                            return (
                              <label key={sl.id} className="block space-y-1.5">
                                <div className="flex items-center justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                  <span>{isAr ? sl.labelAr : sl.labelEn}</span>
                                  <span dir="ltr" className="font-extrabold tabular-nums text-slate-950 dark:text-white">
                                    {sl.unit === 'fils' ? `+${val} ${isAr ? 'فلس' : 'fils'}` : `${val}%`}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={sl.min}
                                  max={sl.max}
                                  step={sl.step}
                                  value={val}
                                  onChange={(e) => {
                                    const nextVal = Number(e.target.value)
                                    setSimValues((prev) => {
                                      const cur = prev[p.id] ?? [p.simulator.sliders[0].defaultValue, p.simulator.sliders[1].defaultValue]
                                      return { ...prev, [p.id]: idx === 0 ? [nextVal, cur[1]] : [cur[0], nextVal] }
                                    })
                                  }}
                                  className="h-2 w-full cursor-pointer accent-slate-900 dark:accent-emerald-400"
                                />
                              </label>
                            )
                          })}
                        </div>
                        <p className="mt-2.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">{isAr ? sim.formulaAr : sim.formulaEn}</p>
                      </div>
                    )}

                    {/* Superpower #2 & #5: Dispatch Brief / Vendor Credit-Note Drawer */}
                    {activeBriefMode && (
                      <div className="ae-pop rounded-2xl bg-slate-950 p-4 text-slate-100 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-400">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            {activeBriefMode === 'vendor'
                              ? T('Vendor Price-Lock & Credit Request', 'طلب تثبيت السعر وتعويض الفرق من المورد')
                              : T('Team Brief + 5-Min Spot Check (3 Points)', 'رسالة توجيه للفريق + فحص ٣ نقاط في ٥ دقائق')}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void copyText(`${p.id}-${activeBriefMode}`, activeBriefMode === 'vendor' && vendorClaimText ? vendorClaimText : dispatchText)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-white/25"
                            >
                              {copiedKey === `${p.id}-${activeBriefMode}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedKey === `${p.id}-${activeBriefMode}` ? T('Copied', 'تم النسخ') : T('Copy message', 'نسخ الرسالة')}
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(activeBriefMode === 'vendor' && vendorClaimText ? vendorClaimText : dispatchText)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-500"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {T('Send via WhatsApp', 'إرسال عبر واتساب')}
                            </a>
                          </div>
                        </div>
                        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/[0.06] p-3 font-sans text-[12px] leading-relaxed text-slate-100">
                          {activeBriefMode === 'vendor' && vendorClaimText ? vendorClaimText : dispatchText}
                        </pre>
                      </div>
                    )}

                    {/* Action Bar */}
                    <footer className="mt-auto space-y-2 pt-1">
                      <div className="flex flex-wrap gap-2">
                        {p.monthlyKwd > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenSim((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                            className={pill}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            {T('Adjust Numbers', 'جرّب تعديل الأرقام')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenBrief((prev) => ({ ...prev, [p.id]: prev[p.id] === 'dispatch' ? null : 'dispatch' }))}
                          className={pill}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          {T('Team Brief · 5-Min Check', 'رسالة توجيه للفريق + فحص ٥ دقائق')}
                        </button>
                        <Link href={feryalHref(prompt)} className={pill}>
                          <Sparkles className="h-3.5 w-3.5" />
                          {T('Discuss with Feryal', 'ناقش مع فريال')}
                        </Link>
                      </div>
                      <button
                        type="button"
                        aria-pressed={approved}
                        onClick={() => approve(p, sim.monthlyKwd)}
                        className={`inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98] ${
                          approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:text-slate-950'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {approved
                          ? T('Approved · Tracking Before vs. After (14 Days)', 'معتمد · قيد متابعة النتيجة قبل وبعد (١٤ يوماً)')
                          : T('Approve Step & Track Results (Before vs. After)', 'اعتماد الخطوة ومتابعة نتيجتها (قبل وبعد)')}
                      </button>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── Tab 3 — Full 3-State Verified Impact Tracker ─────────────── */}
      {tab === 'tracker' && (
        <div className="space-y-5">
          <section className={`${card} flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="min-w-0 space-y-1">
              <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                {T(
                  `${approvals.length} approved steps in tracking · +${kwd(approvals.reduce((s, a) => s + a.monthlyKwd, 0))} / month target`,
                  `${approvals.length} خطوات معتمدة قيد المتابعة · المستهدف +${kwd(approvals.reduce((s, a) => s + a.monthlyKwd, 0))} شهرياً`,
                )}
              </p>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                {T(
                  `Odoo numbers are saved on approval so you can compare before vs. after every ${CYCLE_DAYS} days.`,
                  `يُحفظ الرقم الحالي من أودو لحظة الاعتماد، وتتم مقارنة الأداء قبل وبعد كل ${CYCLE_DAYS} يوماً تلقائياً.`,
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', labelEn: `All (${evaluatedApprovals.length})`, labelAr: `الكل (${evaluatedApprovals.length})` },
                  {
                    id: 'verified',
                    labelEn: `✅ Improved (${evaluatedApprovals.filter((x) => x.status === 'verified').length})`,
                    labelAr: `✅ تحسن فعلي (${evaluatedApprovals.filter((x) => x.status === 'verified').length})`,
                  },
                  {
                    id: 'monitoring',
                    labelEn: `⏳ Tracking (${evaluatedApprovals.filter((x) => x.status === 'monitoring').length})`,
                    labelAr: `⏳ قيد المتابعة (${evaluatedApprovals.filter((x) => x.status === 'monitoring').length})`,
                  },
                  {
                    id: 'stalled',
                    labelEn: `⚠️ Needs Follow-Up (${evaluatedApprovals.filter((x) => x.status === 'stalled').length})`,
                    labelAr: `⚠️ يحتاج متابعة مع فريال (${evaluatedApprovals.filter((x) => x.status === 'stalled').length})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTrackerFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    trackerFilter === f.id
                      ? 'bg-[#0F172A] text-white dark:bg-white dark:text-slate-950'
                      : 'bg-[#F6F7F9] text-slate-700 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-200'
                  }`}
                >
                  {isAr ? f.labelAr : f.labelEn}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void scan(false)}
                disabled={live.status === 'scanning'}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#0F172A] px-4 py-2 text-[12.5px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${live.status === 'scanning' ? 'animate-spin' : ''}`} />
                {scanLabel}
              </button>
            </div>
          </section>

          {filteredApprovals.length === 0 ? (
            <div className={`${card} flex flex-col items-center gap-3 p-10 text-center`}>
              <Timer className="h-8 w-8 text-slate-300" />
              <p className="max-w-xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                {T(
                  'Approve any step in "Profit & Savings Steps" to save today’s Odoo numbers and track before-vs-after results over 14 days.',
                  'اعتمد أي خطوة من تبويب «خطوات زيادة الربح وتقليل الهدر» لحفظ الرقم الحالي من أودو ومتابعة النتيجة قبل وبعد خلال 14 يوماً.',
                )}
              </p>
              <button type="button" onClick={() => setTab('decisions')} className={pill}>
                {T('View profit & savings steps', 'عرض خطوات زيادة الربح وتقليل الهدر')}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {filteredApprovals.map(({ a, days, cycle, next, now, fresh, status }) => {
                const progress = Math.min(100, Math.max(8, ((days % CYCLE_DAYS) / CYCLE_DAYS) * 100))
                const statusBadge =
                  status === 'verified'
                    ? {
                        cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                        label: T('✅ Verified Improvement', '✅ تحسن فعلي بالأرقام'),
                      }
                    : status === 'stalled'
                      ? {
                          cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                          label: T('⚠️ Needs Follow-Up with Feryal', '⚠️ يحتاج متابعة مع فريال'),
                        }
                      : {
                          cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                          label: T('⏳ Tracking (14-Day Window)', '⏳ قيد المتابعة (١٤ يوماً)'),
                        }

                const stallPrompt = isAr
                  ? `خطوة "${a.titleAr}" قيد المتابعة حالياً (الرقم قبل التنفيذ: ${journeyKpiFormat(a.kpi, true)}). ما الإجراء السريع مع المسؤول (${a.ownerRoleAr ?? 'مدير الفرع'})؟`
                  : `Step "${a.titleEn}" is currently at ${journeyKpiFormat(a.kpi, false)}. Give me a quick follow-up action with ${a.ownerRoleEn ?? 'the branch manager'}.`

                return (
                  <article key={a.id} className={`${card} flex flex-col gap-4 p-6`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${statusBadge.cls}`}>{statusBadge.label}</span>
                      <span className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                        {T(`Cycle ${cycle}`, `الدورة ${cycle}`)}
                      </span>
                    </div>

                    <h3 className="text-[15.5px] font-bold leading-snug text-slate-950 dark:text-white">{isAr ? a.titleAr : a.titleEn}</h3>
                    <p className="text-[12px] font-medium text-slate-500">{isAr ? a.kpi.ar : a.kpi.en}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="ae-studio-subcard p-3.5">
                        <div className="text-[11px] font-semibold text-slate-500">{T('Before (When Approved)', 'قبل التنفيذ')}</div>
                        <div dir="ltr" className="mt-1 text-[18px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                          {journeyKpiFormat(a.kpi, isAr)}
                        </div>
                      </div>
                      <div
                        className={`rounded-2xl p-3.5 ${
                          status === 'verified'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30'
                            : status === 'stalled'
                              ? 'bg-rose-50 dark:bg-rose-950/30'
                              : 'ae-studio-subcard'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-slate-500">{T('After (Latest Odoo Sync)', 'بعد التنفيذ (آخر تحديث)')}</div>
                        <div dir="ltr" className="mt-1 text-[18px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                          {fresh && now !== undefined ? journeyKpiFormat({ ...a.kpi, value: now }, isAr) : T('Tracking', 'قيد المتابعة')}
                        </div>
                      </div>
                    </div>

                    <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {status === 'verified'
                        ? T('Numbers improved in Odoo — keep this step in place permanently.', 'تحسنت الأرقام فعلياً في أودو — استمر على هذه الخطوة بشكل دائم.')
                        : status === 'stalled'
                          ? T('Numbers have not improved yet — review the cause with Feryal.', 'لم تتحسن الأرقام بعد — راجع السبب مع المستشارة فريال.')
                          : T(`14-day tracking active · next check on ${next.toLocaleDateString('en-GB')}.`, `المتابعة مستمرة لمدة 14 يوماً · المراجعة القادمة ${next.toLocaleDateString('en-GB')}.`)}
                    </p>

                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            status === 'verified' ? 'bg-emerald-500' : status === 'stalled' ? 'bg-rose-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{T(`Day ${days % CYCLE_DAYS} of ${CYCLE_DAYS}`, `اليوم ${days % CYCLE_DAYS} من ${CYCLE_DAYS}`)}</span>
                        <span>{T(`Approved ${new Date(a.approvedAt).toLocaleDateString('en-GB')}`, `اعتُمد ${new Date(a.approvedAt).toLocaleDateString('en-GB')}`)}</span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                      <Link href={feryalHref(stallPrompt)} className={pill}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {T('Discuss with Feryal', 'ناقش مع فريال')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => persist(approvals.filter((x) => x.id !== a.id))}
                        className="rounded-full px-3 py-1 text-[12px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06]"
                      >
                        {T('Remove', 'إزالة')}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
