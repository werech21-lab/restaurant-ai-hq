'use client'

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Radar, Sparkles } from 'lucide-react'
import {
  AETHER_BRAIN_META,
  BRANCH_COMFORT,
  DELIVERY_HEALTH,
  MENU_POWER,
  NET_POCKET,
  QUICK_WIN,
  RECOVERABLE,
  RECOVERABLE_FINDING_IDS,
  type FindingDomain,
} from '@/lib/aether-proprietary-brain'
import { BRANDS, feryalHref } from '@/lib/aether/ledger'
import { INITIAL_BRANCH_PROFILES } from '@/lib/radar/talabat-geo-zone-radar'
import { useLang } from '@/components/aether/ui'
import { GrowthPlaybookV5 } from '@/components/aether/GrowthPlaybookV5'

type View = 'shortcuts' | 'playbook'
type Glow = 'emerald' | 'amber' | 'sky'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const GLOW: Record<Glow, string> = { emerald: 'bg-emerald-400', amber: 'bg-amber-400', sky: 'bg-sky-400' }
const pillCls =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-100 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-800 transition-all duration-150 hover:bg-neutral-200 active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:ring-white/70'

function ShortcutCard({ glow, title, metric, metricSub, takeaway, meta, action, children }: { glow: Glow; title: string; metric: ReactNode; metricSub?: string; takeaway: ReactNode; meta: string; action: ReactNode; children?: ReactNode }) {
  return (
    <article className="group relative flex min-h-[204px] flex-col gap-3.5 overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(15,23,42,0.03)] transition-transform duration-200 hover:-translate-y-0.5 dark:bg-neutral-900" style={{ transitionTimingFunction: SPRING }}>
      <span aria-hidden className={`pointer-events-none absolute -end-12 -top-12 h-44 w-44 rounded-full opacity-20 blur-2xl ${GLOW[glow]}`} />
      <h2 className="relative text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>
      <div className="relative">
        <div className="break-words text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 sm:text-3xl dark:text-white">{metric}</div>
        {metricSub && <div className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">{metricSub}</div>}
      </div>
      {children}
      <p className="relative text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-300">{takeaway}</p>
      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-neutral-400">{meta}</span>
        {action}
      </div>
    </article>
  )
}

/** لوحة المختصرات الذكية — distilled executive shortcuts that Odoo does not compute, plus the solutions playbook. */
export function ExecutiveShortcutsV6() {
  const { isAr, T } = useLang()
  const [view, setView] = useState<View>('shortcuts')
  const [playbook, setPlaybook] = useState<{ key: number; domain: FindingDomain | 'all'; onlyIds: string[] | null }>({ key: 0, domain: 'all', onlyIds: null })

  const openPlaybook = useCallback((domain: FindingDomain | 'all', onlyIds: string[] | null = null) => {
    setPlaybook((p) => ({ key: p.key + 1, domain, onlyIds }))
    setView('playbook')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const kwd = (n: number, d = 0) => (isAr ? `${d ? f3(n) : f0(n)} د.ك` : `${d ? f3(n) : f0(n)} KWD`)
  const period = isAr ? AETHER_BRAIN_META.periodAr : AETHER_BRAIN_META.periodEn
  const brandName = (id: string) => {
    const b = BRANDS.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id
  }

  const restaurantFleetLocations = INITIAL_BRANCH_PROFILES.filter((p) => p.zoneAccounts.some((a) => a.deliveryMode === 'M')).length
  const totalLocations = INITIAL_BRANCH_PROFILES.length
  const [star1, star2] = MENU_POWER.stars
  const drag = MENU_POWER.drag[0]
  const best = DELIVERY_HEALTH.best
  const comfortGlow: Glow = BRANCH_COMFORT.priority > 0 ? 'amber' : 'emerald'
  const side = isAr ? 'right' : 'left'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="rounded-[28px] bg-[#F7F7F8] dark:bg-[#0A0A0A]">
      <div className="mx-auto w-full max-w-[1380px] space-y-5 px-5 py-6 sm:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl dark:text-white">{view === 'shortcuts' ? T('Smart Shortcuts', 'لوحة المختصرات الذكية') : T('Solutions & Action Playbook', 'الحلول ومقترحات التطوير')}</h1>
            <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
              {T(`What Odoo does not calculate, in one screen · ${period}`, `ما لا يحسبه أودو، في شاشة واحدة · ${period}`)}
            </p>
          </div>
          <div role="tablist" aria-label={T('View', 'طريقة العرض')} className="relative grid w-full shrink-0 grid-cols-2 rounded-full bg-neutral-200/70 p-1 sm:w-auto dark:bg-neutral-800">
            <span
              aria-hidden
              className="absolute bottom-1 top-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(15,23,42,0.06)] dark:bg-neutral-950"
              style={{ width: 'calc(50% - 4px)', [side]: view === 'shortcuts' ? '4px' : '50%', transition: `${side} 190ms ${SPRING}` } as CSSProperties}
            />
            {(['shortcuts', 'playbook'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => (v === 'playbook' ? openPlaybook('all') : setView('shortcuts'))}
                className={`relative z-10 whitespace-nowrap rounded-full px-5 py-2 text-[13px] font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 dark:focus-visible:ring-white/70 ${view === v ? 'text-neutral-950 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
              >
                {v === 'shortcuts' ? T('Smart Shortcuts', 'المختصرات الذكية') : T('Solutions & Action Playbook', 'الحلول ومقترحات التطوير')}
              </button>
            ))}
          </div>
        </header>

        {view === 'shortcuts' ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ShortcutCard
              glow="sky"
              title={T('True Net Pocket Margin', 'صافي الجيب الحقيقي')}
              metric={kwd(NET_POCKET.per10, 3)}
              metricSub={T('kept from every 10 KWD sold', 'يبقى لنا من كل 10 د.ك مبيعات')}
              takeaway={T(
                `The shop keeps ${f3(NET_POCKET.shopPer10)} KWD and delivery apps keep ${f3(NET_POCKET.appsPer10)} KWD of every 10 KWD after promotions, commissions and food cost.`,
                `المحل يُبقي ${f3(NET_POCKET.shopPer10)} د.ك وتطبيقات التوصيل تُبقي ${f3(NET_POCKET.appsPer10)} د.ك من كل 10 د.ك بعد العروض والعمولات وتكلفة الأغذية.`,
              )}
              meta={T('Odoo sales · contract commissions · posted food cost', 'مبيعات أودو · العمولات التعاقدية · تكلفة الأغذية المرحّلة')}
              action={
                <button type="button" onClick={() => openPlaybook('delivery')} className={pillCls}>
                  {T('Improve it', 'كيف نرفعه')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              }
            />

            <ShortcutCard
              glow="amber"
              title={T('Recoverable Monthly Profit', 'أرباح ضائعة قابلة للاسترداد')}
              metric={kwd(RECOVERABLE.monthlyKwd)}
              metricSub={T('per month, without needing new customers', 'شهرياً، دون الحاجة إلى زبائن جدد')}
              takeaway={T(
                `${RECOVERABLE.items.length} leaks are open right now: promotions above the cap, drinks not added to delivery orders, and cost and channel gaps.`,
                `${RECOVERABLE.items.length} تسريبات مفتوحة الآن: عروض فوق السقف، ومشروبات لا تُضاف لطلبات التوصيل، وفروقات في التكلفة والقنوات.`,
              )}
              meta={T(`${RECOVERABLE.items.length} verified fixes`, `${RECOVERABLE.items.length} حلول موثقة`)}
              action={
                <button type="button" onClick={() => openPlaybook('all', RECOVERABLE_FINDING_IDS)} className={pillCls}>
                  {T('Show the exact fixes', 'عرض الحلول بالتحديد')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              }
            />

            <ShortcutCard
              glow={comfortGlow}
              title={T('Branch Comfort & Rent Pulse', 'نبض أمان الفروع والتكاليف')}
              metric={
                <span>
                  {BRANCH_COMFORT.comfortable}
                  <span className="text-neutral-300 dark:text-neutral-600"> / </span>
                  {BRANCH_COMFORT.rows.length}
                </span>
              }
              metricSub={T('locations cover their fixed costs comfortably', 'مواقع تغطي تكاليفها الثابتة براحة')}
              takeaway={T(
                `Strongest: ${BRANCH_COMFORT.top?.en}. Lowest cover to watch: ${BRANCH_COMFORT.weakest?.en}${BRANCH_COMFORT.weakest?.rent ? `, where rent is ${f0(BRANCH_COMFORT.weakest.rentPct)}% of sales` : ''}.`,
                `الأقوى: ${BRANCH_COMFORT.top?.ar}. الأقل تغطية ويحتاج متابعة: ${BRANCH_COMFORT.weakest?.ar}${BRANCH_COMFORT.weakest?.rent ? `، حيث يبلغ الإيجار ${f0(BRANCH_COMFORT.weakest.rentPct)}% من المبيعات` : ''}.`,
              )}
              meta={T('Gross profit ÷ rent, running costs & depreciation', 'مجمل الربح ÷ الإيجار والمصروفات والإهلاك')}
              action={
                <button type="button" onClick={() => openPlaybook('branches')} className={pillCls}>
                  {T('Location fixes', 'حلول المواقع')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              }
            >
              <div className="relative flex flex-wrap gap-2">
                {[
                  { n: BRANCH_COMFORT.comfortable, dot: 'bg-emerald-500', en: 'comfortable', ar: 'مريح' },
                  { n: BRANCH_COMFORT.watch, dot: 'bg-amber-400', en: 'watch', ar: 'متابعة' },
                  { n: BRANCH_COMFORT.priority, dot: 'bg-rose-500', en: 'priority', ar: 'أولوية' },
                ].map((x) => (
                  <span key={x.en} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                    <span className={`h-2 w-2 rounded-full ${x.dot}`} />
                    {x.n} {isAr ? x.ar : x.en}
                  </span>
                ))}
              </div>
            </ShortcutCard>

            <ShortcutCard
              glow="emerald"
              title={T('True Menu Power vs. Kitchen Drag', 'خلاصة قوة المينيو الحقيقية')}
              metric={<span className="text-xl font-semibold sm:text-2xl">{star1 ? star1.name : '—'}</span>}
              metricSub={star1 ? T(`${brandName(star1.brand)} · top net-profit item`, `${brandName(star1.brand)} · الصنف الأعلى ربحاً صافياً`) : undefined}
              takeaway={
                drag
                  ? T(
                      `${star1?.name}${star2 ? ` and ${star2.name}` : ''} earn the most after food cost and commission, while ${drag.name} uses ${drag.ingredients} ingredients but sells little.`,
                      `${star1?.name}${star2 ? ` و${star2.name}` : ''} يحققان أعلى ربح بعد تكلفة الأغذية والعمولة، بينما ${drag.name} يحتاج ${drag.ingredients} مكونات ويبيع قليلاً.`,
                    )
                  : T(
                      `${MENU_POWER.dogs} items sell little and earn little; moving their screen space to the top earners lifts margin.`,
                      `${MENU_POWER.dogs} صنفاً قليل البيع والربح؛ نقل مساحتها على الشاشات للأصناف الأعلى ربحاً يرفع الهامش.`,
                    )
              }
              meta={T('Dual-margin menu matrix', 'مصفوفة المنيو بالهامش المزدوج')}
              action={
                <button type="button" onClick={() => openPlaybook('menu')} className={pillCls}>
                  {T('Menu fixes', 'حلول المنيو')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              }
            />

            <ShortcutCard
              glow="sky"
              title={T('Delivery Net Health', 'خلاصة كفاءة منصات التوصيل')}
              metric={kwd(DELIVERY_HEALTH.per10, 3)}
              metricSub={T('reaches us from every 10 KWD sold on apps', 'يصلنا من كل 10 د.ك مبيعات على التطبيقات')}
              takeaway={T(
                `${best ? `${best.en} earns the most per order. ` : ''}${DELIVERY_HEALTH.burning.length ? `${DELIVERY_HEALTH.burning.map((c) => c.en).join(' and ')} spend above the promotion cap.` : 'Every app is inside the promotion cap.'} ${restaurantFleetLocations} of ${totalLocations} locations run a restaurant-fleet account.`,
                `${best ? `${best.ar} الأعلى ربحاً للطلب. ` : ''}${DELIVERY_HEALTH.burning.length ? `${DELIVERY_HEALTH.burning.map((c) => c.ar).join(' و')} تتجاوز سقف العروض.` : 'كل التطبيقات ضمن سقف العروض.'} ${restaurantFleetLocations} من ${totalLocations} مواقع لديها حساب بأسطول المطعم.`,
              )}
              meta={T('Payout after commission and promotions', 'التسوية بعد العمولة والعروض')}
              action={
                <Link href="/erp/aggregator-radar" className={pillCls}>
                  <Radar className="h-3.5 w-3.5" />
                  {T('Open Delivery Radar', 'فتح رادار التوصيل')}
                </Link>
              }
            />

            <ShortcutCard
              glow="emerald"
              title={T('#1 Quick Growth Win', 'أسرع فرصة لرفع المبيعات الآن')}
              metric={QUICK_WIN ? (isAr ? `${f0(QUICK_WIN.monthlyKwd)} د.ك` : `+${f0(QUICK_WIN.monthlyKwd)} KWD`) : '—'}
              metricSub={QUICK_WIN ? T(`per month · ${QUICK_WIN.titleEn}`, `شهرياً · ${QUICK_WIN.titleAr}`) : undefined}
              takeaway={QUICK_WIN ? (isAr ? QUICK_WIN.fixAr : QUICK_WIN.fixEn) : ''}
              meta={T('Computed from Odoo sales', 'محسوبة من مبيعات أودو')}
              action={
                QUICK_WIN ? (
                  <Link
                    href={feryalHref(
                      isAr
                        ? `ناقشي معي تنفيذ "${QUICK_WIN.titleAr}" خطوة بخطوة والنتيجة المتوقعة.`
                        : `Let's plan the execution of "${QUICK_WIN.titleEn}" step by step and the expected result.`,
                    )}
                    className={pillCls}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {T('Discuss with Feryal', 'ناقش التنفيذ مع فريال')}
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <GrowthPlaybookV5
            key={playbook.key}
            embedded
            initialDomain={playbook.domain}
            onlyIds={playbook.onlyIds}
            onClearOnly={() => setPlaybook((p) => ({ key: p.key + 1, domain: 'all', onlyIds: null }))}
          />
        )}
      </div>
    </div>
  )
}
