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
      className={`inline-flex max-w-full flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-300/70 bg-white/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] backdrop-blur-md ring-1 ring-amber-400/20 dark:border-slate-500/25 dark:bg-[rgba(15,26,48,0.78)] dark:text-slate-200 dark:ring-amber-400/20 ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600/80 dark:text-amber-300/80" aria-hidden />
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2">{action}</div>
    </div>
  )
}
