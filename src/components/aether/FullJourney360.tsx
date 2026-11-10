'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Radar, RefreshCw, Sparkles, Timer } from 'lucide-react'
import {
  JOURNEY_KPI_NOW,
  JOURNEY_META,
  JOURNEY_PLAYS,
  JOURNEY_SHORTCUTS,
  JOURNEY_STAGES,
  journeyKpiFormat,
  type JourneyPlay,
  type JourneyStage,
  type PlayKpi,
} from '@/lib/full-journey-enterprise-brain'
import { BRANCHES, BRANDS, feryalHref } from '@/lib/aether/ledger'
import { useLang } from '@/components/aether/ui'

type Tab = 'shortcuts' | 'decisions' | 'tracker'
type Glow = 'emerald' | 'amber' | 'sky' | 'rose'
type Live = { status: 'idle' | 'scanning' | 'done' | 'unauthorized' | 'error'; at?: string; live?: boolean; mtdPerDay?: number; mtdNet?: number; rollingNet?: number; priorNet?: number; restricted?: string[] }
interface Approval { id: string; approvedAt: string; snapshotAt: string; kpi: PlayKpi; monthlyKwd: number; titleEn: string; titleAr: string; livePerDay?: number }

const STORE = 'vf-journey-approvals-v1'
const CYCLE_DAYS = 14
const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const GLOW: Record<Glow, string> = { emerald: 'bg-emerald-400', amber: 'bg-amber-400', sky: 'bg-sky-400', rose: 'bg-rose-400' }
const card = 'relative overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(15,23,42,0.04)] dark:bg-neutral-900'
const pill =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-800 transition-all duration-150 hover:bg-neutral-200 active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
const SEVERITY: Record<JourneyPlay['severity'], { en: string; ar: string; cls: string }> = {
  critical: { en: 'Critical', ar: 'حرج', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  high: { en: 'High', ar: 'مرتفع', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  medium: { en: 'Medium', ar: 'متوسط', cls: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
}

function Shortcut({ glow, title, metric, sub, takeaway, meta, action, children }: { glow: Glow; title: string; metric: ReactNode; sub?: string; takeaway: ReactNode; meta: string; action: ReactNode; children?: ReactNode }) {
  return (
    <article className={`${card} group flex min-h-[236px] flex-col gap-3 p-6 transition-transform duration-200 hover:-translate-y-0.5`} style={{ transitionTimingFunction: SPRING }}>
      <span aria-hidden className={`pointer-events-none absolute -end-14 -top-14 h-44 w-44 rounded-full opacity-[0.18] blur-2xl ${GLOW[glow]}`} />
      <h2 className="relative text-[14.5px] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-white">{title}</h2>
      <div className="relative">
        <div className="break-words text-[26px] font-semibold leading-tight tracking-tight tabular-nums text-neutral-950 dark:text-white">{metric}</div>
        {sub && <div className="mt-1 text-[12.5px] text-neutral-500 dark:text-neutral-400">{sub}</div>}
      </div>
      {children}
      <p className="relative text-[13.5px] leading-relaxed text-neutral-600 dark:text-neutral-300">{takeaway}</p>
      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11.5px] text-neutral-400">{meta}</span>
        {action}
      </div>
    </article>
  )
}

/** المركز الشامل للمختصرات وقرارات الرحلة الكاملة — 360° executive shortcuts, journey decisions and verified impact. */
export function FullJourney360() {
  const { isAr, T } = useLang()
  const [tab, setTab] = useState<Tab>('shortcuts')
  const [stage, setStage] = useState<JourneyStage | 'all'>('all')
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [live, setLive] = useState<Live>({ status: 'idle' })

  useEffect(() => {
    try {
      setApprovals(JSON.parse(localStorage.getItem(STORE) || '[]'))
    } catch {}
  }, [])
  const persist = (next: Approval[]) => {
    setApprovals(next)
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
    } catch {}
  }

  const scan = useCallback(async () => {
    setLive({ status: 'scanning' })
    try {
      const res = await fetch('/api/odoo-sync', { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (res.status === 401) return setLive({ status: 'unauthorized' })
      if (!res.ok) throw new Error(String(res.status))
      const d = await res.json()
      setLive({ status: 'done', at: d.syncedAt, live: d.source === 'live', mtdNet: d.journeyPulse?.mtd?.netKwd ?? d.totals?.netSalesKwd, mtdPerDay: d.journeyPulse?.mtd?.perDayKwd, rollingNet: d.journeyPulse?.rolling30?.netKwd, priorNet: d.journeyPulse?.prior30?.netKwd, restricted: d.access?.restricted })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: d }))
    } catch {
      setLive({ status: 'error' })
    }
  }, [])

  const approve = (p: JourneyPlay) => {
    if (approvals.some((a) => a.id === p.id)) return persist(approvals.filter((a) => a.id !== p.id))
    persist([...approvals, { id: p.id, approvedAt: new Date().toISOString(), snapshotAt: JOURNEY_META.syncedAt, kpi: p.kpi, monthlyKwd: p.monthlyKwd, titleEn: p.titleEn, titleAr: p.titleAr, livePerDay: live.mtdPerDay }])
  }

  const kwd = (n: number, d = 0) => (isAr ? `${d ? f3(n) : f0(n)} د.ك` : `${d ? f3(n) : f0(n)} KWD`)
  const loc = (id: string | undefined) => {
    const b = BRANCHES.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id === 'central-kitchen' ? T('Ardiya Central Kitchen', 'المطبخ المركزي بالعارضية') : id ?? ''
  }
  const brand = (id: string | undefined) => {
    const b = BRANDS.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id ?? ''
  }
  const openStage = (s: JourneyStage | 'all') => {
    setStage(s)
    setTab('decisions')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
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
  const visibleMonthly = visible.reduce((s, p) => s + p.monthlyKwd, 0)
  const tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'shortcuts', en: '360° Smart Shortcuts', ar: 'المختصرات الذكية الشاملة' },
    { id: 'decisions', en: 'End-to-End Journey Decisions', ar: 'قرارات الرحلة الكاملة (من البداية للنهاية)' },
    { id: 'tracker', en: 'Verified Impact Tracker', ar: 'متابعة الأثر الفعلي (قبل وبعد)' },
  ]
  const tabIndex = tabs.findIndex((t) => t.id === tab)
  const side = isAr ? 'right' : 'left'
  const scanLabel =
    live.status === 'scanning' ? T('Scanning Odoo…', 'جارٍ فحص أودو…') : live.status === 'unauthorized' ? T('Sign in to scan', 'سجّل الدخول للفحص') : live.status === 'error' ? T('Scan failed — retry', 'تعذّر الفحص — أعد المحاولة') : T('Refresh & scan Odoo now', 'تحديث وفحص أودو الآن')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="rounded-[28px] bg-[#F7F7F8] dark:bg-[#0A0A0A]">
      <div className="mx-auto w-full max-w-[1520px] space-y-6 px-6 py-6 lg:px-10">
        {/* Masthead */}
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-neutral-950 sm:text-[26px] dark:text-white">
              {T('360° Executive Shortcuts & Full-Journey Playbook', 'المركز الشامل للمختصرات وقرارات الرحلة الكاملة')}
            </h1>
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
              {T(
                `From Ardiya Central Kitchen to the bank · ${period} · ${f1(JOURNEY_META.growthPct)}% vs prior 30 days · ${JOURNEY_META.stagesCovered}/7 stages · ${JOURNEY_META.analyticCenters} Odoo Analytic Cost Centers (${JOURNEY_META.readable.length} models)`,
                `من المطبخ المركزي بالعارضية حتى البنك · ${period} · ${f1(JOURNEY_META.growthPct)}% مقارنة بالثلاثين يوماً السابقة · ${JOURNEY_META.stagesCovered}/7 مراحل · ${JOURNEY_META.analyticCenters} مركز تكلفة تحليلي في أودو (${JOURNEY_META.readable.length} نموذجاً)`,
              )}
            </p>
          </div>
          <div role="tablist" aria-label={T('View', 'طريقة العرض')} className="relative grid w-full shrink-0 grid-cols-3 rounded-full bg-neutral-200/70 p-1 xl:w-auto dark:bg-neutral-800">
            <span
              aria-hidden
              className="absolute bottom-1 top-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(15,23,42,0.06)] dark:bg-neutral-950"
              style={{ width: 'calc(33.333% - 2.67px)', [side]: `calc(${tabIndex * 33.333}% + ${4 - tabIndex * 1.33}px)`, transition: `${side} 200ms ${SPRING}` } as CSSProperties}
            />
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative z-10 truncate rounded-full px-3 py-2 text-[12.5px] font-semibold transition-colors duration-150 sm:px-5 sm:text-[13px] focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 ${tab === t.id ? 'text-neutral-950 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>
        </header>

        {/* ─────────────── Tab 1 — 8 smart shortcuts ─────────────── */}
        {tab === 'shortcuts' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Shortcut
              glow="sky"
              title={T('True Net Pocket per 10 KWD', 'صافي الجيب الحقيقي من كل ١٠ د.ك')}
              metric={kwd(S.netPocket.per10, 3)}
              sub={T('kept from every 10 KWD at menu price', 'يبقى من كل 10 د.ك بسعر المنيو')}
              takeaway={T(
                `Actual food cost takes ${f3(S.netPocket.food)}, platform fees ${f3(S.netPocket.fees)}, promotions ${f3(S.netPocket.promos)} and packaging ${f3(S.netPocket.packaging)} KWD of every 10 KWD at the 7 restaurants.`,
                `تأخذ تكلفة الأغذية الفعلية ${f3(S.netPocket.food)} وعمولات المنصات ${f3(S.netPocket.fees)} والعروض ${f3(S.netPocket.promos)} والتغليف ${f3(S.netPocket.packaging)} د.ك من كل 10 د.ك في المطاعم السبعة.`,
              )}
              meta={T('Posted Odoo costs · 7 restaurants', 'تكاليف أودو المرحّلة · المطاعم السبعة')}
              action={goTo('kitchen', T('Raise it', 'كيف نرفعه'))}
            />
            <Shortcut
              glow="emerald"
              title={T('Total Unlockable Annual Net Profit', 'إجمالي القفزة السنوية المتاحة في الأرباح')}
              metric={kwd(S.unlockable.annualKwd)}
              sub={T(`${kwd(S.unlockable.monthlyKwd)} per month`, `${kwd(S.unlockable.monthlyKwd)} شهرياً`)}
              takeaway={T(`${S.unlockable.plays} surgical decisions across ${JOURNEY_META.stagesCovered} journey stages, each with an exact owner, Odoo baseline and expected result.`, `${S.unlockable.plays} قراراً جراحياً عبر ${JOURNEY_META.stagesCovered} مراحل من الرحلة، لكل قرار مسؤول وخط أساس من أودو ونتيجة متوقعة.`)}
              meta={T('Posted + stated-assumption estimates', 'مرحّل + تقديرات بافتراضات معلنة')}
              action={goTo('all', T('See all decisions', 'عرض كل القرارات'))}
            />
            <Shortcut
              glow="amber"
              title={T('Procurement & Kitchen Yield Shield', 'درع المشتريات والمطبخ المركزي')}
              metric={kwd(S.shield.monthlyKwd)}
              sub={T('recoverable per month', 'قابلة للاسترداد شهرياً')}
              takeaway={T(
                `Count variance adds ${f1(S.shield.variancePctOfFood)}% on top of recipe consumption (${kwd(S.shield.varianceKwd)} in 30 days)${S.shield.topCreep ? `; ${S.shield.topCreep.name} rose ${f1(S.shield.topCreep.creepPct)}% from suppliers` : ''}.`,
                `فروقات الجرد تضيف ${f1(S.shield.variancePctOfFood)}% فوق استهلاك الوصفات (${kwd(S.shield.varianceKwd)} خلال 30 يوماً)${S.shield.topCreep ? `؛ وارتفع ${S.shield.topCreep.name} بنسبة ${f1(S.shield.topCreep.creepPct)}% من الموردين` : ''}.`,
              )}
              meta={T('Purchase lines · BOMs · stock counts', 'سطور الشراء · قوائم المواد · الجرد')}
              action={goTo('procurement', T('Shield plan', 'خطة الدرع'))}
            />
            <Shortcut
              glow="rose"
              title={T('Hidden OpEx, Custodies & Repair-vs-Replace', 'المصاريف الخفية والعُهد والصيانة')}
              metric={kwd(S.hiddenOpex.monthlyKwd)}
              sub={T('hidden losses & unallocated OpEx in 30 days', 'خسائر خفية ومصاريف غير محمّلة خلال 30 يوماً')}
              takeaway={T(
                `Count variance, scrap and reactive repairs on cost centers, ${kwd(S.hiddenOpex.unallocatedKwd)} unallocated OpEx, plus ${kwd(S.hiddenOpex.custodyKwd)} in open custodies.${S.hiddenOpex.repairLoop ? ` Alert: ${S.hiddenOpex.repairLoop.titleEn}.` : ''}`,
                `فروقات الجرد والهالك والأعطال على مراكز التكلفة، و${kwd(S.hiddenOpex.unallocatedKwd)} غير محمّلة، إضافة إلى ${kwd(S.hiddenOpex.custodyKwd)} في عُهد مفتوحة.${S.hiddenOpex.repairLoop ? ` تنبيه: ${S.hiddenOpex.repairLoop.titleAr}.` : ''}`,
              )}
              meta={T('Odoo 17 Analytic Lines · unallocated scan', 'قيود مراكز التكلفة · فحص غير المحمّل')}
              action={goTo('opex', T('Expose & fix', 'كشف ومعالجة'))}
            />
            <Shortcut
              glow={S.ops.groupScore >= 80 ? 'emerald' : 'amber'}
              title={T('Operations, Cashier Discipline & Speed Score', 'انضباط العمليات وجودة الخدمة بالفروع')}
              metric={
                <span>
                  {S.ops.groupScore}
                  <span className="text-neutral-300 dark:text-neutral-600"> / 100</span>
                </span>
              }
              sub={T('sales-weighted discipline score', 'مؤشر انضباط مرجّح بالمبيعات')}
              takeaway={T(
                `Best: ${loc(S.ops.best?.id)} (${S.ops.best?.score}). Needs attention: ${loc(S.ops.worst?.id)} (${S.ops.worst?.score}) — discounts, cancellations, late openings and comps.`,
                `الأفضل: ${loc(S.ops.best?.id)} (${S.ops.best?.score}). يحتاج متابعة: ${loc(S.ops.worst?.id)} (${S.ops.worst?.score}) — خصومات وإلغاءات وتأخير فتح وضيافة.`,
              )}
              meta={T('POS sessions · discounts · cancellations', 'جلسات نقاط البيع · الخصومات · الإلغاءات')}
              action={goTo('operations', T('Branch fixes', 'حلول الفروع'))}
            >
              <div className="relative flex flex-wrap gap-1.5">
                {S.ops.rows.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.score >= 85 ? 'bg-emerald-500' : r.score >= 65 ? 'bg-amber-400' : 'bg-rose-500'}`} />
                    {loc(r.id)} {r.score}
                  </span>
                ))}
              </div>
            </Shortcut>
            <Shortcut
              glow="emerald"
              title={T('Power Brands Pricing & Bundle Engine', 'قوة محركات النمو والمينيو')}
              metric={kwd(S.menu.monthlyKwd)}
              sub={T('per month from pricing & baskets', 'شهرياً من التسعير وهيكلة السلة')}
              takeaway={
                S.menu.hero
                  ? T(`${S.menu.hero.name} leads China Garden with ${f0(S.menu.hero.qty)} sold at ${f3(S.menu.hero.avgPriceKwd)} KWD; ${S.menu.plays.length} brand-specific pricing and bundle moves are ready.`, `يتصدر ${S.menu.hero.name} مبيعات تشاينا جاردن بـ ${f0(S.menu.hero.qty)} وحدة بسعر ${f3(S.menu.hero.avgPriceKwd)} د.ك؛ و${S.menu.plays.length} قرارات تسعير ووجبات مجمّعة جاهزة لكل علامة.`)
                  : ''
              }
              meta={T('Each brand on its own economics', 'كل علامة وفق اقتصادياتها الخاصة')}
              action={goTo('menu', T('Menu moves', 'قرارات المينيو'))}
            />
            <Shortcut
              glow="sky"
              title={T('Host-Kitchen & Branch Rent Optimization', 'فرص المطابخ المضيفة وهيكلة الإيجارات')}
              metric={S.host ? kwd(S.host.contribution) : '—'}
              sub={S.host ? T(`per month · ${brand(S.host.brand)} inside ${loc(S.host.target.id)} (#${S.host.target.analyticId ?? 114})`, `شهرياً · ${brand(S.host.brand)} داخل ${loc(S.host.target.id)} (#${S.host.target.analyticId ?? 114})`) : undefined}
              takeaway={
                S.host
                  ? T(
                      `${loc(S.host.target.id)} pays ${f1(S.host.target.rentPct)}% analytic rent (${kwd(S.host.dailyGapKwd)}/day · ${S.host.dailyGapOrders} orders/day cash gap); planting ${brand(S.host.brand)} cuts rent load to ${f1(S.host.rentAfterPct)}%.`,
                      `يتحمل ${loc(S.host.target.id)} إيجاراً بنسبة ${f1(S.host.target.rentPct)}% (فجوة ${kwd(S.host.dailyGapKwd)}/يوم · ${S.host.dailyGapOrders} طلب/يوم)؛ وزرع ${brand(S.host.brand)} يخفض الإيجار إلى ${f1(S.host.rentAfterPct)}%.`,
                    )
                  : T('Every restaurant covers its rent within the group norm.', 'كل المطاعم تغطي إيجارها ضمن معيار المجموعة.')
              }
              meta={T('Analytic Plan #1 & #2 True Net Cash P&L', 'صافي النقد الفعلي لخطط التكلفة #1 و#2')}
              action={goTo('opex', T('Host-kitchen plan', 'خطة المطبخ المضيف'))}
            />
            <Shortcut
              glow="amber"
              title={T('Delivery Net Takeback', 'خلاصة صافي التوصيل والتسويات')}
              metric={kwd(S.delivery.monthlyKwd)}
              sub={T('per month back from platforms', 'شهرياً تعود من المنصات')}
              takeaway={T(`Promotion burn, commission gaps and channel mix — plus ${kwd(S.delivery.openClearingKwd)} of platform takings awaiting settlement in Odoo.`, `استنزاف العروض وفروقات العمولات ومزيج القنوات — إضافة إلى ${kwd(S.delivery.openClearingKwd)} من متحصلات المنصات بانتظار التسوية في أودو.`)}
              meta={T('POS payments · clearing accounts', 'مدفوعات نقاط البيع · حسابات التسوية')}
              action={
                <Link href="/erp/aggregator-radar" className={pill}>
                  <Radar className="h-3.5 w-3.5" />
                  {T('Open Delivery Radar', 'فتح رادار التوصيل')}
                </Link>
              }
            />
          </div>
        )}

        {/* ─────────────── Tab 2 — journey decisions ─────────────── */}
        {tab === 'decisions' && (
          <div className="space-y-5">
            <section className={`${card} flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between`}>
              <div className="min-w-0 space-y-1">
                <p className="text-[14px] font-semibold text-neutral-900 dark:text-white">
                  {T(`${JOURNEY_PLAYS.length} decisions · ${kwd(visibleMonthly)} per month in view · ${kwd(visibleMonthly * 12)} per year`, `${JOURNEY_PLAYS.length} قراراً · ${kwd(visibleMonthly)} شهرياً في العرض · ${kwd(visibleMonthly * 12)} سنوياً`)}
                </p>
                <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                  {live.status === 'done'
                    ? T(
                        `${live.live ? 'Live Odoo' : 'Last Odoo snapshot'} · month-to-date ${kwd(live.mtdNet ?? 0)}${live.mtdPerDay ? ` · ${kwd(live.mtdPerDay)}/day` : ''}`,
                        `${live.live ? 'أودو مباشر' : 'آخر لقطة من أودو'} · منذ بداية الشهر ${kwd(live.mtdNet ?? 0)}${live.mtdPerDay ? ` · ${kwd(live.mtdPerDay)} يومياً` : ''}`,
                      )
                    : T(`Background analysis synced ${new Date(JOURNEY_META.syncedAt).toLocaleString('en-GB')} · ${JOURNEY_META.mtdEn}`, `آخر تحليل خلفي ${new Date(JOURNEY_META.syncedAt).toLocaleString('en-GB')} · ${JOURNEY_META.mtdAr}`)}
                </p>
              </div>
              <button
                type="button"
                onClick={scan}
                disabled={live.status === 'scanning'}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#0F172A] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60 dark:bg-white dark:text-neutral-950"
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
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                    stage === s.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950' : 'bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200'
                  }`}
                >
                  {isAr ? s.ar : s.en}
                  <span className={`rounded-full px-1.5 text-[11px] ${stage === s.id ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{counts[s.id] ?? 0}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className={`${card} p-6 text-[14px] text-neutral-500`}>{T('No material leak detected in this stage for the current Odoo window.', 'لا يوجد خلل جوهري في هذه المرحلة ضمن نافذة أودو الحالية.')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {visible.map((p) => {
                  const approved = approvals.some((a) => a.id === p.id)
                  const sev = SEVERITY[p.severity]
                  const stageLabel = JOURNEY_STAGES.find((s) => s.id === p.stage)
                  const prompt = isAr
                    ? `ناقشي معي خطة تنفيذ قرار "${p.titleAr}" (${p.subjectAr}): الخلل الخفي، والقرار التنفيذي خطوة بخطوة، وأثره على الجودة، والعائد المتوقع ${p.monthlyKwd ? `${f0(p.monthlyKwd)} د.ك شهرياً` : ''}.`
                    : `Let's plan the execution of "${p.titleEn}" (${p.subjectEn}): the hidden leak, the executive action step by step, the quality impact and the expected ${p.monthlyKwd ? `${f0(p.monthlyKwd)} KWD/month` : 'control'} result.`
                  const blocks = [
                    { n: T('1', '١'), title: T('Hidden Leak / Strategic Lever', 'الخلل الخفي أو الفرصة الجوهرية'), body: isAr ? p.leakAr : p.leakEn, tone: 'plain' },
                    { n: T('2', '٢'), title: T('Surgical Executive Action', 'القرار التنفيذي الجراحي'), body: isAr ? p.actionAr : p.actionEn, tone: 'plain' },
                    { n: T('3', '٣'), title: T('Quality & Operational Elevation', 'أثر القرار على جودة ومستوى الشركة'), body: isAr ? p.qualityAr : p.qualityEn, tone: 'plain' },
                    { n: T('4', '٤'), title: T('Expected Monthly & Annual Net KWD Impact', 'العائد المالي المتوقع شهرياً وسنوياً'), body: isAr ? p.impactAr : p.impactEn, tone: 'outcome' },
                  ]
                  return (
                    <article key={p.id} className={`${card} flex flex-col gap-4 p-6 ${approved ? 'ring-2 ring-emerald-400/60' : ''}`}>
                      <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sev.cls}`}>{isAr ? sev.ar : sev.en}</span>
                            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{isAr ? stageLabel?.ar : stageLabel?.en}</span>
                            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{p.basis === 'posted' ? T('Posted in Odoo', 'مرحّل في أودو') : T('Estimate · assumption stated', 'تقدير · الافتراض معلن')}</span>
                          </div>
                          <h2 className="text-[16px] font-semibold leading-snug text-neutral-950 dark:text-white">{isAr ? p.titleAr : p.titleEn}</h2>
                          <p className="text-[12.5px] font-medium text-neutral-500 dark:text-neutral-400">{isAr ? p.subjectAr : p.subjectEn}</p>
                        </div>
                        <div className="shrink-0 text-end">
                          <div className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {p.monthlyKwd > 0 ? T(`+${f0(p.monthlyKwd)} KWD / month`, `+${f0(p.monthlyKwd)} د.ك شهرياً`) : T('Control & cash', 'رقابة ونقد')}
                          </div>
                          {p.annualKwd > 0 && <div className="mt-1 text-[11.5px] font-semibold text-neutral-400">{T(`${f0(p.annualKwd)} KWD / year`, `${f0(p.annualKwd)} د.ك سنوياً`)}</div>}
                        </div>
                      </header>
                      <div className="space-y-2.5">
                        {blocks.map((b) => (
                          <div key={b.title} className={b.tone === 'outcome' ? 'rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30' : 'rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800/50'}>
                            <div className={`text-[12px] font-bold ${b.tone === 'outcome' ? 'text-emerald-800 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                              {b.n}. {b.title}
                            </div>
                            <p className={`mt-1 text-[14px] leading-[1.8] ${b.tone === 'outcome' ? 'text-emerald-950 dark:text-emerald-50' : 'text-neutral-800 dark:text-neutral-100'}`}>{b.body}</p>
                          </div>
                        ))}
                      </div>
                      {p.evidence.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.evidence.map((e) => (
                            <span key={e.en} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11.5px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                              {isAr ? e.ar : e.en}
                            </span>
                          ))}
                        </div>
                      )}
                      <footer className="mt-auto flex flex-wrap gap-2.5">
                        <Link href={feryalHref(prompt)} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-neutral-100 px-4 py-2.5 text-[13px] font-semibold text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700">
                          <Sparkles className="h-4 w-4" />
                          {T('Discuss the execution plan with Feryal', 'ناقش خطة التنفيذ مع فريال')}
                        </Link>
                        <button
                          type="button"
                          aria-pressed={approved}
                          onClick={() => approve(p)}
                          className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold text-white transition-all active:scale-[0.98] ${approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0F172A] hover:bg-slate-800 dark:bg-white dark:text-neutral-950'}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {approved ? T('Approved · measuring impact', 'معتمد · جارٍ قياس الأثر') : T('Approve & measure impact (before vs after)', 'اعتماد وقياس الأثر (قبل وبعد)')}
                        </button>
                      </footer>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────── Tab 3 — verified impact tracker ─────────────── */}
        {tab === 'tracker' && (
          <div className="space-y-5">
            <section className={`${card} flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between`}>
              <div className="min-w-0 space-y-1">
                <p className="text-[14px] font-semibold text-neutral-900 dark:text-white">
                  {T(`${approvals.length} approved decisions · ${kwd(approvals.reduce((s, a) => s + a.monthlyKwd, 0))} per month committed`, `${approvals.length} قرارات معتمدة · ${kwd(approvals.reduce((s, a) => s + a.monthlyKwd, 0))} شهرياً ملتزم بها`)}
                </p>
                <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                  {T(
                    `The Odoo baseline is captured at approval; each ${CYCLE_DAYS}-day cycle compares it with the latest synced Odoo value.`,
                    `يُلتقط خط الأساس من أودو لحظة الاعتماد؛ وكل دورة ${CYCLE_DAYS} يوماً تقارنه بآخر قيمة متزامنة من أودو.`,
                  )}
                </p>
              </div>
              <button type="button" onClick={scan} disabled={live.status === 'scanning'} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#0F172A] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60 dark:bg-white dark:text-neutral-950">
                <RefreshCw className={`h-4 w-4 ${live.status === 'scanning' ? 'animate-spin' : ''}`} />
                {scanLabel}
              </button>
            </section>

            {approvals.length === 0 ? (
              <div className={`${card} flex flex-col items-center gap-3 p-10 text-center`}>
                <Timer className="h-8 w-8 text-neutral-300" />
                <p className="max-w-xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {T('Approve a decision in the journey playbook to lock its Odoo baseline and start a 14-day before-vs-after cycle.', 'اعتمد قراراً من قرارات الرحلة لتثبيت خط الأساس من أودو وبدء دورة قياس قبل وبعد لمدة 14 يوماً.')}
                </p>
                <button type="button" onClick={() => setTab('decisions')} className={pill}>
                  {T('Open journey decisions', 'فتح قرارات الرحلة')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {approvals.map((a) => {
                  const days = Math.max(0, Math.floor((Date.now() - new Date(a.approvedAt).getTime()) / 86400000))
                  const cycle = Math.floor(days / CYCLE_DAYS) + 1
                  const next = new Date(new Date(a.approvedAt).getTime() + cycle * CYCLE_DAYS * 86400000)
                  const now = JOURNEY_KPI_NOW[a.kpi.id]
                  const fresh = new Date(JOURNEY_META.syncedAt).getTime() > new Date(a.approvedAt).getTime() && now !== undefined
                  const delta = fresh ? now - a.kpi.value : 0
                  const improved = fresh && (a.kpi.better === 'down' ? delta < 0 : delta > 0)
                  const progress = Math.min(100, ((days % CYCLE_DAYS) / CYCLE_DAYS) * 100)
                  return (
                    <article key={a.id} className={`${card} flex flex-col gap-4 p-6`}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[15px] font-semibold leading-snug text-neutral-950 dark:text-white">{isAr ? a.titleAr : a.titleEn}</h3>
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{T(`Cycle ${cycle}`, `الدورة ${cycle}`)}</span>
                      </div>
                      <p className="text-[12.5px] font-medium text-neutral-500">{isAr ? a.kpi.ar : a.kpi.en}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-neutral-800/50">
                          <div className="text-[11.5px] font-semibold text-neutral-500">{T('Before (at approval)', 'قبل (عند الاعتماد)')}</div>
                          <div className="mt-1 text-[18px] font-semibold tabular-nums text-neutral-950 dark:text-white">{journeyKpiFormat(a.kpi, isAr)}</div>
                        </div>
                        <div className={`rounded-2xl p-3.5 ${fresh ? (improved ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30') : 'bg-neutral-50 dark:bg-neutral-800/50'}`}>
                          <div className="text-[11.5px] font-semibold text-neutral-500">{T('After (latest Odoo sync)', 'بعد (آخر مزامنة أودو)')}</div>
                          <div className="mt-1 text-[18px] font-semibold tabular-nums text-neutral-950 dark:text-white">{fresh ? journeyKpiFormat({ ...a.kpi, value: now }, isAr) : '—'}</div>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                        {fresh
                          ? improved
                            ? T('Improving against the baseline — keep the action running into the next cycle.', 'تحسّن مقابل خط الأساس — استمر في التنفيذ للدورة التالية.')
                            : T('No improvement yet against the baseline — review execution with the branch owner.', 'لا تحسّن بعد مقابل خط الأساس — راجع التنفيذ مع المسؤول عن الفرع.')
                          : T(`Awaiting the next Odoo sync after approval. Next checkpoint: ${next.toLocaleDateString('en-GB')}.`, `بانتظار مزامنة أودو التالية بعد الاعتماد. نقطة القياس القادمة: ${next.toLocaleDateString('en-GB')}.`)}
                        {live.status === 'done' && live.mtdPerDay && a.livePerDay
                          ? T(` Group sales per day: ${kwd(a.livePerDay)} at approval → ${kwd(live.mtdPerDay)} now.`, ` مبيعات المجموعة اليومية: ${kwd(a.livePerDay)} عند الاعتماد ← ${kwd(live.mtdPerDay)} الآن.`)
                          : ''}
                      </p>
                      <div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-neutral-400">
                          <span>{T(`Day ${days % CYCLE_DAYS} of ${CYCLE_DAYS}`, `اليوم ${days % CYCLE_DAYS} من ${CYCLE_DAYS}`)}</span>
                          <span>{T(`Approved ${new Date(a.approvedAt).toLocaleDateString('en-GB')}`, `اعتُمد ${new Date(a.approvedAt).toLocaleDateString('en-GB')}`)}</span>
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{a.monthlyKwd ? T(`Target +${f0(a.monthlyKwd)} KWD / month`, `المستهدف +${f0(a.monthlyKwd)} د.ك شهرياً`) : T('Control target', 'هدف رقابي')}</span>
                        <button type="button" onClick={() => persist(approvals.filter((x) => x.id !== a.id))} className="rounded-full px-3 py-1 text-[12px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                          {T('Remove', 'إزالة')}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {JOURNEY_META.restricted.length > 0 && (
              <p className="text-[12px] text-neutral-400">
                {T(
                  `Odoo access audit: ${JOURNEY_META.readable.length} models readable; restricted for the BI user: ${JOURNEY_META.restricted.map((r) => r.model).join(', ')}. Labour metrics use POS register hours because attendance data is not available.`,
                  `تدقيق صلاحيات أودو: ${JOURNEY_META.readable.length} نموذجاً مقروءاً؛ والمقيّد لمستخدم التحليلات: ${JOURNEY_META.restricted.map((r) => r.model).join('، ')}. مؤشرات العمالة تعتمد على ساعات تشغيل أجهزة نقاط البيع لعدم توفر بيانات الحضور.`,
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
