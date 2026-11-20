'use client'

import type { ReactNode } from 'react'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type {
  ActionType,
  ApprovalStatus,
  InsightCategory,
  InsightSeverity,
  InsightStatus,
  ResultRef,
} from '@/modules/ai/client'

export const aiPanelClass = 'ds-surface w-full min-w-0 rounded-2xl p-4 sm:p-5'
export const aiCardClass =
  'min-w-0 rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-4 shadow-xs'
export const aiSubcardClass =
  'min-w-0 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3'
export const aiInputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60'
export const aiLabelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
export const aiPrimaryBtn =
  'ds-focus-ring inline-flex min-h-10 shrink-0 whitespace-nowrap cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
export const aiSecondaryBtn =
  'ds-focus-ring inline-flex min-h-10 shrink-0 whitespace-nowrap cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
export const aiDangerBtn =
  'ds-focus-ring inline-flex min-h-10 shrink-0 whitespace-nowrap cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-4 py-2 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const aiErrorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'
export const aiNoticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'

type PillTone = 'neutral' | 'info' | 'good' | 'bad' | 'warn'

const PILL_TONES: Record<PillTone, string> = {
  neutral:
    'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200',
  info:
    'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/50 dark:text-sky-200',
  good:
    'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200',
  bad:
    'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/50 dark:text-rose-200',
  warn:
    'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/50 dark:text-amber-200',
}

export function AiPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

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
  critical: 'bg-rose-500 dark:bg-rose-400',
  warning: 'bg-amber-500 dark:bg-amber-300',
  opportunity: 'bg-emerald-500 dark:bg-emerald-400',
}

const approvalTones: Record<ApprovalStatus, 'warn' | 'info' | 'bad' | 'good'> = {
  pending: 'warn',
  approved: 'info',
  rejected: 'bad',
  executed: 'good',
}

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const { t } = useI18n()
  return <AiPill tone={severityTones[severity]}>{t(severityLabels[severity])}</AiPill>
}

export function CategoryBadge({ category }: { category: InsightCategory }) {
  const { t } = useI18n()
  return <AiPill tone="neutral">{t(categoryLabels[category])}</AiPill>
}

export function ActionBadge({ type }: { type: ActionType }) {
  const { t } = useI18n()
  return <AiPill tone="info">{t(actionLabels[type])}</AiPill>
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { t } = useI18n()
  return <AiPill tone={approvalTones[status]}>{t(approvalStatusLabels[status])}</AiPill>
}

export function formatAiDateTime(iso: string | null | undefined, locale: FormatLocale): string {
  return formatDateTime(iso, { locale })
}

export function AiUnavailableDash({ locale }: { locale: FormatLocale }) {
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export function AiMoney({
  minor,
  signed = false,
  className = '',
}: {
  minor: number | null | undefined
  signed?: boolean
  className?: string
}) {
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
    return <AiUnavailableDash locale={fmtLocale} />
  }
  return (
    <span dir="ltr" className={`ds-num inline-block whitespace-nowrap tabular-nums ${className}`}>
      {formatKwd(minor / 1000, { locale: fmtLocale, signed })}
    </span>
  )
}

/** A signed amount in KWD. Gains are emerald with a plus, spending is rose. Zero stays neutral. */
export function Impact({ minor }: { minor: number }) {
  const tone =
    minor > 0
      ? 'text-[var(--ds-positive)]'
      : minor < 0
        ? 'text-[var(--ds-negative)]'
        : 'text-[var(--ds-text-secondary)]'
  return <AiMoney minor={minor} signed className={`font-semibold ${tone}`} />
}

/** Where a record opens in the ERP. Only ids the server produced are used, and the pages check them again. */
export function recordHref(
  type: 'item' | 'customer' | 'lead' | 'invoice' | 'quotation' | 'stock_movement',
  id: string,
): string {
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
