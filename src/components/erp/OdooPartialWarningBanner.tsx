'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const DEFAULT_PARTIAL_WARNING_AR = 'بعض الأرقام غير متاحة الآن'
export const DEFAULT_PARTIAL_WARNING_EN = 'Some figures are temporarily unavailable'

export function OdooPartialWarningBanner({
  summary,
  isAr,
  className = '',
}: {
  summary?: Pick<
    OdooLiveSummary,
    'partial' | 'unavailableSections' | 'warningAr' | 'warningEn'
  > | null
  isAr: boolean
  className?: string
}) {
  if (!summary || summary.partial !== true) return null

  const text = isAr
    ? summary.warningAr || DEFAULT_PARTIAL_WARNING_AR
    : summary.warningEn || DEFAULT_PARTIAL_WARNING_EN

  return (
    <div
      role="alert"
      data-odoo-partial-warning="true"
      className={`ae-bento-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-300/75 bg-amber-50/95 px-4 py-3 text-[13px] font-semibold text-amber-950 ring-1 ring-amber-500/20 dark:border-amber-500/35 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-400/20 ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span>{text}</span>
      </div>
    </div>
  )
}
