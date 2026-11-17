'use client'

import React from 'react'
import { Info } from 'lucide-react'
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
      className={`ae-bento-card flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-700 ring-1 ring-slate-900/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/5 ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <span>{text}</span>
      </div>
    </div>
  )
}
