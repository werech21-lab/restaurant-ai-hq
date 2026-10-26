'use client'

import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import {
  effectiveStatus,
  utcDate,
  type ActivityEntry,
  type CustomerStatus,
  type LeadStage,
  type QuotationStatus,
  type TeamMember,
} from '@/modules/crm/client'

export const stageLabels: Record<LeadStage, MessageKey> = {
  new: 'crm.stage.new',
  contacted: 'crm.stage.contacted',
  qualified: 'crm.stage.qualified',
  proposal: 'crm.stage.proposal',
  won: 'crm.stage.won',
  lost: 'crm.stage.lost',
}

export const customerStatusLabels: Record<CustomerStatus, MessageKey> = {
  lead: 'crm.cstatus.lead',
  prospect: 'crm.cstatus.prospect',
  active: 'crm.cstatus.active',
  blocked: 'crm.cstatus.blocked',
}

export const quotationStatusLabels: Record<QuotationStatus, MessageKey> = {
  draft: 'crm.qstatus.draft',
  sent: 'crm.qstatus.sent',
  accepted: 'crm.qstatus.accepted',
  rejected: 'crm.qstatus.rejected',
  expired: 'crm.qstatus.expired',
  converted: 'crm.qstatus.converted',
}

const customerTones: Record<CustomerStatus, 'neutral' | 'info' | 'good' | 'bad'> = {
  lead: 'neutral',
  prospect: 'info',
  active: 'good',
  blocked: 'bad',
}

const quotationTones: Record<QuotationStatus, 'neutral' | 'info' | 'good' | 'bad' | 'warn' | 'gold'> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'good',
  rejected: 'bad',
  expired: 'warn',
  converted: 'gold',
}

const activityLabels: Record<string, MessageKey> = {
  'quotation:created': 'crm.act.quotation.created',
  'quotation:sent': 'crm.act.quotation.sent',
  'quotation:accepted': 'crm.act.quotation.accepted',
  'quotation:rejected': 'crm.act.quotation.rejected',
  'quotation:expired': 'crm.act.quotation.expired',
  'quotation:converted': 'crm.act.quotation.converted',
  'lead:created': 'crm.act.lead.created',
  'lead:won': 'crm.act.lead.won',
  'lead:lost': 'crm.act.lead.lost',
  'invoice:created': 'crm.act.invoice.created',
  'invoice:voided': 'crm.act.invoice.voided',
  'payment:recorded': 'crm.act.payment.recorded',
}

export function activityLabel(entry: Pick<ActivityEntry, 'kind' | 'action'>): MessageKey | null {
  return activityLabels[`${entry.kind}:${entry.action}`] ?? null
}

/** Today in UTC, the same day the server uses for validity and due dates. */
export function todayUtc(): string {
  return utcDate(new Date())
}

/** Integer fils as a KWD string, or a dash when the number is outside the safe range. */
export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return '—'
  }
}

export function memberName(team: readonly TeamMember[], userId: string | null): string | null {
  if (!userId) return null
  const member = team.find((candidate) => candidate.userId === userId)
  if (!member) return userId.slice(0, 8)
  return member.displayName.trim() === '' ? member.userId.slice(0, 8) : member.displayName
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const { t } = useI18n()
  return <Badge tone={customerTones[status]}>{t(customerStatusLabels[status])}</Badge>
}

/** Shows `expired` for a sent quotation past its date, because nothing flips it on its own. */
export function QuotationStatusBadge({ quotation }: { quotation: { status: QuotationStatus; validUntil: string } }) {
  const { t } = useI18n()
  const shown = effectiveStatus(quotation, todayUtc())
  return <Badge tone={quotationTones[shown]}>{t(quotationStatusLabels[shown])}</Badge>
}

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const { t } = useI18n()
  const tone = stage === 'won' ? 'good' : stage === 'lost' ? 'bad' : 'info'
  return <Badge tone={tone}>{t(stageLabels[stage])}</Badge>
}