'use client'

import { Badge, Money } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { ActionType, ApprovalStatus, InsightCategory, InsightSeverity, InsightStatus, ResultRef } from '@/modules/ai/client'

export const severityLabels: Record<InsightSeverity, MessageKey> = {
  critical: 'ai.sev.critical',
  warning: 'ai.sev.warning',
  opportunity: 'ai.sev.opportunity',
}

export const categoryLabels: Record<InsightCategory, MessageKey> = {
  finance: 'ai.cat.finance',
  inventory: 'ai.cat.inventory',
  crm: 'ai.cat.crm',
}

export const insightStatusLabels: Record<InsightStatus, MessageKey> = {
  open: 'ai.ist.open',
  acknowledged: 'ai.ist.acknowledged',
  resolved: 'ai.ist.resolved',
}

export const actionLabels: Record<ActionType, MessageKey> = {
  auto_reorder: 'ai.action.auto_reorder',
  credit_hold: 'ai.action.credit_hold',
  discount_approval: 'ai.action.discount_approval',
  price_adjustment: 'ai.action.price_adjustment',
  payment_reminder: 'ai.action.payment_reminder',
  lead_followup: 'ai.action.lead_followup',
  scenario_choice: 'ai.action.scenario_choice',
}

export const approvalStatusLabels: Record<ApprovalStatus, MessageKey> = {
  pending: 'ai.dec.status.pending',
  approved: 'ai.dec.status.approved',
  rejected: 'ai.dec.status.rejected',
  executed: 'ai.dec.status.executed',
}

export const refLabels: Record<ResultRef['type'], MessageKey> = {
  stock_movement: 'ai.ref.stock_movement',
  item: 'ai.ref.item',
  customer: 'ai.ref.customer',
  quotation: 'ai.ref.quotation',
  lead: 'ai.ref.lead',
}

const severityTones: Record<InsightSeverity, 'bad' | 'warn' | 'good'> = {
  critical: 'bad',
  warning: 'warn',
  opportunity: 'good',
}

export const severityDot: Record<InsightSeverity, string> = {
  critical: 'bg-rose-400',
  warning: 'bg-amber-300',
  opportunity: 'bg-emerald-400',
}

const approvalTones: Record<ApprovalStatus, 'warn' | 'info' | 'bad' | 'good'> = {
  pending: 'warn',
  approved: 'info',
  rejected: 'bad',
  executed: 'good',
}

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const { t } = useI18n()
  return <Badge tone={severityTones[severity]}>{t(severityLabels[severity])}</Badge>
}

export function CategoryBadge({ category }: { category: InsightCategory }) {
  const { t } = useI18n()
  return <Badge tone="neutral">{t(categoryLabels[category])}</Badge>
}

export function ActionBadge({ type }: { type: ActionType }) {
  const { t } = useI18n()
  return <Badge tone="info">{t(actionLabels[type])}</Badge>
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { t } = useI18n()
  return <Badge tone={approvalTones[status]}>{t(approvalStatusLabels[status])}</Badge>
}

/** Integer fils as a KWD string, or a dash when the number is outside the safe range. */
export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return '—'
  }
}

/** A signed amount in KWD. Gains are green with a plus, spending is red. Zero stays neutral. */
export function Impact({ minor }: { minor: number }) {
  const tone = minor > 0 ? 'text-emerald-400' : minor < 0 ? 'text-rose-400' : 'text-mist-300'
  const sign = minor > 0 ? '+' : ''
  return <Money value={`${sign}${minorText(minor)}`} className={`font-semibold ${tone}`} />
}

/** Where a record opens in the ERP. Only ids the server produced are used, and the pages check them again. */
export function recordHref(type: 'item' | 'customer' | 'lead' | 'invoice' | 'quotation' | 'stock_movement', id: string): string {
  switch (type) {
    case 'item':
      return `/erp/inventory?item=${encodeURIComponent(id)}`
    case 'customer':
      return `/erp/crm?customer=${encodeURIComponent(id)}`
    case 'invoice':
      return `/erp/finance?invoice=${encodeURIComponent(id)}`
    case 'stock_movement':
      return '/erp/inventory'
    case 'lead':
    case 'quotation':
      return '/erp/crm'
  }
}
