'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { AETHER_BRAIN_META, AETHER_FINDINGS, FINDING_DOMAINS, type AetherFinding, type FindingDomain } from '@/lib/aether-proprietary-brain'
import { feryalHref } from '@/lib/aether/ledger'
import { useLang } from '@/components/aether/ui'

type ScanState = { status: 'idle' | 'scanning' | 'done' | 'unauthorized' | 'error'; at?: string; net?: number; orders?: number; live?: boolean }

const APPROVED_KEY = 'aether-approved-findings'
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US')

const SEVERITY: Record<AetherFinding['severity'], { en: string; ar: string; cls: string }> = {
  critical: { en: 'Critical', ar: 'حرج', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900' },
  high: { en: 'High', ar: 'مرتفع', cls: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900' },
  medium: { en: 'Medium', ar: 'متوسط', cls: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
}

/** Faults, Solutions & Growth Playbook — distilled outcomes of the background Aether brain. */
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
  const [approved, setApproved] = useState<Record<string, boolean>>({})
  const [scan, setScan] = useState<ScanState>({ status: 'idle' })

  useEffect(() => {
    try {
      setApproved(JSON.parse(localStorage.getItem(APPROVED_KEY) || '{}'))
    } catch {}
  }, [])

  const toggleApproved = useCallback((id: string) => {
    setApproved((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(APPROVED_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const rescan = useCallback(async () => {
    setScan({ status: 'scanning' })
    try {
      const res = await fetch('/api/odoo-sync', { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (res.status === 401) return setScan({ status: 'unauthorized' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScan({ status: 'done', at: data.syncedAt, net: data.totals?.netSalesKwd, orders: data.totals?.orders, live: data.source === 'live' })
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: data }))
    } catch {
      setScan({ status: 'error' })
    }
  }, [])

  const scoped = useMemo(() => {
    const raw = onlyIds ? AETHER_FINDINGS.filter((f) => onlyIds.includes(f.id)) : AETHER_FINDINGS
    const seen = new Set<string>()
    return raw.filter((f) => {
      const k = `${f.titleEn.trim().toLowerCase()}|${f.titleAr.trim()}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [onlyIds])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: scoped.length }
    for (const f of scoped) c[f.domain] = (c[f.domain] ?? 0) + 1
    return c
  }, [scoped])
  const visible = domain === 'all' ? scoped : scoped.filter((f) => f.domain === domain)
  const totalVisible = visible.reduce((s, f) => s + f.monthlyKwd, 0)
  const domainLabel = (d: FindingDomain) => {
    const x = FINDING_DOMAINS.find((y) => y.id === d)
    return x ? (isAr ? x.ar : x.en) : d
  }

  const scanLabel =
    scan.status === 'scanning'
      ? T('Scanning Odoo…', 'جارٍ فحص أودو…')
      : scan.status === 'unauthorized'
        ? T('Sign in to re-scan', 'سجّل الدخول لإعادة الفحص')
        : scan.status === 'error'
          ? T('Scan failed — retry', 'تعذّر الفحص — أعد المحاولة')
          : T('Re-Scan Live Odoo', 'مزامنة وفحص أودو الآن')

  const blocks = (f: AetherFinding) => [
    { n: T('1.', '١.'), title: T('Where the Fault Is', 'الخلل المكتشف'), body: isAr ? f.faultAr : f.faultEn, tone: 'plain' as const },
    { n: T('2.', '٢.'), title: T('Immediate Fix', 'الحلول الفورية'), body: isAr ? f.fixAr : f.fixEn, tone: 'plain' as const },
    { n: T('3.', '٣.'), title: T('Best Growth Proposal', 'المقترح الأفضل للتطوير وزيادة البيع'), body: isAr ? f.growthAr : f.growthEn, tone: 'plain' as const },
    { n: T('4.', '٤.'), title: T('Expected Result', 'المتوقع عند التنفيذ'), body: isAr ? f.resultAr : f.resultEn, tone: 'outcome' as const },
  ]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={embedded ? 'w-full space-y-6' : 'w-full max-w-[1920px] mx-auto space-y-6 px-5 py-6 sm:px-8'}>
      <section className="ae-bento-card flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          {!embedded && (
            <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
              {T('Faults, Solutions & Growth Playbook', 'الحلول ومقترحات التطوير والنمو')}
            </h1>
          )}
          <p className="max-w-3xl text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {T(
              `${AETHER_FINDINGS.length} findings from Odoo sales, accounting, purchasing and POS sessions · ${AETHER_BRAIN_META.periodEn} · combined potential about ${fmt0(AETHER_BRAIN_META.totalMonthlyKwd)} KWD per month.`,
              `${AETHER_FINDINGS.length} نتيجة من مبيعات أودو ومحاسبته ومشترياته وجلسات نقاط البيع · ${AETHER_BRAIN_META.periodAr} · الأثر المحتمل المجمّع نحو ${fmt0(AETHER_BRAIN_META.totalMonthlyKwd)} د.ك شهرياً.`,
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
              <div dir="ltr" className="text-[28px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
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
          <span>{T(`Showing the ${scoped.length} recoverable-profit fixes`, `عرض ${scoped.length} حلول للأرباح القابلة للاسترداد`)}</span>
          {onClearOnly && (
            <button
              type="button"
              onClick={onClearOnly}
              className="cursor-pointer rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-[#111A22] dark:text-emerald-200"
            >
              {T('Show all solutions', 'عرض كل الحلول')}
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {visible.map((f) => {
          const sev = SEVERITY[f.severity]
          const isApproved = !!approved[f.id]
          const prompt = isAr
            ? `ناقشي معي خطة "${f.titleAr}": الخلل المكتشف، والحلول الفورية، والمقترح الأفضل للنمو، والنتيجة المتوقعة عند التنفيذ.`
            : `Let's discuss the "${f.titleEn}" plan: the fault, the immediate fix, the best growth proposal and the expected result.`
          return (
            <article
              key={f.id}
              className={`ae-bento-card flex flex-col gap-4 p-6 transition-shadow duration-200 ${
                isApproved ? 'ring-2 ring-emerald-500/45' : ''
              }`}
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ring-1 ${sev.cls}`}>{isAr ? sev.ar : sev.en}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{domainLabel(f.domain)}</span>
                  </div>
                  <h2 className="text-[16.5px] font-bold leading-snug text-slate-950 dark:text-white">{isAr ? f.titleAr : f.titleEn}</h2>
                </div>
                {f.monthlyKwd > 0 && (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-[13.5px] font-extrabold tabular-nums text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {T(`+${fmt0(f.monthlyKwd)} KWD / month`, `زيادة ${fmt0(f.monthlyKwd)} د.ك شهرياً`)}
                  </span>
                )}
              </header>

              <div className="space-y-3">
                {blocks(f).map((b) => (
                  <div key={b.title} className={b.tone === 'outcome' ? 'rounded-xl bg-emerald-50/70 p-4 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30' : 'rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50'}>
                    <div className={`text-[12.5px] font-bold ${b.tone === 'outcome' ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {b.n} {b.title}
                    </div>
                    <p className={`mt-1 text-[14.5px] leading-[1.8] ${b.tone === 'outcome' ? 'text-emerald-950 dark:text-emerald-50' : 'text-slate-800 dark:text-slate-100'}`}>{b.body}</p>
                  </div>
                ))}
              </div>

              <footer className="mt-auto flex flex-wrap gap-2.5">
                <Link
                  href={feryalHref(prompt)}
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-slate-100 px-4 py-2.5 text-[13.5px] font-bold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {T('Discuss the plan with Feryal', 'ناقش الخطة مع فريال')}
                </Link>
                <button
                  type="button"
                  aria-pressed={isApproved}
                  onClick={() => toggleApproved(f.id)}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[13.5px] font-bold transition-all active:scale-[0.98] ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/35 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'btn-colored bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isApproved ? T('Approved for execution ✓', 'معتمد للتنفيذ ✓') : T('Approve for execution', 'اعتماد للتنفيذ')}
                </button>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
