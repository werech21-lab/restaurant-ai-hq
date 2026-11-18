'use client'

import { useEffect, useState } from 'react'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'
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
      <StatementTable
        title={isAr ? 'ميزان المراجعة' : 'Trial balance'}
        lines={payload.trialBalance.lines}
        empty={note}
        isAr={isAr}
      />
      <StatementTable
        title={isAr ? 'الميزانية العمومية' : 'Balance sheet'}
        lines={payload.balanceSheet.lines}
        empty={payload.balanceSheet.unavailableSections.length > 0 ? note : note}
        isAr={isAr}
      />
    </section>
  )
}

function StatementTable({
  title,
  lines,
  empty,
  isAr,
}: {
  title: string
  lines: GlAccountLine[]
  empty: string
  isAr: boolean
}) {
  if (lines.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">{empty}</p>
      </div>
    )
  }
  const shown = lines.slice(0, 200)
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <table className="w-full text-xs">
        <tbody>
          {shown.map((line) => (
            <tr key={`${title}-${line.code}`}>
              <td className="py-1 pe-2 font-mono" dir="ltr">{line.code}</td>
              <td className="py-1 pe-2">{line.name}</td>
              <td className="py-1 text-end tabular-nums" dir="ltr">
                {formatKwd(line.balance, isAr ? 'ar' : 'en')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
