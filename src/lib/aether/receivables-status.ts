/**
 * Phase 5 · Item 2 — executive receivables status policy.
 *
 * Executives must never see a signed net (e.g. `-77K`) or a multi-million ledger balance presented
 * as "Overdue". Until true per-customer due-date aging is built and verified against Odoo 17
 * (`account.move.line.date_maturity` grouped by `partner_id`), every executive surface renders a
 * calm neutral status instead of an amount:
 *
 *   EN: "Pending Accounting Reconciliation"   AR: "قيد المطابقة مع المحاسبة"
 *
 * Flip `PER_CUSTOMER_DUE_DATE_AGING_VERIFIED` to `true` only after finance signs off the
 * per-customer aging reconciliation. Ledger facts (unreconciled line counts) remain visible.
 */

export const PER_CUSTOMER_DUE_DATE_AGING_VERIFIED = false as const

export const RECEIVABLES_PENDING_STATUS = {
  en: 'Pending Accounting Reconciliation',
  ar: 'قيد المطابقة مع المحاسبة',
} as const

export const RECEIVABLES_PENDING_DETAIL = {
  en: 'Amounts are withheld until per-customer due-date aging is reconciled with Accounting in Odoo.',
  ar: 'تُحجب المبالغ إلى حين مطابقة أعمار الذمم لكل عميل حسب تاريخ الاستحقاق مع قسم المحاسبة في أودو.',
} as const

export type ReceivablesExecutiveStatus = 'unavailable' | 'pending-reconciliation' | 'verified'

export function resolveReceivablesExecutiveStatus(
  receivables: { unavailable?: boolean | null } | null | undefined,
  verified: boolean = PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
): ReceivablesExecutiveStatus {
  if (!receivables || receivables.unavailable === true) return 'unavailable'
  return verified ? 'verified' : 'pending-reconciliation'
}

/** True when amounts / aging buckets may be shown to executives. */
export function canShowReceivableAmounts(
  receivables: { unavailable?: boolean | null } | null | undefined,
  verified: boolean = PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
): boolean {
  return resolveReceivablesExecutiveStatus(receivables, verified) === 'verified'
}
