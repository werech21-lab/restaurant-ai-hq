'use client'

import type { ReactNode } from 'react'
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
  /** Live Odoo summary object (global clutter warning banner suppressed in Executive Polish v2). */
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
 * Executive Polish v2: Global partial-data clutter banner is suppressed.
 * Unavailable metrics are hidden dynamically or explained via subtle `(i)` tooltips at point of context.
 */
export function PartialWarningBanner(_props: PartialWarningBannerProps): null {
  void _props
  return null
}
