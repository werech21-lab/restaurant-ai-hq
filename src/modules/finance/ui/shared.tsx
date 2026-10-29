'use client'

import { errorClass, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { AccountType, EntryStatus, JournalSourceType, PeriodStatus } from '@/modules/finance/client'
import type { Failure } from '@/components/erp/actions'

/**
 * The labels and small pieces the ledger screens share. Tables, paging and form actions come from `@/components/erp`,
 * which every module screen uses, so finance does not depend on the procurement screens.
 */

export const accountTypeLabels: Record<AccountType, MessageKey> = {
  asset: 'led.type.asset',
  liability: 'led.type.liability',
  equity: 'led.type.equity',
  revenue: 'led.type.revenue',
  expense: 'led.type.expense',
}

export const entryStatusLabels: Record<EntryStatus, MessageKey> = {
  draft: 'led.estatus.draft',
  posted: 'led.estatus.posted',
}

export const periodStatusLabels: Record<PeriodStatus, MessageKey> = {
  open: 'led.pstatus.open',
  closed: 'led.pstatus.closed',
}

export const sourceTypeLabels: Record<JournalSourceType, MessageKey> = {
  manual: 'led.src.manual',
  reversal: 'led.src.reversal',
  supplier_invoice: 'led.src.supplier_invoice',
  goods_receipt: 'led.src.goods_receipt',
  purchase_return: 'led.src.purchase_return',
  supplier_credit_note: 'led.src.supplier_credit_note',
  supplier_payment: 'led.src.supplier_payment',
  sales_cogs: 'led.src.sales_cogs',
  customer_collection: 'led.src.customer_collection',
  kitchen_issue: 'led.src.kitchen_issue',
  delivery_commission: 'led.src.delivery_commission',
  sales_revenue: 'led.src.sales_revenue',
  payroll: 'led.src.payroll',
  employee_expense: 'led.src.employee_expense',
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const { t } = useI18n()
  return <Badge tone={status === 'posted' ? 'good' : 'neutral'}>{t(entryStatusLabels[status])}</Badge>
}

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  const { t } = useI18n()
  return <Badge tone={status === 'open' ? 'info' : 'neutral'}>{t(periodStatusLabels[status])}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n()
  return <Badge tone={active ? 'good' : 'bad'}>{t(active ? 'led.status.active' : 'led.status.inactive')}</Badge>
}

/** A failed request, with the server's own detail when it has one and a reload when another user won the version race. */
export function LedgerFailure({ failure, onReload }: { failure: Failure | null; onReload?: () => void }) {
  const { t } = useI18n()
  if (!failure) return null
  return (
    <div role="alert" className={errorClass}>
      <p>{t(failure.key)}</p>
      {failure.detail ? (
        <p className="mt-1 text-xs opacity-80" dir="auto">
          {failure.detail}
        </p>
      ) : null}
      {failure.conflict && onReload ? (
        <button type="button" onClick={onReload} className={`${secondaryButton} mt-2`}>
          {t('led.reload')}
        </button>
      ) : null}
    </div>
  )
}

/** The problems the screen found in the form itself, before any request went out. */
export function FormIssues({ issues }: { issues: readonly MessageKey[] }) {
  const { t } = useI18n()
  if (issues.length === 0) return null
  return (
    <ul role="alert" className={`${errorClass} list-disc space-y-1 ps-6`}>
      {issues.map((issue) => (
        <li key={issue}>{t(issue)}</li>
      ))}
    </ul>
  )
}
