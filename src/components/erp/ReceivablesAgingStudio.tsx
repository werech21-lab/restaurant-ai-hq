'use client'

import React, { useMemo, useState } from 'react'
import { canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import { isPosClearingAccount, receivablesCustomerSplit } from '@/lib/odoo/live-sync-core'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useLang } from '@/components/aether/ui'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import {
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
  formatPct,
} from '@/lib/format'

const PAGE_SIZE = 12

function resolveArKpiGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

export function ReceivablesAgingStudio() {
  const { isAr, T } = useLang()
  const resolvedLocale: 'ar' | 'en' = isAr ? 'ar' : 'en'
  const { workspace, liveSummary, syncingOdoo } = useGlobalFilter()
  const ar = workspace.receivables

  const [accountSearch, setAccountSearch] = useState('')
  const [accountPage, setAccountPage] = useState(1)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerPage, setPartnerPage] = useState(1)

  const amountsVisible = canShowReceivableAmounts(ar)
  const partners = useMemo(
    () => (ar.byPartner ?? []).filter((row) => !isPosClearingAccount(row.accountCode)),
    [ar.byPartner],
  )
  const split = useMemo(
    () => receivablesCustomerSplit(ar.byAccount ?? [], partners),
    [ar.byAccount, partners],
  )
  const customerAccounts = useMemo(
    () =>
      split.splitKnown
        ? [...split.customerAccounts].sort((a, b) => {
            const order = ['10501', '10502', '10503', '10504', '10505', '10507', '10508', '10509', '121000']
            const ai = order.indexOf(a.accountCode)
            const bi = order.indexOf(b.accountCode)
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
        : [],
    [split.customerAccounts, split.splitKnown],
  )

  const figures = ar.figures
  const platformNet = figures?.netKwd ?? null
  const platformDebits = figures?.openDebitsKwd ?? null
  const platformCredits = figures?.unappliedCreditsKwd ?? null
  const platformLines = split.splitKnown ? split.platformLineCount : ar.platformAndCorporateLinesCount
  const posResidual = split.splitKnown ? split.posClearingResidualKwd : ar.posClearingResidualKwd
  const posLines = split.splitKnown ? split.posClearingLineCount : ar.posClearingLinesCount
  const oldestPosting = ar.oldestOpenPostingDate ?? (split.splitKnown ? null : ar.fromDate)

  const kuwaitToday = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuwait',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    [],
  )

  const openDays = (posting: string | null | undefined): number | null => {
    if (!posting || !/^\d{4}-\d{2}-\d{2}/.test(posting)) return null
    const ms = Date.parse(`${kuwaitToday}T00:00:00Z`) - Date.parse(`${posting.slice(0, 10)}T00:00:00Z`)
    if (!Number.isFinite(ms)) return null
    return Math.max(0, Math.round(ms / 86_400_000))
  }

  const syncStamp = liveSummary?.kuwaitSyncedAt
    ? liveSummary.kuwaitSyncedAt
    : formatKuwaitDateTime(
        liveSummary?.latestOdooRecordAt ?? liveSummary?.syncedAt ?? null,
        resolvedLocale,
      )
  const fromFormatted = formatKuwaitDate(ar.fromDate, resolvedLocale)
  const toFormatted = formatKuwaitDate(ar.toDate, resolvedLocale)
  const lastSyncIso = liveSummary?.lastSyncAt ?? liveSummary?.syncedAt ?? workspace.lastSyncAt ?? null
  const isStale24h = Boolean(liveSummary?.isStale24h || workspace.isStale24h)

  // Deterministic Executive Odoo Intelligence & Recommendations (100% grounded in live Odoo AR actuals)
  const aiInsights = useMemo(() => {
    if (ar.unavailable) return []
    const items: Array<{ id: string; title: string; body: string }> = []

    const positiveAccounts = [...customerAccounts]
      .filter((acc) => acc.residualKwd > 0.0005)
      .sort((a, b) => b.residualKwd - a.residualKwd)
    const positiveSum = positiveAccounts.reduce((s, x) => s + x.residualKwd, 0)

    if (positiveAccounts[0] && positiveSum > 0) {
      const top = positiveAccounts[0]
      const topShare = (top.residualKwd / positiveSum) * 100
      const topName = isAr ? top.labelAr : top.labelEn
      items.push({
        id: 'top-concentration',
        title: T('Top Platform Concentration', 'تركّز الذمم الأعلى'),
        body: isAr
          ? `${topName} (${top.accountCode}) يتصدّر الأرصدة المدينة المفتوحة بمبلغ ${formatKwd(top.residualKwd, 'ar')} (${formatPct(topShare, 'ar')} من إجمالي الذمم الموجبة عبر ${formatInt(top.linesCount, 'ar')} قيد) — يُوصى بمطابقة كشف تسوية المنصة أولاً.`
          : `${topName} (${top.accountCode}) holds ${formatKwd(top.residualKwd, 'en')} (${formatPct(topShare, 'en')} of positive open receivables across ${formatInt(top.linesCount, 'en')} lines) — prioritize statement settlement matching.`,
      })
    }

    if (amountsVisible && ar.agingBuckets.length > 0) {
      const bucket31to60 = ar.agingBuckets.find((b) => b.key === '31_60')
      const bucketOver60 = ar.agingBuckets.find((b) => b.key === 'over_60')
      const overdueResidual = (bucket31to60?.residualKwd ?? 0) + (bucketOver60?.residualKwd ?? 0)
      const overdueDebits = (bucket31to60?.positiveDebitKwd ?? 0) + (bucketOver60?.positiveDebitKwd ?? 0)
      const overdueLines = (bucket31to60?.linesCount ?? 0) + (bucketOver60?.linesCount ?? 0)

      if (overdueDebits > 0.0005 || Math.abs(overdueResidual) > 0.0005) {
        items.push({
          id: 'overdue-priority',
          title: T('>30d Collection & Aging Priority', 'أولوية التحصيل والتسوية (>30 يوماً)'),
          body: isAr
            ? `إجمالي المبالغ المدينة لأكثر من 30 يوماً يبلغ ${formatKwd(overdueDebits, 'ar')} (صافي الشرائح المتقادمة ${formatKwd(overdueResidual, 'ar')} عبر ${formatInt(overdueLines, 'ar')} قيد)؛ الأولوية لتحصيل ومقاصة شريحة >60 يوماً (${formatKwd(bucketOver60?.positiveDebitKwd ?? 0, 'ar')}).`
            : `Open debits aged >30 days total ${formatKwd(overdueDebits, 'en')} (net aged balance ${formatKwd(overdueResidual, 'en')} across ${formatInt(overdueLines, 'en')} lines), led by >60d debits of ${formatKwd(bucketOver60?.positiveDebitKwd ?? 0, 'en')}.`,
        })
      } else {
        items.push({
          id: 'overdue-clean',
          title: T('Aging Health (>30 Days)', 'سلامة التقادم (>30 يوماً)'),
          body: isAr
            ? 'لا توجد أرصدة مدينة متأخرة تتجاوز 30 يوماً حالياً؛ تتركز الذمم المفتوحة ضمن الدورة الجارية (0–30 يوماً).'
            : 'Zero overdue positive debits aged beyond 30 days; open receivables remain within the active 0–30 day settlement cycle.',
        })
      }
    }

    if (typeof platformCredits === 'number' && Math.abs(platformCredits) > 0.0005) {
      items.push({
        id: 'credit-clearing',
        title: T('Unapplied Credit Clearing Action', 'إجراء مقاصة الدفعات غير المطبّقة'),
        body: isAr
          ? `يتوفر رصيد دائن غير مطبّق بقيمة ${formatKwd(platformCredits, 'ar')}${posLines > 0 ? ` إضافة إلى ${formatInt(posLines, 'ar')} قيد مقاصة كاشير (10552)` : ''} — ربط هذه الدفعات بالفواتير المفتوحة في أودو يقلّص عدد السطور المعلقة فوراً.`
          : `${formatKwd(platformCredits, 'en')} in unapplied platform/corporate credits${posLines > 0 ? ` plus ${formatInt(posLines, 'en')} cashier clearing lines (10552)` : ''} can be matched against open debits in Odoo to compress unreconciled line volume.`,
      })
    }

    return items
  }, [amountsVisible, ar.agingBuckets, ar.unavailable, customerAccounts, isAr, platformCredits, posLines, T])

  const kpiCards = useMemo(() => {
    if (ar.unavailable) return []
    const list: Array<{ key: string; node: React.ReactNode }> = []

    if (platformNet !== null) {
      list.push({
        key: 'open-residual',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
              {T('Platform & corporate open residual', 'المتبقي المفتوح للمنصات والشركات')}
            </p>
            <div
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
            >
              <span data-platform-residual="true">{formatKwd(platformNet, resolvedLocale)}</span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isAr ? `من ${fromFormatted} إلى ${toFormatted}` : `${fromFormatted} → ${toFormatted}`}
            </p>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: ar.fromDate, to: ar.toDate }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="SUM(amount_residual) ON customer/platform receivable accounts WHERE reconciled=false"
              compact
            />
          </article>
        ),
      })
    }

    if (platformDebits !== null && Math.abs(platformDebits) > 0.0005) {
      list.push({
        key: 'gross-debits',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
              {T('Gross open debits (excl. cashier clearing)', 'إجمالي المدين المفتوح (بدون مقاصة الكاشير)')}
            </p>
            <div
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300"
            >
              {formatKwd(platformDebits, { locale: resolvedLocale, signed: true })}
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {T('Talabat, Trade AR, Hesabe, Jahez & Keeta', 'طلبات، ذمم شركات، حسابي، جاهز وكيتا')}
            </p>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: ar.fromDate, to: ar.toDate }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="SUM(amount_residual > 0) ON asset_receivable excl. 10552"
              compact
            />
          </article>
        ),
      })
    }

    if (platformCredits !== null && Math.abs(platformCredits) > 0.0005) {
      list.push({
        key: 'unapplied-credits',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
              {T('Unapplied credits (excl. cashier clearing)', 'دائن غير مطبّق (بدون مقاصة الكاشير)')}
            </p>
            <div
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-300"
            >
              {formatKwd(platformCredits, resolvedLocale)}
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {T('Unapplied credits on platform and trade accounts', 'دائن غير مطبّق على حسابات المنصات والشركات')}
            </p>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: ar.fromDate, to: ar.toDate }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="ABS(SUM(amount_residual < 0)) ON asset_receivable excl. 10552"
              compact
            />
          </article>
        ),
      })
    }

    if (platformLines > 0) {
      list.push({
        key: 'open-lines',
        node: (
          <article className="ae-kpi-card relative overflow-visible min-w-0 rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#111A17] dark:ring-emerald-400/[0.09]">
            <p className="min-w-0 truncate text-xs font-bold text-slate-600 dark:text-[#8FA39B]">
              {T('Open platform & corporate lines', 'قيود المنصات والشركات المفتوحة')}
            </p>
            <div
              dir="ltr"
              className="ds-num mt-2 text-2xl font-extrabold tabular-nums text-slate-950 dark:text-white"
            >
              {formatInt(platformLines, resolvedLocale)}
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isAr
                ? `أقدم تاريخ قيد ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : '—'}`
                : `Oldest posting date ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : '—'}`}
            </p>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: ar.fromDate, to: ar.toDate }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="COUNT(account.move.line WHERE reconciled=false excl. 10552)"
              compact
            />
          </article>
        ),
      })
    }

    return list
  }, [
    T,
    ar.fromDate,
    ar.toDate,
    ar.unavailable,
    fromFormatted,
    isAr,
    isStale24h,
    lastSyncIso,
    oldestPosting,
    platformCredits,
    platformDebits,
    platformLines,
    platformNet,
    resolvedLocale,
    toFormatted,
  ])

  const activeCustomerAccounts = useMemo(() => {
    const nonZero = customerAccounts.filter(
      (r) => Math.abs(r.residualKwd) > 0.0005 || r.linesCount > 0,
    )
    const q = accountSearch.trim().toLowerCase()
    if (!q) return nonZero
    return nonZero.filter(
      (r) =>
        r.accountCode.toLowerCase().includes(q) ||
        r.labelAr.toLowerCase().includes(q) ||
        r.labelEn.toLowerCase().includes(q),
    )
  }, [accountSearch, customerAccounts])

  const totalAccountPages = Math.max(1, Math.ceil(activeCustomerAccounts.length / PAGE_SIZE))
  const pagedAccounts = useMemo(
    () => activeCustomerAccounts.slice((accountPage - 1) * PAGE_SIZE, accountPage * PAGE_SIZE),
    [accountPage, activeCustomerAccounts],
  )

  const filteredPartners = useMemo(() => {
    const nonZero = partners.filter(
      (r) => Math.abs(r.residualKwd) > 0.0005 || r.linesCount > 0,
    )
    const q = partnerSearch.trim().toLowerCase()
    if (!q) return nonZero
    return nonZero.filter(
      (r) =>
        r.partnerName.toLowerCase().includes(q) ||
        r.accountCode.toLowerCase().includes(q),
    )
  }, [partnerSearch, partners])

  const totalPartnerPages = Math.max(1, Math.ceil(filteredPartners.length / PAGE_SIZE))
  const pagedPartners = useMemo(
    () => filteredPartners.slice((partnerPage - 1) * PAGE_SIZE, partnerPage * PAGE_SIZE),
    [filteredPartners, partnerPage],
  )

  const visualAccountBars = useMemo(() => {
    const rows = customerAccounts
      .filter((r) => Math.abs(r.residualKwd) > 0.0005)
      .sort((a, b) => Math.abs(b.residualKwd) - Math.abs(a.residualKwd))
      .slice(0, 6)
    const maxAbs = Math.max(...rows.map((r) => Math.abs(r.residualKwd)), 1)
    return rows.map((r) => ({
      ...r,
      barPct: Math.max(4, Math.round((Math.abs(r.residualKwd) / maxAbs) * 100)),
    }))
  }, [customerAccounts])

  if (syncingOdoo && !liveSummary) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-5 pb-12">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل ذمم المنصات والشركات…' : 'Loading open receivables…'}
        />
      </div>
    )
  }

  const openLinesTooltip = isAr ? ar.openLinesExplanationAr : ar.openLinesExplanationEn

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-5 pb-12 text-slate-900 dark:text-slate-100 min-w-0"
    >
      {/* Header Banner */}
      <section className="ae-bento-card ds-surface relative overflow-visible rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {T(
                    'Odoo 17 Receivable Ledger (account.move.line · reconciled=false)',
                    'دفتر ذمم أودو 17 غير المسوّاة (account.move.line · reconciled=false)',
                  )}
                </span>
              </span>
              {!ar.unavailable && openLinesTooltip ? (
                <CompactInfoTooltip
                  text={openLinesTooltip}
                  label={
                    isAr
                      ? `تفسير الـ ${formatInt(ar.unreconciledLineCount, resolvedLocale)} سطراً المفتوحة`
                      : `Why ${formatInt(ar.unreconciledLineCount, resolvedLocale)} Open Move Lines Exist`
                  }
                  isAr={isAr}
                  dataScopeNote
                />
              ) : null}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white break-words">
              {T(
                'Platform & corporate open receivables',
                'ذمم المنصات والشركات المفتوحة',
              )}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-[#8FA39B]">
              {isAr
                ? `رصيد متبقٍ مفتوح حتى ${syncStamp} (قيود غير مسوّاة، مستقل عن فلتر الفترة) • أقدم تاريخ قيد ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : fromFormatted}`
                : `Open residual as of ${syncStamp} (unreconciled lines, independent of the period filter) • Oldest posting date ${oldestPosting ? formatKuwaitDate(oldestPosting, resolvedLocale) : fromFormatted}`}
            </p>
          </div>

          <Link
            href="/erp"
            className="ds-focus-ring ae-bento-subcard inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold text-slate-800 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
          >
            {isAr ? <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span>{T('Back to Overview', 'العودة لملخص الشركة')}</span>
          </Link>
        </div>
      </section>

      {ar.unavailable ? (
        <StateBlock
          state="unavailable"
          locale={resolvedLocale}
          title={T('Open receivables are currently unavailable from Odoo', 'بيانات الذمم المفتوحة غير متاحة حالياً من أودو')}
        />
      ) : (
        <>
          {/* 1. Clean Executive KPIs (Dynamic Grid) */}
          {kpiCards.length > 0 ? (
            <div className={`grid gap-4 ${resolveArKpiGridCols(kpiCards.length)}`}>
              {kpiCards.map((item) => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ))}
            </div>
          ) : null}

          {/* 2. Executive Odoo Intelligence & Recommendations Strip */}
          {aiInsights.length > 0 ? (
            <section
              data-finance-ai-insights="true"
              className="ae-bento-card relative overflow-visible rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/50 p-4 sm:p-5 shadow-xs dark:border-emerald-400/20 dark:from-[#0f1d18] dark:via-[#101815] dark:to-[#0f1a22]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  {T(
                    'Executive Odoo AR Intelligence & Collection Priorities',
                    'الرؤى التنفيذية وأولويات التحصيل والمقاصة (من واقع أودو 17)',
                  )}
                </h3>
              </div>
              <div
                className={`grid gap-3 ${
                  aiInsights.length === 1
                    ? 'grid-cols-1'
                    : aiInsights.length === 2
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 lg:grid-cols-3'
                }`}
              >
                {aiInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                      {insight.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* 3. Visual Summary Bars: Aging Buckets + Account Concentration */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {amountsVisible && ar.agingBuckets.length > 0 ? (
              <section
                className={`ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1] ${
                  visualAccountBars.length > 0 ? 'xl:col-span-7' : 'xl:col-span-12'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {T(
                      'Aging Buckets (0–30, 31–60, >60 Days)',
                      'شرائح أعمار الذمم المدينة (0–30، 31–60، أكثر من 60 يوماً)',
                    )}
                  </h3>
                </div>

                {/* Proportional Visual Bar */}
                {(() => {
                  const totalGross = ar.agingBuckets.reduce(
                    (s, b) => s + Math.max(0, b.positiveDebitKwd),
                    0,
                  )
                  const colors = ['bg-emerald-500', 'bg-sky-500', 'bg-rose-500']
                  return totalGross > 0 ? (
                    <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      {ar.agingBuckets.map((b, idx) => {
                        const pct = (Math.max(0, b.positiveDebitKwd) / totalGross) * 100
                        if (pct <= 0) return null
                        return (
                          <div
                            key={b.key}
                            style={{ width: `${Math.max(2, pct)}%` }}
                            className={`${colors[idx % colors.length]} transition-all`}
                          />
                        )
                      })}
                    </div>
                  ) : null
                })()}

                <div
                  className={`grid gap-3 ${
                    ar.agingBuckets.length === 1
                      ? 'grid-cols-1'
                      : ar.agingBuckets.length === 2
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1 md:grid-cols-3'
                  }`}
                >
                  {ar.agingBuckets.map((b) => (
                    <div
                      key={b.key}
                      className="min-w-0 rounded-2xl bg-[#F6F7F8] p-4 ring-1 ring-slate-900/[0.05] dark:bg-[#141F1B] dark:ring-emerald-400/[0.1]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">
                          {isAr ? b.labelAr : b.labelEn}
                        </span>
                        <span
                          dir="ltr"
                          className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-900/10 dark:bg-[#101815] dark:text-slate-200"
                        >
                          {formatInt(b.linesCount, resolvedLocale)} {T('lines', 'قيد')}
                        </span>
                      </div>
                      <div
                        dir="ltr"
                        className="ds-num mt-2 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300"
                      >
                        {formatKwd(b.residualKwd, resolvedLocale)}
                      </div>
                      <p
                        dir="ltr"
                        className="ds-num mt-1 text-xs font-medium tabular-nums text-slate-600 dark:text-[#8FA39B]"
                      >
                        {formatKwd(b.positiveDebitKwd, {
                          locale: resolvedLocale,
                          signed: true,
                          showUnit: false,
                        })}{' '}
                        {T('debit', 'مدين')} /{' '}
                        {formatKwd(b.creditOffsetKwd, {
                          locale: resolvedLocale,
                          showUnit: false,
                        })}{' '}
                        {T('clearing', 'مقاصة')}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {visualAccountBars.length > 0 ? (
              <section
                className={`ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1] ${
                  amountsVisible && ar.agingBuckets.length > 0 ? 'xl:col-span-5' : 'xl:col-span-12'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {T('Receivable Concentration by Platform', 'تركّز الذمم حسب المنصة والحساب')}
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{isAr ? figures?.formulaAr : figures?.formulaEn}</span>
                  </span>
                </div>
                <div className="space-y-3">
                  {visualAccountBars.map((acc) => {
                    const isCredit = acc.residualKwd < 0
                    return (
                      <div key={acc.accountId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                            <span dir="ltr" className="font-mono text-slate-500 dark:text-slate-400">
                              {acc.accountCode}
                            </span>{' '}
                            {isAr ? acc.labelAr : acc.labelEn}
                          </span>
                          <span
                            dir="ltr"
                            className={`shrink-0 whitespace-nowrap font-mono font-bold tabular-nums ${
                              isCredit
                                ? 'text-sky-700 dark:text-sky-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {formatKwd(acc.residualKwd, { locale: resolvedLocale, signed: true })}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                          <div
                            style={{ width: `${acc.barPct}%` }}
                            className={`h-full rounded-full ${
                              isCredit ? 'bg-sky-500' : 'bg-emerald-600 dark:bg-emerald-400'
                            }`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}
          </div>

          {/* 4. Collapsible & Paginated Receivable Account Ledger */}
          {customerAccounts.length > 0 ? (
            <details
              open={customerAccounts.length <= PAGE_SIZE}
              data-ledger-collapsible="accounts"
              className="group ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {T(
                      'Breakdown by Delivery Platform & Receivable Account',
                      'التوزيع التفصيلي حسب منصة التوصيل وحساب الذمم في أودو',
                    )}
                  </h3>
                  <span
                    dir="ltr"
                    className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
                  >
                    {formatInt(activeCustomerAccounts.length, resolvedLocale)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {T('Click to expand / collapse ledger', 'اضغط لفتح أو طي جدول الحسابات')}
                </span>
              </summary>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="search"
                      value={accountSearch}
                      onChange={(e) => {
                        setAccountSearch(e.target.value)
                        setAccountPage(1)
                      }}
                      aria-label={T('Search receivable account', 'بحث في حسابات الذمم')}
                      placeholder={T('Search account or platform...', 'بحث بالحساب أو المنصة...')}
                      className="h-9 rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                    />
                  </div>
                  {totalAccountPages > 1 ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        disabled={accountPage <= 1}
                        onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                        aria-label={T('Previous page', 'الصفحة السابقة')}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                      </button>
                      <span dir="ltr" className="px-2 tabular-nums">
                        {accountPage} / {totalAccountPages}
                      </span>
                      <button
                        type="button"
                        disabled={accountPage >= totalAccountPages}
                        onClick={() => setAccountPage((p) => Math.min(totalAccountPages, p + 1))}
                        aria-label={T('Next page', 'الصفحة التالية')}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold">
                          {T('Code', 'رمز الحساب')}
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold">
                          {T('Platform / Receivable Account', 'المنصة / حساب الذمم المدينة')}
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold">
                          {T('Unreconciled Lines', 'عدد القيود المفتوحة')}
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold">
                          {T('Net Residual Balance', 'الرصيد الصافي المفتوح')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 tabular-nums dark:divide-white/10">
                      {pagedAccounts.map((row) => (
                        <tr key={row.accountId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-emerald-300">
                            {row.accountCode}
                          </td>
                          <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {isAr ? row.labelAr : row.labelEn}
                          </td>
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 text-end font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                            {formatInt(row.linesCount, resolvedLocale)}
                          </td>
                          <td
                            dir="ltr"
                            className={`ds-num whitespace-nowrap px-4 py-3 text-end font-mono font-bold tabular-nums ${
                              row.residualKwd < 0
                                ? 'text-sky-700 dark:text-sky-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {formatKwd(row.residualKwd, {
                              locale: resolvedLocale,
                              signed: true,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ) : null}

          {/* 5. Collapsible & Paginated Partner Ledger */}
          {partners.length > 0 ? (
            <details
              data-receivable-partners="true"
              data-ledger-collapsible="partners"
              className="group ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101815] dark:ring-emerald-400/[0.1]"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                    {T('Open residual by partner', 'المتبقي المفتوح حسب الشريك')}
                  </h3>
                  <span
                    dir="ltr"
                    className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
                  >
                    {formatInt(filteredPartners.length, resolvedLocale)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {T('Expand partner ledger (12 per page)', 'عرض سجل الشركاء التفصيلي (12 لكل صفحة)')}
                </span>
              </summary>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="search"
                      value={partnerSearch}
                      onChange={(e) => {
                        setPartnerSearch(e.target.value)
                        setPartnerPage(1)
                      }}
                      aria-label={T('Search partner', 'بحث عن شريك')}
                      placeholder={T('Search partner or account...', 'بحث باسم الشريك أو الحساب...')}
                      className="h-9 rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                    />
                  </div>
                  {totalPartnerPages > 1 ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        disabled={partnerPage <= 1}
                        onClick={() => setPartnerPage((p) => Math.max(1, p - 1))}
                        aria-label={T('Previous partner page', 'الصفحة السابقة')}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                      </button>
                      <span dir="ltr" className="px-2 tabular-nums">
                        {partnerPage} / {totalPartnerPages}
                      </span>
                      <button
                        type="button"
                        disabled={partnerPage >= totalPartnerPages}
                        onClick={() => setPartnerPage((p) => Math.min(totalPartnerPages, p + 1))}
                        aria-label={T('Next partner page', 'الصفحة التالية')}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
                      >
                        {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead className="bg-[#F6F7F8] text-slate-600 dark:bg-[#09110E] dark:text-slate-300">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold">{T('Partner', 'الشريك')}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold">{T('Account', 'الحساب')}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold">{T('Lines', 'القيود')}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold">{T('Residual', 'المتبقي')}</th>
                        <th className="whitespace-nowrap px-4 py-3 text-end text-xs font-bold">{T('Days open from posting date', 'أيام مفتوح حسب تاريخ القيد')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 tabular-nums dark:divide-white/10">
                      {pagedPartners.map((row) => (
                        <tr key={`${row.partnerId}-${row.accountId}`} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                          <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.partnerName}</td>
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.accountCode}</td>
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 text-end tabular-nums">{formatInt(row.linesCount, resolvedLocale)}</td>
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 text-end font-bold tabular-nums">{formatKwd(row.residualKwd, { locale: resolvedLocale, signed: true })}</td>
                          <td dir="ltr" className="whitespace-nowrap px-4 py-3 text-end tabular-nums">{formatInt(openDays(row.oldestPostingDate), resolvedLocale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ) : null}

          {(posLines > 0 || (typeof posResidual === 'number' && posResidual !== 0)) ? (
            <section data-pos-clearing="10552" className="relative overflow-visible rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-white/[0.03] dark:ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{T('Cashier clearing — not customer receivables', 'مقاصة كاشير — ليست ذمم عملاء')}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {isAr ? `${formatInt(posLines, resolvedLocale)} قيد على الحساب 10552` : `${formatInt(posLines, resolvedLocale)} lines on account 10552`}
                  </p>
                </div>
                <p dir="ltr" className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatKwd(posResidual ?? null, resolvedLocale)}</p>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
