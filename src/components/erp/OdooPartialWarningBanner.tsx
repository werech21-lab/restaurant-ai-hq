'use client'

import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const DEFAULT_PARTIAL_WARNING_AR = 'بعض الأرقام غير متاحة الآن'
export const DEFAULT_PARTIAL_WARNING_EN = 'Some figures are temporarily unavailable'

export function OdooPartialWarningBanner(_props: {
  summary?: Pick<
    OdooLiveSummary,
    'partial' | 'unavailableSections' | 'warningAr' | 'warningEn'
  > | null
  isAr: boolean
  className?: string
}) {
  void _props
  return null
}
