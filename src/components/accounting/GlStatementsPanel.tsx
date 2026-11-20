'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Search } from 'lucide-react'
import {
  balanceSheetView,
  trialBalanceTotals,
  type GlAccountLine,
} from '@/lib/odoo/gl-statements'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import { formatInt, formatKwd } from '@/lib/format'

interface StatementPayload {
  from: string
  to: string
  budgetReadable: boolean
  trialBalance: { lines: GlAccountLine[]; unavailableSections: string[] }
  balanceSheet: { lines: GlAccountLine[]; unavailableSections: string[] }
}

const PAGE_SIZE = 12

export function accountsForPnlGroup(
  lines: readonly GlAccountLine[],
  group: string,
  commissionCodes: readonly string[],
): GlAccountLine[] {
  const commission = new Set(commissionCodes)
  return lines.filter((line) => {
    if (line.salesScopeExcluded) return false
    if (group === 'income') return line.accountType === 'income' || line.accountType === 'income_other'
    if (group === 'expense_direct_cost') return line.accountType === 'expense_direct_cost'
    if (group === 'platform_commission') return commission.has(line.code)
    if (group === 'expense') {
      return (
        (line.accountType === 'expense' || line.accountType === 'expense_depreciation') &&
        !commission.has(line.code)
      )
    }
    return false
  })
}

function money(value: number, isAr: boolean): string {
  return formatKwd(value, isAr ? 'ar' : 'en')
}

