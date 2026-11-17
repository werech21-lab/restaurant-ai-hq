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
      dir={isAr ? 'rtl' : 'ltr'}
      data-odoo-partial-warning="true"
      className={`inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-300/70 bg-white/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] backdrop-blur-md ring-1 ring-amber-400/20 dark:border-slate-500/25 dark:bg-[rgba(15,26,48,0.78)] dark:text-slate-200 dark:ring-amber-400/20 ${className}`.trim()}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600/80 dark:text-amber-300/80" aria-hidden />
      <span>{text}</span>
    </div>
  )
}
