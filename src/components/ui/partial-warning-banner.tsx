'use client'

import React, { type ReactNode } from 'react'
import { Info } from 'lucide-react'
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
      className={`ae-bento-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-700 ring-1 ring-slate-900/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/5 ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </div>
  )
}
