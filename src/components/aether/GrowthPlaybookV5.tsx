'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import {
  AETHER_BRAIN_META,
  AETHER_FINDINGS,
  FINDING_DOMAINS,
  type AetherFinding,
  type FindingDomain,
} from '@/lib/aether-proprietary-brain'
import { feryalHref } from '@/lib/aether/ledger'
import {
  GOVERNANCE_UPDATED_EVENT,
  loadGovernanceStore,
  submitApprovalRequest,
  type GovernanceApprovalRequest,
} from '@/lib/governance-compliance'
import { useLang } from '@/components/aether/ui'

type ScanState = {
  status: 'idle' | 'scanning' | 'done' | 'unauthorized' | 'error'
  at?: string
  net?: number
  orders?: number
  live?: boolean
}

const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US')

const FINDING_SCOPE_PILLS: Record<string, { ar: string; en: string }> = {
  'menu-underpriced': { ar: 'تشاينا جاردن • فرانكس', en: "China Garden • Frank's" },
  'menu-dogs': { ar: 'فارم براون • نودل بار', en: 'Farm Brown • Noodle Bar' },
  'menu-attach': { ar: 'تشاينا جاردن • الأفنيوز • السالمية', en: 'China Garden • Avenues • Salmiya' },
  'delivery-payout': { ar: 'الأفنيوز • السالمية • بروميناد', en: 'Avenues • Salmiya • Promenade' },
  'delivery-keeta': { ar: 'السالمية • بروميناد • الكوت', en: 'Salmiya • Promenade • Al Kout' },
  'delivery-tmp': { ar: 'الأفنيوز • العاصمة • السالمية', en: 'Avenues • Assima • Salmiya' },
  'procurement-unallocated': { ar: 'العارضية • كل الفروع السبعة', en: 'Ardiya • All 7 Branches' },
  'procurement-vendor': { ar: 'العارضية • السالمية', en: 'Ardiya • Salmiya' },
  'ops-sessions': { ar: 'السالمية • مول 360', en: 'Salmiya • 360 Mall' },
  'ops-hours': { ar: 'الأفنيوز • مول 360 • العاصمة', en: 'Avenues • 360 Mall • Assima' },
  'ops-branch-gap': { ar: 'بروميناد • الكوت • السالمية', en: 'Promenade • Al Kout • Salmiya' },
  'growth-brands': { ar: 'تشاينا جاردن • فرانكس • طحينة', en: "China Garden • Frank's • Tahina" },
}

function normalizeFindingKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Streamlined Growth Playbook — zero duplicate titles & zero boilerplate walls. */
export function GrowthPlaybookV5({
  embedded = false,
  initialDomain = 'all',
  onlyIds = null,
  onClearOnly,
}: {
  /** Rendered inside the Smart Shortcuts dashboard (no outer page container). */
  embedded?: boolean
  initialDomain?: FindingDomain | 'all'
  /** Restrict the list to these finding ids (e.g. the recoverable-profit set). */
  onlyIds?: string[] | null
  onClearOnly?: () => void
} = {}) {
  const { isAr, T } = useLang()
  const [domain, setDomain] = useState<FindingDomain | 'all'>(initialDomain)
  const [approvalsByRef, setApprovalsByRef] = useState<Record<string, GovernanceApprovalRequest>>({})
  const [scan, setScan] = useState<ScanState>({ status: 'idle' })

  const syncGovernanceMap = useCallback(() => {
    try {
      const store = loadGovernanceStore()
      const next: Record<string, GovernanceApprovalRequest> = {}
      for (const req of store.approvals) {
        next[req.refKey] = req
      }
      setApprovalsByRef(next)
    } catch {
      // safe SSR / private-mode fallback
    }
  }, [])

  useEffect(() => {
    syncGovernanceMap()
    if (typeof window === 'undefined') return
    window.addEventListener(GOVERNANCE_UPDATED_EVENT, syncGovernanceMap)
    window.addEventListener('storage', syncGovernanceMap)
    return () => {
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, syncGovernanceMap)
      window.removeEventListener('storage', syncGovernanceMap)
    }
  }, [syncGovernanceMap])

  const rescan = useCallback(async () => {
    setScan({ status: 'scanning' })
    try {
      const res = await fetch('/api/odoo-sync', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (res.status === 401) return setScan({ status: 'unauthorized' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScan({
        status: 'done',
        at: data.syncedAt,
        net: data.totals?.netSalesKwd,
        orders: data.totals?.orders,
        live: data.source === 'live',
      })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: data }))
    } catch {
      setScan({ status: 'error' })
    }
  }, [])

  const scoped = useMemo(() => {
    const raw = onlyIds ? AETHER_FINDINGS.filter((f) => onlyIds.includes(f.id)) : AETHER_FINDINGS
    const seenTitleAr = new Set<string>()
    const seenTitleEn = new Set<string>()
    const seenFaultAr = new Set<string>()
    const unique: AetherFinding[] = []
    for (const f of raw) {
      const ka = normalizeFindingKey(f.titleAr)
      const ke = normalizeFindingKey(f.titleEn)
      const kf = normalizeFindingKey(f.faultAr)
      if (seenTitleAr.has(ka) || seenTitleEn.has(ke) || seenFaultAr.has(kf)) continue
      seenTitleAr.add(ka)
      seenTitleEn.add(ke)
      seenFaultAr.add(kf)
      unique.push(f)
    }
    return unique
  }, [onlyIds])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: scoped.length }
    for (const f of scoped) c[f.domain] = (c[f.domain] ?? 0) + 1
    return c
  }, [scoped])

  const visible = domain === 'all' ? scoped : scoped.filter((f) => f.domain === domain)
  const totalVisible = visible.reduce((s, f) => s + f.monthlyKwd, 0)

  const domainLabel = useCallback(
    (d: FindingDomain, ar: boolean) => {
      const x = FINDING_DOMAINS.find((y) => y.id === d)
      return x ? (ar ? x.ar : x.en) : d
    },
    [],
  )

  const handleSubmitFinding = useCallback(
    (f: AetherFinding) => {
      const refKey = `playbook:${f.id}`
      const scope = FINDING_SCOPE_PILLS[f.id] ?? {
        ar: 'الأفنيوز • السالمية',
        en: 'Avenues • Salmiya',
      }
      submitApprovalRequest({
        refKey,
        domain: 'growth-play',
        titleAr: f.titleAr,
        titleEn: f.titleEn,
        summaryAr: `${scope.ar} • ${f.fixAr}`,
        summaryEn: `${scope.en} • ${f.fixEn}`,
        departmentAr: domainLabel(f.domain, true),
        departmentEn: domainLabel(f.domain, false),
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: Math.max(50, Math.round(f.monthlyKwd)),
        href: '/erp/planning',
      })
      syncGovernanceMap()
    },
    [domainLabel, syncGovernanceMap],
  )

  const scanLabel =
    scan.status === 'scanning'
      ? T('Scanning Odoo…', 'جارٍ فحص أودو…')
      : scan.status === 'unauthorized'
        ? T('Sign in to re-scan', 'سجّل الدخول لإعادة الفحص')
        : scan.status === 'error'
          ? T('Scan failed — retry', 'تعذّر الفحص — أعد المحاولة')
          : T('Re-Scan Live Odoo', 'مزامنة وفحص أودو الآن')

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={
        embedded
          ? 'w-full max-w-[1920px] mx-auto space-y-5'
          : 'w-full max-w-[1920px] mx-auto space-y-5 px-5 py-6 sm:px-8'
      }
    >
      <section className="ae-bento-card flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          {!embedded && (
            <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
              {T('Growth & Margin Playbook', 'فرص النمو وتحسين الهامش')}
            </h1>
          )}
          <p className="max-w-3xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
            {T(
              `${scoped.length} verified Odoo opportunities · ${AETHER_BRAIN_META.periodEn} · combined lift +${fmt0(AETHER_BRAIN_META.totalMonthlyKwd)} KWD/mo.`,
              `${scoped.length} فرصة موثقة من مبيعات ومشتريات أودو ١٧ · ${AETHER_BRAIN_META.periodAr} · أثر شهري مجمع +${fmt0(AETHER_BRAIN_META.totalMonthlyKwd)} د.ك.`,
            )}
          </p>
          {scan.status === 'done' && (
            <p className="text-[13.5px] font-medium text-emerald-700 dark:text-emerald-400">
              {T(
                `${scan.live ? 'Live Odoo' : 'Last Odoo snapshot'} · ${fmt0(scan.net ?? 0)} KWD net sales · ${fmt0(scan.orders ?? 0)} orders`,
                `${scan.live ? 'أودو مباشر' : 'آخر لقطة من أودو'} · صافي المبيعات ${fmt0(scan.net ?? 0)} د.ك · ${fmt0(scan.orders ?? 0)} طلباً`,
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {totalVisible > 0 && (
            <div className="ae-bento-subcard rounded-2xl px-4 py-2 text-end">
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                {T('Monthly Potential', 'الأثر الشهري المعروض')}
              </div>
              <div
                dir="ltr"
                className="text-[26px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                +{fmt0(totalVisible)} {isAr ? 'د.ك' : 'KWD'}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={rescan}
            disabled={scan.status === 'scanning'}
            className="btn-colored inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
          >
            <RefreshCw className={`h-4 w-4 ${scan.status === 'scanning' ? 'animate-spin' : ''}`} />
            {scanLabel}
          </button>
        </div>
      </section>

      {onlyIds && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50/80 px-4 py-2.5 text-[13.5px] font-medium text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>
            {T(
              `Showing ${scoped.length} recoverable-profit plays`,
              `عرض ${scoped.length} فرص للأرباح القابلة للاسترداد`,
            )}
          </span>
          {onClearOnly && (
            <button
              type="button"
              onClick={onClearOnly}
              className="cursor-pointer rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-[#111A22] dark:text-emerald-200"
            >
              {T('Show all', 'عرض الكل')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FINDING_DOMAINS.map((d) => {
          const active = domain === d.id
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={active}
              onClick={() => setDomain(d.id)}
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-bold ring-1 transition-colors ${
                active
                  ? 'btn-colored bg-emerald-600 text-white ring-emerald-600/80 shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                  : 'bg-white text-slate-700 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-emerald-50/60 dark:bg-[#111A22] dark:text-slate-200 dark:ring-white/[0.08]'
              }`}
            >
              {isAr ? d.ar : d.en}
              <span
                className={`rounded-full px-1.5 text-[11px] font-extrabold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-[#04130D]/20 dark:text-[#04130D]'
                    : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                }`}
              >
                {counts[d.id] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Compact 3-Column Growth Play Cards: Scope Pill + KWD Lift + Unique Title + 2-Line Insight + 1 Governance Action */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((f) => {
          const refKey = `playbook:${f.id}`
          const approval = approvalsByRef[refKey]
          const scope = FINDING_SCOPE_PILLS[f.id] ?? {
            ar: 'الأفنيوز • السالمية',
            en: 'Avenues • Salmiya',
          }
          const conciseInsight = isAr ? `${f.fixAr} — ${f.faultAr}` : `${f.fixEn} — ${f.faultEn}`
          const prompt = isAr
            ? `اشرحي لي خطة التنفيذ المختصرة لـ "${f.titleAr}" (${scope.ar}) وكيف نحقق +${fmt0(f.monthlyKwd)} د.ك شهرياً؟`
            : `Give me the concise execution plan for "${f.titleEn}" (${scope.en}) targeting +${fmt0(f.monthlyKwd)} KWD/mo.`

          return (
            <article
              key={f.id}
              className="ae-bento-card flex flex-col justify-between gap-4 p-5"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
                    {isAr ? scope.ar : scope.en}
                  </span>
                  {f.monthlyKwd > 0 && (
                    <span
                      dir="ltr"
                      className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold tabular-nums text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      {isAr ? `+${fmt0(f.monthlyKwd)} د.ك/شهر` : `+${fmt0(f.monthlyKwd)} KWD/mo`}
                    </span>
                  )}
                </div>

                <h2 className="text-[16px] font-bold leading-snug text-slate-950 dark:text-white">
                  {isAr ? f.titleAr : f.titleEn}
                </h2>

                <p className="line-clamp-2 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {conciseInsight}
                </p>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                {approval?.status === 'approved' ? (
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{T('Approved ✓', 'معتمد رسمياً ✓')}</span>
                  </span>
                ) : approval?.status === 'pending' ? (
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                    <Bell className="h-3.5 w-3.5" />
                    <span>{T('Pending Approval 🔔', 'بانتظار الاعتماد 🔔')}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmitFinding(f)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    <span>{T('Submit for Approval 🔔', 'رفع للاعتماد 🔔')}</span>
                  </button>
                )}

                <Link
                  href={feryalHref(prompt)}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{T('Ask Feryal ✨', 'اسأل فريال ✨')}</span>
                </Link>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
