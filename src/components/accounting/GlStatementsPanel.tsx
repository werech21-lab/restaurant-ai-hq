'use client'

import { useEffect, useState } from 'react'
import {
  balanceSheetView,
  trialBalanceTotals,
  type GlAccountLine,
} from '@/lib/odoo/gl-statements'
import { formatKwd } from '@/lib/format'

interface StatementPayload {
  from: string
  to: string
  budgetReadable: boolean
  trialBalance: { lines: GlAccountLine[]; unavailableSections: string[] }
  balanceSheet: { lines: GlAccountLine[]; unavailableSections: string[] }
}

const INCOMPLETE_AR = 'قيود غير مكتملة لهذه الفترة'
const INCOMPLETE_EN = 'Incomplete GL entries for this period'

export function accountsForPnlGroup(
  lines: readonly GlAccountLine[],
  group: string,
  commissionCodes: readonly string[],
): GlAccountLine[] {
  const commission = new Set(commissionCodes)
  return lines.filter((line) => {
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

  if (failed || (payload && payload.trialBalance.unavailableSections.length > 0 && payload.trialBalance.lines.length === 0)) {
    return <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{isAr ? INCOMPLETE_AR : INCOMPLETE_EN}</p>
  }
  if (!payload) {
    return <p className="text-sm text-slate-500">{isAr ? 'جارٍ قراءة دفتر الأستاذ…' : 'Reading the general ledger…'}</p>
  }

  const note = isAr ? INCOMPLETE_AR : INCOMPLETE_EN
  return (
    <section className="space-y-3" data-gl-statements="true">
      <p className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
        {payload.from} → {payload.to}
      </p>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {payload.budgetReadable
          ? isAr
            ? 'crossovered.budget قابل للقراءة'
            : 'crossovered.budget is readable'
          : isAr
            ? 'crossovered.budget غير قابل للقراءة'
            : 'crossovered.budget is not readable'}
      </p>
      <TrialBalanceTable lines={payload.trialBalance.lines} empty={note} isAr={isAr} />
      <BalanceSheetTable lines={payload.balanceSheet.lines} empty={note} isAr={isAr} />
    </section>
  )
}

function money(value: number, isAr: boolean): string {
  return formatKwd(value, isAr ? 'ar' : 'en')
}

function TrialBalanceTable({
  lines,
  empty,
  isAr,
}: {
  lines: GlAccountLine[]
  empty: string
  isAr: boolean
}) {
  if (lines.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold">{isAr ? 'ميزان المراجعة' : 'Trial balance'}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">{empty}</p>
      </div>
    )
  }
  const totals = trialBalanceTotals(lines)
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-1 text-sm font-semibold">{isAr ? 'ميزان المراجعة' : 'Trial balance'}</h3>
      <p className="mb-1 text-xs text-slate-500">{isAr ? `عرض ${lines.length} من ${lines.length}` : `showing ${lines.length} of ${lines.length}`}</p>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="py-1 text-start">{isAr ? 'الحساب' : 'Account'}</th>
            <th className="py-1 text-end">{isAr ? 'مدين' : 'Debit'}</th>
            <th className="py-1 text-end">{isAr ? 'دائن' : 'Credit'}</th>
            <th className="py-1 text-end">{isAr ? 'الرصيد' : 'Balance'}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.code}>
              <td className="py-1 pe-2"><span className="font-mono" dir="ltr">{line.code}</span> {line.name}</td>
              <td className="py-1 text-end tabular-nums" dir="ltr">{money(line.debit, isAr)}</td>
              <td className="py-1 text-end tabular-nums" dir="ltr">{money(line.credit, isAr)}</td>
              <td className="py-1 text-end tabular-nums" dir="ltr">{money(line.balance, isAr)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 font-semibold">{isAr ? 'المجموع' : 'Total'}</td>
            <td className="py-1 text-end font-semibold tabular-nums" dir="ltr">{money(totals.debit, isAr)}</td>
            <td className="py-1 text-end font-semibold tabular-nums" dir="ltr">{money(totals.credit, isAr)}</td>
            <td className="py-1 text-end font-semibold tabular-nums" dir="ltr">{money(totals.balance, isAr)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function BalanceSheetTable({
  lines,
  empty,
  isAr,
}: {
  lines: GlAccountLine[]
  empty: string
  isAr: boolean
}) {
  const view = balanceSheetView(lines)
  const accountCount = view.groups.reduce((sum, group) => sum + group.lines.length, 0)
  if (accountCount === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold">{isAr ? 'الميزانية العمومية' : 'Balance sheet'}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">{empty}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto" data-balance-sheet="true">
      <h3 className="mb-1 text-sm font-semibold">{isAr ? 'الميزانية العمومية' : 'Balance sheet'}</h3>
      <p className="mb-1 text-xs text-slate-500">{isAr ? `عرض ${accountCount} من ${accountCount}` : `showing ${accountCount} of ${accountCount}`}</p>
      {view.groups.filter((group) => group.key !== 'excluded' || group.lines.length > 0).map((group) => (
        <div key={group.key} className="mb-2">
          <p className="text-xs font-semibold">{isAr ? group.labelAr : group.labelEn}</p>
          {group.lines.map((line) => (
            <p key={line.code} className="flex justify-between gap-2 text-xs">
              <span><span className="font-mono" dir="ltr">{line.code}</span> {line.name}</span>
              <span dir="ltr" className="tabular-nums">{money(line.presented, isAr)}</span>
            </p>
          ))}
          <p className="flex justify-between gap-2 text-xs font-semibold">
            <span>{isAr ? 'المجموع' : 'Total'}</span>
            <span dir="ltr" className="tabular-nums">{money(group.total, isAr)}</span>
          </p>
        </div>
      ))}
      <p className="flex justify-between gap-2 text-xs">
        <span>{isAr ? view.currentEarningsLabelAr : view.currentEarningsLabelEn}</span>
        <span dir="ltr" className="tabular-nums">{money(view.totals.currentYearEarnings, isAr)}</span>
      </p>
      {view.balanced ? (
        <p className="mt-1 text-xs font-semibold tabular-nums" dir="ltr" data-balance-check="ok">
          {`A ${money(view.totals.assets, isAr)} = L ${money(view.totals.liabilities, isAr)} + E ${money(view.totals.equity, isAr)}`}
        </p>
      ) : (
        <p className="mt-1 text-xs font-semibold" data-balance-check="off">{empty}</p>
      )}
    </div>
  )
}
