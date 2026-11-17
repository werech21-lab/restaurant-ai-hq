import React, { type HTMLAttributes } from 'react'
import { BadgeInfo } from 'lucide-react'
import type { FormatLocale } from '@/lib/format'
import { cx } from './cx'

export const DEFAULT_UNAVAILABLE_REASON_AR = 'غير متاح بعد — لم تُرحّل قيود الدفتر العام'
export const DEFAULT_UNAVAILABLE_REASON_EN = 'Not available yet — GL entries not posted'

export interface UnavailableStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  reason?: string
  isAr?: boolean
  locale?: FormatLocale
  compact?: boolean
  className?: string
  'data-unavailable'?: 'true'
}

/**
 * Shared single-line muted slate status surface for unposted or pending metrics.
 * Uses `BadgeInfo` (path-only SVG, zero `<circle>`) so unavailable KPI cards
 * never emit hollow ring SVG circles.
 */
export function UnavailableState({
  reason,
  isAr,
  locale,
  compact = false,
  className = '',
  'data-unavailable': dataUnavailable = 'true',
  dir,
  ...rest
}: UnavailableStateProps) {
  const resolvedIsAr = isAr ?? (locale ? locale !== 'en' : true)
  const resolvedDir = dir ?? (resolvedIsAr ? 'rtl' : 'ltr')
  const resolvedReason =
    reason && reason.trim().length > 0
      ? reason
      : resolvedIsAr
        ? DEFAULT_UNAVAILABLE_REASON_AR
        : DEFAULT_UNAVAILABLE_REASON_EN

  return (
    <div
      role="status"
      dir={resolvedDir}
      data-unavailable={dataUnavailable}
      data-unavailable-state="true"
      className={cx(
        'inline-flex max-w-full items-center gap-2 border border-slate-300/70 bg-slate-100/80 text-slate-600 dark:border-slate-500/25 dark:bg-slate-800/45 dark:text-slate-300',
        compact
          ? 'rounded-xl px-2.5 py-1.5 text-xs font-medium'
          : 'rounded-2xl px-3.5 py-2 text-[13px] font-medium',
        className,
      )}
      {...rest}
    >
      <BadgeInfo
        className={cx(
          'shrink-0 text-slate-500 dark:text-slate-400',
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
        )}
        aria-hidden="true"
      />
      <span className="leading-snug">{resolvedReason}</span>
    </div>
  )
}
