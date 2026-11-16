'use client'

import { useEffect, type ReactNode } from 'react'
import { useRunner, type Failure } from '@/components/erp/actions'
import { Badge } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatKwd,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type {
  OrderStatus,
  RequestStatus,
  SupplierInvoiceStatus,
  SupplierStatus,
} from '@/modules/procurement/client'

export { useDebounced, type ListPage, type Phase } from '@/components/erp/common'
export { todayUtc, useIdempotencyKey, useRunner, type Failure } from '@/components/erp/actions'

export const proPanelClass = 'ds-surface rounded-2xl p-4 sm:p-5'
export const proSubtleClass = 'ds-surface-subtle rounded-xl p-4'
export const proInputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#0D1512] dark:text-slate-100'
export const proLabelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300'
export const proPrimaryButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export const proSecondaryButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300/90 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]'
export const proDangerButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-rose-500/40 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70'
export const proErrorClass =
  'rounded-xl border border-rose-500/35 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
export const proNoticeClass =
  'rounded-xl border border-emerald-500/35 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'

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
  return (
    <Badge tone={status === 'posted' ? 'good' : 'neutral'}>
      {t(invoiceStatusLabels[status])}
    </Badge>
  )
}

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const { t } = useI18n()
  return (
    <Badge tone={status === 'active' ? 'good' : 'bad'}>
      {t(supplierStatusLabels[status])}
    </Badge>
  )
}

export function dateTimeText(iso: string, locale: FormatLocale = 'ar'): string {
  return formatDateTime(iso, { locale })
}

export function minorText(amountMinor: number): string {
  try {
    return formatMinor(amountMinor)
  } catch {
    return UNAVAILABLE_DASH
  }
}

export function formatMinorKwd(
  amountMinor: number | null | undefined,
  locale: FormatLocale = 'ar',
): string {
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor)) {
    return UNAVAILABLE_DASH
  }
  return formatKwd(amountMinor / 1000, { locale })
}

const modalWidths = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof modalWidths
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`ds-surface-elevated my-8 w-full ${modalWidths[size]} rounded-2xl p-5`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="ds-focus-ring inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-xl leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`${proLabelClass} ${className}`.trim()}>
      {label}
      {children}
    </label>
  )
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  )
}

export function FailureMessage({
  failure,
  onReload,
}: {
  failure: Failure | null
  onReload?: () => void
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  if (!failure) return null
  return (
    <StateBlock
      state={failure.key === 'erp.err.forbidden' ? 'forbidden' : 'error'}
      compact
      locale={fmtLocale}
      title={t(failure.key)}
      description={failure.detail ?? undefined}
      onRetry={failure.conflict && onReload ? onReload : undefined}
      retryLabel={t('pro.reload')}
    />
  )
}

export { useRunner as useProcurementRunner }
