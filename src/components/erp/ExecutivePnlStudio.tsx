'use client'

import React, { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { accountsForPnlGroup, GlStatementsPanel } from '@/components/accounting/GlStatementsPanel'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'
import { lastClosedMonthRange } from '@/lib/aether/closed-month-policy'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import {
  formatInt,
  formatKuwaitDate,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const DRILLDOWN_PAGE_SIZE = 12

function resolvePnlKpiGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

function NullableKwdCell({
  value,
  locale,
  className = '',
}: {
  value: number | null | undefined
  locale: 'ar' | 'en'
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      data-unavailable={unavailable ? 'true' : undefined}
      className={`ds-num inline-block font-mono tabular-nums ${className}`}
    >
      {formatKwd(value, locale)}
    </span>
  )
}

function NullablePctCell({
  value,
  locale,
  className = '',
}: {
  value: number | null | undefined
  locale: 'ar' | 'en'
  className?: string
}) {
  const unavailable = typeof value !== 'number' || !Number.isFinite(value)
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={unavailable ? tooltip : undefined}
      aria-label={unavailable ? tooltip : undefined}
      data-unavailable={unavailable ? 'true' : undefined}
      className={`ds-num inline-block font-mono tabular-nums ${className}`}
    >
      {formatPct(value, locale)}
    </span>
  )
}

export function ExecutivePnlStudio() {
  const { locale } = useI18n()
  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale !== 'en'
  const { workspace, liveSummary, syncingOdoo, setCustomRange } = useGlobalFilter()
  const [glLines, setGlLines] = useState<GlAccountLine[]>([])
  const [accountSearch, setAccountSearch] = useState('')
  const [accountPage, setAccountPage] = useState(1)

  const onGlLines = useCallback((lines: GlAccountLine[]) => setGlLines(lines), [])
  const closedMonth = lastClosedMonthRange(workspace.accounting.glClosedThroughDate)
  const gl = workspace.accounting

  const brandRows = useMemo(
    () =>
      [...workspace.cascadingOptions.brands.filter((b) => b.id !== 'all')].sort(
        (a, b) => (b.salesKwd ?? -1) - (a.salesKwd ?? -1),
      ),
    [workspace.cascadingOptions.brands],
  )
  const branchRows = useMemo(
    () =>
      [...workspace.cascadingOptions.branches.filter((b) => b.id !== 'all')].sort(
        (a, b) => (b.salesKwd ?? -1) - (a.salesKwd ?? -1),
      ),
    [workspace.cascadingOptions.branches],
  )
  const channelRows = useMemo(
    () => workspace.cascadingOptions.channels.filter((c) => c.id !== 'all'),
    [workspace.cascadingOptions.channels],
  )

  const activeBrandRows = useMemo(
    () => brandRows.filter((b) => typeof b.salesKwd === 'number' && b.salesKwd > 0.0005),
    [brandRows],
  )
  const activeBranchRows = useMemo(
    () => branchRows.filter((b) => typeof b.salesKwd === 'number' && b.salesKwd > 0.0005),
    [branchRows],
  )

  const glGrossProfitKwd =
    gl.totalRevenueKwd !== null && gl.cogsKwd !== null
      ? Math.round((gl.totalRevenueKwd - gl.cogsKwd) * 1000) / 1000
      : null
  const glGrossMarginPct =
    glGrossProfitKwd !== null && gl.totalRevenueKwd && gl.totalRevenueKwd > 0
      ? Math.round((glGrossProfitKwd / gl.totalRevenueKwd) * 1000) / 10
      : null

  const lineItems = useMemo(
    () => [
      {
        code: 'income',
        labelAr: 'إجمالي الإيرادات المرحلة بدفتر الأستاذ العام (account.move.line)',
        labelEn: 'Posted General Ledger Revenue (account.move.line)',
        amountKwd: gl.totalRevenueKwd,
        pctOfRev: gl.totalRevenueKwd !== null && gl.totalRevenueKwd > 0 ? 100 : null,
        tone: 'text-emerald-700 dark:text-emerald-400',
      },
      {
        code: 'expense_direct_cost',
        labelAr: 'تكلفة البضاعة والمواد الغذائية والتعبئة الفعلية (COGS)',
        labelEn: 'Posted Cost of Goods Sold & Packaging (COGS)',
        amountKwd: gl.cogsKwd !== null ? -gl.cogsKwd : null,
        pctOfRev: gl.cogsPct,
        tone: 'text-rose-700 dark:text-rose-400',
      },
      {
        code: 'GP',
        labelAr: 'مجمل الربح التشغيلي (بعد تكلفة المواد الخام)',
        labelEn: 'Gross Profit (After Food & Packaging Cost)',
        amountKwd: glGrossProfitKwd,
        pctOfRev: glGrossMarginPct,
        tone: 'text-emerald-700 dark:text-emerald-300 font-black',
      },
      {
        code: 'platform_commission',
        labelAr: 'عمولات منصات التوصيل المرحلة (طلبات، كيتا، ديليفرو، جاهز)',
        labelEn: 'Posted Aggregator Delivery Commissions',
        amountKwd: gl.deliveryCommissionsKwd !== null ? -gl.deliveryCommissionsKwd : null,
        pctOfRev: gl.deliveryCommPct,
        tone: 'text-slate-800 dark:text-slate-200',
      },
      {
        code: 'expense',
        labelAr: 'المصروفات التشغيلية والإيجارات والرواتب والإهلاك المرحلة',
        labelEn: 'Posted Operating Expenses, Rent, Payroll & Depreciation',
        amountKwd:
          gl.otherOpexAndDepreciationKwd !== null ? -gl.otherOpexAndDepreciationKwd : null,
        pctOfRev: gl.opexRentDeprPct,
        tone: 'text-slate-800 dark:text-slate-200',
      },
      {
        code: 'OP-NET',
        labelAr: 'صافي الربح التشغيلي الفعلي (مطابق لقيود الأستاذ العام)',
        labelEn: 'Actual Operating Profit (Reconciled to Odoo General Ledger)',
        amountKwd: gl.netProfitWithheld ? null : gl.operatingProfitKwd,
        pctOfRev: gl.netProfitWithheld ? null : gl.netProfitPct,
        tone:
          typeof gl.operatingProfitKwd === 'number' && gl.operatingProfitKwd < 0
            ? 'text-rose-700 dark:text-rose-400 font-black'
            : 'text-emerald-700 dark:text-emerald-400 font-black',
      },
    ],
    [
      gl.cogsKwd,
      gl.cogsPct,
      gl.deliveryCommPct,
      gl.deliveryCommissionsKwd,
      gl.netProfitPct,
      gl.netProfitWithheld,
      gl.operatingProfitKwd,
      gl.opexRentDeprPct,
      gl.otherOpexAndDepreciationKwd,
      gl.totalRevenueKwd,
      glGrossMarginPct,
      glGrossProfitKwd,
    ],
  )

  const populatedLineItems = useMemo(
    () => lineItems.filter((item) => item.amountKwd !== null),
    [lineItems],
  )

  const drilldownAccounts = useMemo(() => {
    const groups = ['income', 'expense_direct_cost', 'platform_commission', 'expense'] as const
    const commCodes = gl.commissionAccounts.map((a) => a.code)
    const rows: Array<{
      groupCode: string
      code: string
      name: string
      presentedKwd: number
    }> = []
    for (const g of groups) {
      const matched = accountsForPnlGroup(glLines, g, commCodes)
      for (const acc of matched) {
        const presented = -acc.balance
        if (Math.abs(presented) <= 0.0005) continue
        rows.push({
          groupCode: g,
          code: acc.code,
          name: acc.name,
          presentedKwd: presented,
        })
      }
    }
    const q = accountSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.groupCode.toLowerCase().includes(q),
    )
  }, [accountSearch, gl.commissionAccounts, glLines])

  const totalAccountPages = Math.max(1, Math.ceil(drilldownAccounts.length / DRILLDOWN_PAGE_SIZE))
  const pagedDrilldownAccounts = useMemo(
    () =>
      drilldownAccounts.slice(
        (accountPage - 1) * DRILLDOWN_PAGE_SIZE,
        accountPage * DRILLDOWN_PAGE_SIZE,
      ),
    [accountPage, drilldownAccounts],
  )

  const glFromFormatted = formatKuwaitDate(gl.from, resolvedLocale)
  const glToFormatted = formatKuwaitDate(gl.to, resolvedLocale)
  const glLinesFormatted = formatInt(gl.lineCount, resolvedLocale)
  const lastSyncIso = liveSummary?.lastSyncAt ?? liveSummary?.syncedAt ?? workspace.lastSyncAt ?? null
  const isStale24h = Boolean(liveSummary?.isStale24h || workspace.isStale24h)

  // Deterministic Executive Odoo Intelligence & Recommendations (100% grounded in live Odoo P&L + POS)
  const aiInsights = useMemo(() => {
    if (!workspace.odooConnected || workspace.noData) return []
    const insights: Array<{ id: string; title: string; body: string }> = []

    if (gl.totalRevenueKwd !== null && workspace.nullableSalesKwd !== null) {
      const gap = gl.totalRevenueKwd - workspace.nullableSalesKwd
      insights.push({
        id: 'pos-gl-reconcile',
        title: isAr ? 'مطابقة نقاط البيع مع الأستاذ العام' : 'POS-to-GL Revenue Reconciliation',
        body: isAr
          ? `صافي نقاط البيع ${formatKwd(workspace.nullableSalesKwd, 'ar')} مقابل إيرادات الأستاذ العام المرحلة ${formatKwd(gl.totalRevenueKwd, 'ar')} (فارق التوقيت/غير الكاشير: ${formatKwd(gap, { locale: 'ar', signed: true })}).`
          : `POS net sales of ${formatKwd(workspace.nullableSalesKwd, 'en')} vs posted GL revenue of ${formatKwd(gl.totalRevenueKwd, 'en')} (non-POS / posting timing variance: ${formatKwd(gap, { locale: 'en', signed: true })}).`,
      })
    } else if (workspace.nullableSalesKwd !== null) {
      insights.push({
        id: 'pos-live-status',
        title: isAr ? 'حالة الإقفال المحاسبي ومبيعات POS' : 'POS Live Revenue & GL Accrual Status',
        body: isAr
          ? `صافي مبيعات نقاط البيع الفعلي يبلغ ${formatKwd(workspace.nullableSalesKwd, 'ar')}${workspace.nullableOrders !== null ? ` عبر ${formatInt(workspace.nullableOrders, 'ar')} طلب` : ''}. قيود الاستحقاق الشهرية تُقفل بنهاية الشهر${closedMonth ? ` (آخر شهر مقفل: ${closedMonth.from} → ${closedMonth.to})` : ''}.`
          : `Live POS net revenue stands at ${formatKwd(workspace.nullableSalesKwd, 'en')}${workspace.nullableOrders !== null ? ` across ${formatInt(workspace.nullableOrders, 'en')} settled orders` : ''}. Month-end GL accruals post at period close${closedMonth ? ` (last closed month: ${closedMonth.from} → ${closedMonth.to})` : ''}.`,
      })
    }

    if (activeBrandRows[0] && workspace.nullableSalesKwd && workspace.nullableSalesKwd > 0) {
      const topB = activeBrandRows[0]
      const topBr = activeBranchRows[0]
      const brandShare = ((topB.salesKwd ?? 0) / workspace.nullableSalesKwd) * 100
      const branchShare =
        topBr && topBr.salesKwd
          ? ((topBr.salesKwd ?? 0) / workspace.nullableSalesKwd) * 100
          : null
      insights.push({
        id: 'revenue-concentration',
        title: isAr ? 'تركّز الإيرادات حسب العلامة والفرع' : 'Brand & Branch Revenue Concentration',
        body: isAr
          ? `${topB.ar} يتصدر العلامات بمبلغ ${formatKwd(topB.salesKwd ?? 0, 'ar')} (${formatPct(brandShare, 'ar')})${topBr && branchShare !== null ? `، ويتصدر فرع ${topBr.ar} الفروع بمبلغ ${formatKwd(topBr.salesKwd ?? 0, 'ar')} (${formatPct(branchShare, 'ar')})` : ''}.`
          : `${topB.en} leads brand revenue at ${formatKwd(topB.salesKwd ?? 0, 'en')} (${formatPct(brandShare, 'en')})${topBr && branchShare !== null ? `, while ${topBr.en} leads branches at ${formatKwd(topBr.salesKwd ?? 0, 'en')} (${formatPct(branchShare, 'en')})` : ''}.`,
      })
    }

    const directChSales = channelRows
      .filter((c) => c.id === 'dine-in' || c.id === 'takeaway-direct')
      .reduce((s, c) => s + (typeof c.salesKwd === 'number' ? c.salesKwd : 0), 0)
    const aggChSales = channelRows
      .filter((c) => c.id !== 'dine-in' && c.id !== 'takeaway-direct')
      .reduce((s, c) => s + (typeof c.salesKwd === 'number' ? c.salesKwd : 0), 0)
    const totalChSales = directChSales + aggChSales

    if (gl.available && (gl.cogsPct !== null || gl.deliveryCommPct !== null)) {
      insights.push({
        id: 'gl-cost-ratio',
        title: isAr ? 'هيكل التكاليف المرحلة والهامش' : 'Posted Cost Structure & Margin',
        body: isAr
          ? `تكلفة المواد (COGS) تمثل ${formatPct(gl.cogsPct, 'ar')} من الإيراد المرحل${gl.deliveryCommPct !== null ? `، وعمولات التوصيل ${formatPct(gl.deliveryCommPct, 'ar')}` : ''}${!gl.netProfitWithheld && gl.netProfitPct !== null ? `، بصافي هامش تشغيلي ${formatPct(gl.netProfitPct, 'ar')}` : ''}.`
          : `Posted COGS represents ${formatPct(gl.cogsPct, 'en')} of GL revenue${gl.deliveryCommPct !== null ? `, aggregator commissions ${formatPct(gl.deliveryCommPct, 'en')}` : ''}${!gl.netProfitWithheld && gl.netProfitPct !== null ? `, yielding ${formatPct(gl.netProfitPct, 'en')} operating margin` : ''}.`,
      })
    } else if (totalChSales > 0.0005) {
      const directPct = (directChSales / totalChSales) * 100
      const aggPct = (aggChSales / totalChSales) * 100
      insights.push({
        id: 'channel-mix-margin',
        title: isAr ? 'مزيج القنوات المباشرة مقابل التطبيقات' : 'Direct vs Aggregator Channel Mix',
        body: isAr
          ? `المبيعات المباشرة بلا عمولة (صالة وسفري) سجّلت ${formatKwd(directChSales, 'ar')} (${formatPct(directPct, 'ar')}) مقابل ${formatKwd(aggChSales, 'ar')} (${formatPct(aggPct, 'ar')}) عبر تطبيقات التوصيل.`
          : `Zero-commission direct channels (dine-in & takeaway) generated ${formatKwd(directChSales, 'en')} (${formatPct(directPct, 'en')}) vs ${formatKwd(aggChSales, 'en')} (${formatPct(aggPct, 'en')}) via delivery aggregators.`,
      })
    }

    return insights
  }, [
    activeBranchRows,
    activeBrandRows,
    channelRows,
    closedMonth,
    gl.available,
    gl.cogsPct,
    gl.deliveryCommPct,
    gl.netProfitPct,
    gl.netProfitWithheld,
    gl.totalRevenueKwd,
    isAr,
    workspace.noData,
    workspace.nullableOrders,
    workspace.nullableSalesKwd,
    workspace.odooConnected,
  ])

  const kpiCards = useMemo(() => {
    const cards: Array<{ key: string; node: React.ReactNode }> = []

    if (workspace.nullableSalesKwd !== null) {
      cards.push({
        key: 'pos-sales',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'صافي مبيعات نقاط البيع (POS)' : 'POS Net Sales (pos.order)'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
              <NullableKwdCell value={workspace.nullableSalesKwd} locale={resolvedLocale} />
            </div>
            {workspace.nullableOrders !== null ? (
              <span
                dir="ltr"
                className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold block tabular-nums"
              >
                {`${formatInt(workspace.nullableOrders, resolvedLocale)} ${isAr ? 'طلب مقبوض' : 'settled orders'}`}
              </span>
            ) : null}
            <KpiProvenanceBadge
              odooModel="pos.order"
              dateRange={workspace.dateRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              compact
            />
          </div>
        ),
      })
    }

    if (gl.totalRevenueKwd !== null) {
      cards.push({
        key: 'gl-revenue',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'إيرادات الأستاذ العام (GL)' : 'GL Posted Revenue'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
              <NullableKwdCell value={gl.totalRevenueKwd} locale={resolvedLocale} />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block tabular-nums">
              {isAr ? `${glLinesFormatted} سطر قيد مرحّل` : `${glLinesFormatted} posted move lines`}
            </span>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: gl.from, to: gl.to }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              compact
            />
          </div>
        ),
      })
    } else if (workspace.nullableAovKwd !== null) {
      cards.push({
        key: 'pos-aov',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'متوسط قيمة الطلب (AOV)' : 'Average Order Value (AOV)'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
              <NullableKwdCell value={workspace.nullableAovKwd} locale={resolvedLocale} />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">
              {isAr ? 'صافي المبيعات ÷ عدد الطلبات' : 'Net sales ÷ settled orders'}
            </span>
            <KpiProvenanceBadge
              odooModel="pos.order"
              dateRange={workspace.dateRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="محسوب بمعادلة"
              compact
            />
          </div>
        ),
      })
    }

    if (gl.cogsKwd !== null) {
      cards.push({
        key: 'gl-cogs',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'تكلفة البضاعة الفعلية (COGS)' : 'Actual GL COGS'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
              <NullableKwdCell value={gl.cogsKwd} locale={resolvedLocale} />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">
              {isAr ? 'النسبة من الإيراد: ' : '% of Revenue: '}
              <NullablePctCell value={gl.cogsPct} locale={resolvedLocale} />
            </span>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: gl.from, to: gl.to }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              compact
            />
          </div>
        ),
      })
    } else if (activeBrandRows[0] && typeof activeBrandRows[0].salesKwd === 'number') {
      cards.push({
        key: 'top-brand',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'العلامة الأعلى إيراداً' : 'Top Revenue Brand'}
            </span>
            <div className="min-w-0 truncate text-lg font-black text-slate-950 dark:text-white">
              {isAr ? activeBrandRows[0].ar : activeBrandRows[0].en}
            </div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <NullableKwdCell value={activeBrandRows[0].salesKwd} locale={resolvedLocale} />
            </div>
            <KpiProvenanceBadge
              odooModel="pos.order.line"
              dateRange={workspace.dateRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              compact
            />
          </div>
        ),
      })
    }

    if (gl.operatingProfitKwd !== null && !gl.netProfitWithheld) {
      cards.push({
        key: 'gl-operating-profit',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'صافي الربح التشغيلي (GL)' : 'GL Operating Profit'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
              <NullableKwdCell value={gl.operatingProfitKwd} locale={resolvedLocale} />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">
              {isAr ? 'هامش التشغيل: ' : 'Operating Margin: '}
              <NullablePctCell value={gl.netProfitPct} locale={resolvedLocale} />
            </span>
            <KpiProvenanceBadge
              odooModel="account.move.line"
              dateRange={{ from: gl.from, to: gl.to }}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="محسوب بمعادلة"
              compact
            />
          </div>
        ),
      })
    } else if (activeBranchRows[0] && typeof activeBranchRows[0].salesKwd === 'number') {
      cards.push({
        key: 'top-branch',
        node: (
          <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0d1524]">
            <span className="block min-w-0 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
              {isAr ? 'الفرع الأعلى إيراداً' : 'Top Revenue Branch'}
            </span>
            <div className="min-w-0 truncate text-lg font-black text-slate-950 dark:text-white">
              {isAr ? activeBranchRows[0].ar : activeBranchRows[0].en}
            </div>
            <div className="text-sm font-bold text-cyan-700 dark:text-cyan-300">
              <NullableKwdCell value={activeBranchRows[0].salesKwd} locale={resolvedLocale} />
            </div>
            <KpiProvenanceBadge
              odooModel="pos.order"
              dateRange={workspace.dateRange}
              lastSyncAt={lastSyncIso}
              isStale24h={isStale24h}
              kind="فعلي"
              compact
            />
          </div>
        ),
      })
    }

    return cards
  }, [
    activeBranchRows,
    activeBrandRows,
    gl.cogsKwd,
    gl.cogsPct,
    gl.from,
    gl.netProfitPct,
    gl.netProfitWithheld,
    gl.operatingProfitKwd,
    gl.to,
    gl.totalRevenueKwd,
    glLinesFormatted,
    isAr,
    isStale24h,
    lastSyncIso,
    resolvedLocale,
    workspace.dateRange,
    workspace.nullableAovKwd,
    workspace.nullableOrders,
    workspace.nullableSalesKwd,
  ])

  const accountingScopeTooltip = useMemo(() => {
    const notes: string[] = []
    if (!gl.available) {
      const reason = isAr ? gl.unavailableReasonAr : gl.unavailableReasonEn
      if (reason) notes.push(reason)
    }
    if (gl.netProfitWithheld) {
      const withheld = isAr ? gl.netProfitWithheldReasonAr : gl.netProfitWithheldReasonEn
      if (withheld) notes.push(withheld)
    }
    return notes.join(' — ')
  }, [
    gl.available,
    gl.netProfitWithheld,
    gl.netProfitWithheldReasonAr,
    gl.netProfitWithheldReasonEn,
    gl.unavailableReasonAr,
    gl.unavailableReasonEn,
    isAr,
  ])

  if (syncingOdoo && !liveSummary) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
        <StateBlock
          state="loading"
          locale={resolvedLocale}
          skeletonRows={5}
          title={isAr ? 'جارٍ تحميل قائمة الدخل من الأستاذ العام…' : 'Loading General Ledger P&L…'}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6 min-w-0 pb-12">
      {/* Header */}
      <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-500/25 dark:bg-[#0b1320]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <FileSpreadsheet size={14} aria-hidden />
                <span>
                  {isAr
                    ? 'قائمة الدخل التنفيذية ومطابقة الأستاذ العام · أودو 17'
                    : 'Executive P&L & Odoo 17 General Ledger Statement'}
                </span>
              </div>
              {accountingScopeTooltip ? (
                <CompactInfoTooltip
                  text={accountingScopeTooltip}
                  label={isAr ? 'ملاحظة حالة الإقفال المحاسبي' : 'Accounting Close Status'}
                  isAr={isAr}
                  dataNetProfitWithheld={gl.netProfitWithheld}
                />
              ) : null}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white break-words">
              {isAr
                ? 'قائمة الدخل الفعلية ومطابقة إيرادات نقاط البيع مع قيود الأستاذ العام'
                : 'Actual Income Statement & POS-to-GL Reconciliation'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn} •{' '}
              {isAr
                ? `نطاق القيود المحاسبية: ${glFromFormatted} إلى ${glToFormatted} (${glLinesFormatted} سطر قيد)`
                : `GL Window: ${glFromFormatted} to ${glToFormatted} (${glLinesFormatted} move lines)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {closedMonth ? (
              <button
                type="button"
                onClick={() => setCustomRange(closedMonth.from, closedMonth.to)}
                className="ds-focus-ring inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                {isAr ? 'آخر شهر مُقفل' : 'Last closed month'}
              </button>
            ) : null}
            <Link
              href="/erp/finance"
              className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:border-emerald-500/40 hover:bg-white transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              <Landmark size={14} className="shrink-0" aria-hidden />
              <span>{isAr ? 'المركز المالي الشامل' : 'Full Finance Hub'}</span>
              <ArrowUpRight size={13} className="shrink-0" aria-hidden />
            </Link>
            <Link
              href="/erp/receivables"
              className="ds-focus-ring inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition dark:text-emerald-300"
            >
              <Receipt size={14} className="shrink-0" aria-hidden />
              <span>{isAr ? 'الذمم المدينة المفتوحة' : 'Open receivables'}</span>
              <ArrowUpRight size={13} className="shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {!workspace.odooConnected || workspace.noData ? (
        <StateBlock
          state={!workspace.odooConnected ? 'unlinked' : 'empty'}
          locale={resolvedLocale}
          title={
            !workspace.odooConnected
              ? isAr
                ? 'الاتصال المباشر مع Odoo غير متاح حالياً'
                : 'Odoo live connection is unavailable'
              : isAr
                ? 'لا توجد قيود مالية في هذه الفترة'
                : 'No financial entries for this period'
          }
          description={isAr ? gl.unavailableReasonAr : gl.unavailableReasonEn}
        />
      ) : (
        <>
          {/* 1. Clean Executive KPIs */}
          {kpiCards.length > 0 ? (
            <div className={`grid gap-3.5 ${resolvePnlKpiGridCols(kpiCards.length)}`}>
              {kpiCards.map((item) => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
              ))}
            </div>
          ) : null}

          {/* 2. Executive Odoo Intelligence & Recommendations Strip */}
          {aiInsights.length > 0 ? (
            <section
              data-finance-ai-insights="true"
              className="ds-surface relative overflow-visible rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/50 p-4 sm:p-5 shadow-xs dark:border-emerald-400/20 dark:from-[#0d1915] dark:via-[#0b1320] dark:to-[#0d1724]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  {isAr
                    ? 'تحليلات وتوصيات قائمة الدخل ومطابقة POS مع الأستاذ العام (أودو 17)'
                    : 'Executive P&L & POS-to-GL Intelligence (Odoo 17)'}
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

          {/* 3. Visual Revenue Contribution Bars (Active Brands & Active Branches) */}
          {(activeBrandRows.length > 0 || activeBranchRows.length > 0) && workspace.nullableSalesKwd !== null ? (
            <div
              className={`grid grid-cols-1 gap-4 ${
                activeBrandRows.length > 0 && activeBranchRows.length > 0 ? 'lg:grid-cols-2' : ''
              }`}
            >
              {activeBrandRows.length > 0 ? (
                <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                    <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">
                      {isAr ? 'مساهمة العلامات التجارية في الإيرادات' : 'Revenue Contribution by Brand'}
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {activeBrandRows.map((b) => {
                      const totalNet = workspace.nullableSalesKwd ?? 0
                      const sales = b.salesKwd ?? 0
                      const share = totalNet > 0 ? Math.min(100, (sales / totalNet) * 100) : 0
                      const brandLabel = isAr ? b.ar : b.en
                      return (
                        <div key={b.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-bold text-slate-900 dark:text-slate-200">
                              {brandLabel}
                            </span>
                            <span
                              dir="ltr"
                              className="ds-num shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400"
                            >
                              {formatKwd(sales, resolvedLocale)} ({formatPct(share, resolvedLocale)})
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={brandLabel}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(share)}
                            className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                          >
                            <div
                              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                              style={{ width: `${Math.max(2, share)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {activeBranchRows.length > 0 ? (
                <div className="ds-surface relative overflow-visible min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-xs dark:border-slate-800 dark:bg-[#0b1320]">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                    <Landmark size={16} className="text-cyan-600 dark:text-cyan-400" aria-hidden />
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">
                      {isAr ? 'مساهمة الفروع النشطة في الإيرادات' : 'Revenue Contribution by Active Branch'}
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {activeBranchRows.map((br) => {
                      const totalNet = workspace.nullableSalesKwd ?? 0
                      const sales = br.salesKwd ?? 0
                      const share = totalNet > 0 ? Math.min(100, (sales / totalNet) * 100) : 0
                      const branchLabel = isAr ? br.ar : br.en
                      return (
                        <div key={br.id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-bold text-slate-900 dark:text-slate-200">
                              {branchLabel}
                            </span>
                            <span
                              dir="ltr"
                              className="ds-num shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-cyan-700 dark:text-cyan-300"
                            >
                              {formatKwd(sales, resolvedLocale)} ({formatPct(share, resolvedLocale)})
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={branchLabel}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(share)}
                            className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                          >
                            <div
                              className="h-full rounded-full bg-cyan-600 dark:bg-cyan-500"
                              style={{ width: `${Math.max(2, share)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 4. Income Statement Summary + Collapsible & Paginated GL Account Ledgers */}
          <div className="ds-surface relative overflow-visible rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 dark:border-slate-800 dark:bg-[#0b1320]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-2">
                <Scale size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  {isAr
                    ? 'جدول قائمة الدخل المحاسبية (فنتشر فودز ذ.م.م.)'
                    : 'General Ledger Income Statement (Venture Foods W.L.L.)'}
                </h3>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={12} className="shrink-0" aria-hidden />
                {isAr ? 'حساب ديناميكي من أودو' : 'Dynamic Odoo GL'}
              </span>
            </div>

            {populatedLineItems.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-800">
                    <tr>
                      <th className="whitespace-nowrap py-3 px-4 text-start font-bold">{isAr ? 'رمز الحساب' : 'GL Code'}</th>
                      <th className="py-3 px-4 text-start font-bold">{isAr ? 'البند المحاسبي' : 'Statement Line'}</th>
                      <th className="whitespace-nowrap py-3 px-4 text-end font-bold">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                      <th className="whitespace-nowrap py-3 px-4 text-end font-bold">{isAr ? 'النسبة من الإيراد' : '% of Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums dark:divide-slate-800/70">
                    {populatedLineItems.map((item) => (
                      <tr key={item.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition">
                        <td className="whitespace-nowrap py-3 px-4 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                          {item.code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {isAr ? item.labelAr : item.labelEn}
                        </td>
                        <td className={`whitespace-nowrap py-3 px-4 text-end font-bold ${item.tone}`} dir="ltr">
                          <NullableKwdCell value={item.amountKwd} locale={resolvedLocale} />
                        </td>
                        <td className="whitespace-nowrap py-3 px-4 text-end text-slate-700 dark:text-slate-300" dir="ltr">
                          {item.pctOfRev !== null ? (
                            <NullablePctCell value={item.pctOfRev} locale={resolvedLocale} />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : kpiCards.length === 0 ? (
              <StateBlock state="unavailable" locale={resolvedLocale} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                <span>
                  {isAr
                    ? 'قيود قائمة الدخل الشهرية تُرحَّل عند إقفال الشهر المحاسبي؛ راجع مبيعات POS ومساهمة العلامات أعلاه.'
                    : 'Month-end GL P&L accrual lines post at monthly close; live POS revenue and brand/branch shares are shown above.'}
                </span>
                {closedMonth ? (
                  <button
                    type="button"
                    onClick={() => setCustomRange(closedMonth.from, closedMonth.to)}
                    className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    {isAr ? 'فتح آخر شهر مُقفل' : 'Inspect Last Closed Month'}
                  </button>
                ) : null}
              </div>
            )}

            {/* Collapsible & Paginated Underlying GL Accounts Drilldown */}
            {drilldownAccounts.length > 0 || accountSearch.trim() !== '' ? (
              <details
                data-ledger-collapsible="pnl-accounts"
                className="group relative overflow-visible rounded-2xl border border-slate-200/85 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {isAr ? 'تفصيل حسابات قائمة الدخل المرحلة' : 'Posted P&L Account Breakdown'}
                    </span>
                    <span
                      dir="ltr"
                      className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
                    >
                      {formatInt(drilldownAccounts.length, resolvedLocale)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {isAr ? 'عرض / طي الحسابات (12 لكل صفحة)' : 'Expand / Collapse Accounts (12 per page)'}
                  </span>
                </summary>

                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                      <input
                        type="search"
                        value={accountSearch}
                        onChange={(e) => {
                          setAccountSearch(e.target.value)
                          setAccountPage(1)
                        }}
                        aria-label={isAr ? 'بحث في حسابات الدخل' : 'Search P&L accounts'}
                        placeholder={isAr ? 'بحث برمز أو اسم الحساب...' : 'Search code or account...'}
                        className="h-8 rounded-xl border border-slate-200 bg-white ps-8 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {totalAccountPages > 1 ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <button
                          type="button"
                          disabled={accountPage <= 1}
                          onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                          aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 disabled:opacity-40 dark:bg-white/10 dark:ring-white/10"
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
                          aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 disabled:opacity-40 dark:bg-white/10 dark:ring-white/10"
                        >
                          {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full min-w-[520px] text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/90">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="whitespace-nowrap px-3 py-2 text-start font-bold">{isAr ? 'الكود' : 'Code'}</th>
                          <th className="px-3 py-2 text-start font-bold">{isAr ? 'اسم الحساب' : 'Account Name'}</th>
                          <th className="whitespace-nowrap px-3 py-2 text-end font-bold">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/60">
                        {pagedDrilldownAccounts.map((acc) => (
                          <tr key={`${acc.groupCode}-${acc.code}`} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                            <td dir="ltr" className="whitespace-nowrap px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                              {acc.code}
                            </td>
                            <td className="max-w-[280px] truncate px-3 py-2 font-medium text-slate-900 dark:text-white">
                              {acc.name}
                            </td>
                            <td dir="ltr" className="whitespace-nowrap px-3 py-2 text-end font-bold tabular-nums text-slate-900 dark:text-white">
                              <NullableKwdCell value={acc.presentedKwd} locale={resolvedLocale} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ) : null}

            <GlStatementsPanel from={gl.from} to={gl.to} isAr={isAr} onLines={onGlLines} />
          </div>
        </>
      )}
    </div>
  )
}
