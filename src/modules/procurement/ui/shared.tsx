'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ApiError, errorDetail, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { errorClass, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { OrderStatus, RequestStatus, SupplierInvoiceStatus, SupplierStatus } from '@/modules/procurement/client'

export { dateTimeText, Modal, useDebounced, type ListPage, type Phase } from '@/components/erp/common'

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

/** Today in UTC, the day the server uses for dates it checks. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Integer fils as a KWD string, or a dash when the number is outside the safe range. */
export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return '—'
  }
}

export type Failure = { key: MessageKey; detail: string | null; conflict: boolean }

/** A key that stays the same while a lost response may still be replayed, and changes once the server gave a final answer. */
export function useIdempotencyKey() {
  const ref = useRef(newIdempotencyKey())
  const reset = useCallback(() => {
    ref.current = newIdempotencyKey()
  }, [])
  return { ref, reset }
}

/**
 * Runs one user action at a time and keeps its pending and failure state. Pass the key of a create so that it is renewed
 * after a final answer and kept after an unknown outcome (network or server failure), which makes the retry replay.
 */
export function useRunner() {
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const run = useCallback(async (task: () => Promise<void>, key?: { reset: () => void }) => {
    setFailure(null)
    setPending(true)
    try {
      await task()
    } catch (error) {
      if (key && !(error instanceof ApiError && (error.status === 0 || error.status >= 500))) key.reset()
      setFailure({
        key: errorKey(error),
        detail: errorDetail(error),
        conflict: error instanceof ApiError && error.code === 'version_conflict',
      })
    } finally {
      setPending(false)
    }
  }, [])

  const clear = useCallback(() => setFailure(null), [])
  return { pending, failure, run, clear }
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

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm text-gray-400 ${className}`}>
      {label}
      {children}
    </label>
  )
}

/** The readable rows of a document header: label above value. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <div className="mt-1 text-sm text-gray-100">{children}</div>
    </div>
  )
}