export function GlStatementsPanel({
  from,
  to,
  isAr,
  onLines,
}: {
  from: string
  to: string
  isAr: boolean
  onLines?: (lines: GlAccountLine[]) => void
}) {
  const [payload, setPayload] = useState<StatementPayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    setPayload(null)
    fetch(`/api/erp/finance/gl-statements?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('gl')
        return (await res.json()) as StatementPayload
      })
      .then((data) => {
        setPayload(data)
        onLines?.(data.trialBalance?.lines ?? [])
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [from, to, onLines])

  if (failed || !payload) {
    return null
  }

  const hasTrialLines = payload.trialBalance.lines.length > 0
  const hasBalanceLines = payload.balanceSheet.lines.length > 0
  if (!hasTrialLines && !hasBalanceLines) {
    return null
  }

  const scopeNote = isAr
    ? `نطاق القيود المحاسبية المرحلة: ${payload.from} → ${payload.to} (${payload.budgetReadable ? 'الموازنات قابلة للقراءة' : 'فعلي بدون جدول موازنة'})`
    : `Posted GL statement window: ${payload.from} → ${payload.to} (${payload.budgetReadable ? 'budget model readable' : 'actuals only'})`

  return (
    <section className="space-y-4" data-gl-statements="true">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'القوائم المحاسبية التفصيلية (ميزان المراجعة والميزانية)' : 'Detailed GL Statements (Trial Balance & Balance Sheet)'}
          </span>
          <CompactInfoTooltip
            text={scopeNote}
            label={isAr ? 'نطاق قراءة دفتر الأستاذ' : 'GL Statement Scope'}
            isAr={isAr}
          />
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
          {payload.from} → {payload.to}
        </span>
      </div>

      {hasTrialLines ? <TrialBalanceTable lines={payload.trialBalance.lines} isAr={isAr} /> : null}
      {hasBalanceLines ? <BalanceSheetTable lines={payload.balanceSheet.lines} isAr={isAr} /> : null}
    </section>
  )
}

function TrialBalanceTable({
  lines,
  isAr,
}: {
  lines: GlAccountLine[]
  isAr: boolean
}) {
  const locale = isAr ? 'ar' : 'en'
  const [search, setSearch] = useState('')
  const [showZeroRows, setShowZeroRows] = useState(false)
  const [page, setPage] = useState(1)

  const totals = useMemo(() => trialBalanceTotals(lines), [lines])

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lines.filter((line) => {
      const isZero =
        Math.abs(line.debit) <= 0.0005 &&
        Math.abs(line.credit) <= 0.0005 &&
        Math.abs(line.balance) <= 0.0005
      if (!showZeroRows && isZero) return false
      if (!q) return true
      return line.code.toLowerCase().includes(q) || line.name.toLowerCase().includes(q)
    })
  }, [lines, search, showZeroRows])

  const totalPages = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedLines = useMemo(
    () => filteredLines.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredLines, safePage],
  )

  return (
    <details
      data-ledger-collapsible="trial-balance"
      className="group rounded-2xl border border-slate-200/85 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/90"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
            {isAr ? 'ميزان المراجعة التفصيلي' : 'Trial Balance'}
          </h3>
          <span
            dir="ltr"
            className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
          >
            {formatInt(filteredLines.length, locale)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
          <span>
            {isAr ? 'مدين:' : 'Debit:'}{' '}
            <span dir="ltr" className="font-bold text-slate-900 dark:text-white">{money(totals.debit, isAr)}</span>
          </span>
          <span>
            {isAr ? 'دائن:' : 'Credit:'}{' '}
            <span dir="ltr" className="font-bold text-slate-900 dark:text-white">{money(totals.credit, isAr)}</span>
          </span>
          <span className="text-emerald-700 dark:text-emerald-300">
            {isAr ? 'عرض / طي' : 'Expand / Collapse'}
          </span>
        </div>
      </summary>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                aria-label={isAr ? 'بحث في ميزان المراجعة' : 'Search trial balance'}
                placeholder={isAr ? 'بحث برمز أو اسم الحساب...' : 'Search code or account...'}
                className="h-8 rounded-xl border border-slate-200 bg-slate-50 ps-8 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showZeroRows}
              onClick={() => {
                setShowZeroRows((prev) => !prev)
                setPage(1)
              }}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {showZeroRows ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
              <span>{isAr ? 'إظهار الصفوف الصفرية' : 'Show zero rows'}</span>
            </button>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
              >
                {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
              </button>
              <span dir="ltr" className="px-2 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
              >
                {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="whitespace-nowrap px-3 py-2 text-start font-bold">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="whitespace-nowrap px-3 py-2 text-end font-bold">{isAr ? 'مدين' : 'Debit'}</th>
                <th className="whitespace-nowrap px-3 py-2 text-end font-bold">{isAr ? 'دائن' : 'Credit'}</th>
                <th className="whitespace-nowrap px-3 py-2 text-end font-bold">{isAr ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {pagedLines.map((line) => (
                <tr key={line.code} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className="px-3 py-2 pe-2">
                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-300" dir="ltr">
                      {line.code}
                    </span>{' '}
                    <span className="font-medium text-slate-900 dark:text-white">{line.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums" dir="ltr">{money(line.debit, isAr)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums" dir="ltr">{money(line.credit, isAr)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-end font-semibold tabular-nums" dir="ltr">{money(line.balance, isAr)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-900/90">
                <td className="px-3 py-2 font-bold">{isAr ? 'الإجمالي الكلي' : 'Grand Total'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-end font-bold tabular-nums" dir="ltr">{money(totals.debit, isAr)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-end font-bold tabular-nums" dir="ltr">{money(totals.credit, isAr)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-end font-bold tabular-nums" dir="ltr">{money(totals.balance, isAr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

function BalanceSheetTable({
  lines,
  isAr,
}: {
  lines: GlAccountLine[]
  isAr: boolean
}) {
  const locale = isAr ? 'ar' : 'en'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const view = useMemo(() => balanceSheetView(lines), [lines])

  const flatRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: Array<{
      code: string
      name: string
      groupLabel: string
      presented: number
    }> = []
    for (const group of view.groups) {
      if (group.key === 'excluded' && group.lines.length === 0) continue
      const groupLabel = isAr ? group.labelAr : group.labelEn
      for (const line of group.lines) {
        if (Math.abs(line.presented) <= 0.0005) continue
        if (
          q &&
          !line.code.toLowerCase().includes(q) &&
          !line.name.toLowerCase().includes(q) &&
          !groupLabel.toLowerCase().includes(q)
        ) {
          continue
        }
        out.push({
          code: line.code,
          name: line.name,
          groupLabel,
          presented: line.presented,
        })
      }
    }
    return out
  }, [isAr, search, view.groups])

  if (flatRows.length === 0 && !search.trim()) {
    return null
  }

  const totalPages = Math.max(1, Math.ceil(flatRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = flatRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <details
      data-balance-sheet="true"
      data-ledger-collapsible="balance-sheet"
      className="group rounded-2xl border border-slate-200/85 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/90"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
          <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
            {isAr ? 'الميزانية العمومية' : 'Balance Sheet'}
          </h3>
          <span
            dir="ltr"
            className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-slate-200"
          >
            {formatInt(flatRows.length, locale)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
          <span>
            {isAr ? 'الأصول:' : 'Assets:'}{' '}
            <span dir="ltr" className="font-bold text-slate-900 dark:text-white">{money(view.totals.assets, isAr)}</span>
          </span>
          {view.balanced ? (
            <span
              dir="ltr"
              data-balance-check="ok"
              className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300"
            >
              {`A ${money(view.totals.assets, isAr)} = L+E`}
            </span>
          ) : (
            <CompactInfoTooltip
              text={
                isAr
                  ? 'بعض قيود التسوية الختامية للفترة المفتوحة لم تُرحَّل بعد في الميزانية.'
                  : 'Period-end closing entries for this open window are not yet fully posted.'
              }
              label={isAr ? 'حالة توازن الميزانية' : 'Balance Check Note'}
              isAr={isAr}
            />
          )}
          <span className="text-emerald-700 dark:text-emerald-300">
            {isAr ? 'عرض / طي' : 'Expand / Collapse'}
          </span>
        </div>
      </summary>

      <div className="mt-4 space-y-3">
        {/* Group Summary Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {view.groups
            .filter((g) => g.key !== 'excluded' && Math.abs(g.total) > 0.0005)
            .map((g) => (
              <div
                key={g.key}
                className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-white/[0.03]"
              >
                <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isAr ? g.labelAr : g.labelEn}
                </p>
                <p dir="ltr" className="mt-1 font-mono text-xs font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {money(g.total, isAr)}
                </p>
              </div>
            ))}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-white/[0.03]">
            <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? view.currentEarningsLabelAr : view.currentEarningsLabelEn}
            </p>
            <p dir="ltr" className="mt-1 font-mono text-xs font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
              {money(view.totals.currentYearEarnings, isAr)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label={isAr ? 'بحث في الميزانية العمومية' : 'Search balance sheet'}
              placeholder={isAr ? 'بحث برمز أو اسم الحساب...' : 'Search code or account...'}
              className="h-8 rounded-xl border border-slate-200 bg-slate-50 ps-8 pe-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
              >
                {isAr ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
              </button>
              <span dir="ltr" className="px-2 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40 dark:bg-white/10"
              >
                {isAr ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="whitespace-nowrap px-3 py-2 text-start font-bold">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="whitespace-nowrap px-3 py-2 text-start font-bold">{isAr ? 'التصنيف' : 'Section'}</th>
                <th className="whitespace-nowrap px-3 py-2 text-end font-bold">{isAr ? 'الرصيد' : 'Balance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {pagedRows.map((row) => (
                <tr key={row.code} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <span dir="ltr" className="font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {row.code}
                    </span>{' '}
                    <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                    {row.groupLabel}
                  </td>
                  <td dir="ltr" className="whitespace-nowrap px-3 py-2 text-end font-semibold tabular-nums text-slate-900 dark:text-white">
                    {money(row.presented, isAr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}
