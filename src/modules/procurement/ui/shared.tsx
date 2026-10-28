'use client'

import { errorClass, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Failure } from '@/components/erp/actions'
import type { OrderStatus, RequestStatus, SupplierInvoiceStatus, SupplierStatus } from '@/modules/procurement/client'

export { dateTimeText, Modal, useDebounced, type ListPage, type Phase } from '@/components/erp/common'
export { Fact, Field, minorText, todayUtc, useIdempotencyKey, useRunner, type Failure } from '@/components/erp/actions'

type Tone = 'neutral' | 'info' | 'good' | 'bad' | 'warn' | 'gold'

export const requestStatusLabels: Record<RequestStatus, MessageKey> = {
  draft: 'pro.rstatus.draft',
  submitted: 'pro.rstatus.submitted',
  approved: 'pro.rstatus.approved',
  rejected: 'pro.rstatus.rejected',
  converted: 'pro.rstatus.converted',
  cancelled: 'pro.rstatus.cancelled',
}

const requestTones: Record<RequestStatus, Tone> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'good',
  rejected: 'bad',
  converted: 'gold',
  cancelled: 'neutral',
}

export const orderStatusLabels: Record<OrderStatus, MessageKey> = {
  draft: 'pro.ostatus.draft',
  pending_approval: 'pro.ostatus.pending_approval',
  approved: 'pro.ostatus.approved',
  partially_received: 'pro.ostatus.partially_received',
  received: 'pro.ostatus.received',
  cancelled: 'pro.ostatus.cancelled',
}

const orderTones: Record<OrderStatus, Tone> = {
  draft: 'neutral',
  pending_approval: 'warn',
  approved: 'info',
  partially_received: 'warn',
  received: 'good',
  cancelled: 'neutral',
}

export const invoiceStatusLabels: Record<SupplierInvoiceStatus, MessageKey> = {
  posted: 'pro.istatus.posted',
  void: 'pro.istatus.void',
}

export const supplierStatusLabels: Record<SupplierStatus, MessageKey> = {
  active: 'pro.sstatus.active',
  blocked: 'pro.sstatus.blocked',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useI18n()
  return <Badge tone={requestTones[status]}>{t(requestStatusLabels[status])}</Badge>
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n()
  return <Badge tone={orderTones[status]}>{t(orderStatusLabels[status])}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: SupplierInvoiceStatus }) {
  const { t } = useI18n()
  return <Badge tone={status === 'posted' ? 'good' : 'neutral'}>{t(invoiceStatusLabels[status])}</Badge>
}

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const { t } = useI18n()
  return <Badge tone={status === 'active' ? 'good' : 'bad'}>{t(supplierStatusLabels[status])}</Badge>
}

export function FailureMessage({ failure, onReload }: { failure: Failure | null; onReload?: () => void }) {
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
          {t('pro.reload')}
        </button>
      ) : null}
    </div>
  )
}
