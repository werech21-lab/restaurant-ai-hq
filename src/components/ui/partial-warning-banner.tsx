'use client'

import React, { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  DEFAULT_PARTIAL_WARNING_AR,
  DEFAULT_PARTIAL_WARNING_EN,
  OdooPartialWarningBanner,
} from '@/components/erp/OdooPartialWarningBanner'
import type { FormatLocale } from '@/lib/format'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export {
  DEFAULT_PARTIAL_WARNING_AR,
  DEFAULT_PARTIAL_WARNING_EN,
  OdooPartialWarningBanner,
}

export interface PartialWarningBannerProps {
  /** Live Odoo summary object (when provided, delegates directly to `OdooPartialWarningBanner`). */
  summary?: Pick<
    OdooLiveSummary,
    'partial' | 'unavailableSections' | 'warningAr' | 'warningEn'
  > | null
  /** Explicit partial visibility override when rendering without a full `OdooLiveSummary`. */
  partial?: boolean
  unavailableSections?: string[]
  warningAr?: string | null
  warningEn?: string | null
  locale?: FormatLocale
  isAr?: boolean
  className?: string
  action?: ReactNode
}

/**
 * Canonical partial-data warning banner wrapping `OdooPartialWarningBanner`.
 * Always preserves `role="alert"` and `data-odoo-partial-warning="true"`.
 */
export function PartialWarningBanner({
  summary,
  partial,
  unavailableSections,
  warningAr,
  warningEn,
  locale,
  isAr,
  className = '',
  action,
}: PartialWarningBannerProps) {
  const resolvedIsAr = isAr ?? (locale ? locale !== 'en' : true)

  const shouldShow =
    partial !== undefined
      ? partial
      : summary
        ? summary.partial === true
        : Boolean(
            (warningAr && warningAr.trim()) ||
              (warningEn && warningEn.trim()) ||
              (unavailableSections && unavailableSections.length > 0),
          )

  if (!shouldShow) return null

  const mergedWarningAr = warningAr ?? summary?.warningAr ?? DEFAULT_PARTIAL_WARNING_AR
  const mergedWarningEn = warningEn ?? summary?.warningEn ?? DEFAULT_PARTIAL_WARNING_EN
  const mergedSections = unavailableSections ?? summary?.unavailableSections ?? []

  if (!action) {
    return (
      <OdooPartialWarningBanner
        summary={{
          partial: true,
          unavailableSections: mergedSections,
          warningAr: mergedWarningAr,
          warningEn: mergedWarningEn,
        }}
        isAr={resolvedIsAr}
        className={className}
      />
    )
  }

  const text = resolvedIsAr ? mergedWarningAr : mergedWarningEn

  return (
    <div
      role="alert"
      data-odoo-partial-warning="true"
      dir={resolvedIsAr ? 'rtl' : 'ltr'}
      className={`ae-bento-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-300/75 bg-amber-50/95 px-4 py-3 text-[13px] font-semibold text-amber-950 ring-1 ring-amber-500/20 dark:border-amber-500/35 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-400/20 ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </div>
  )
}
