'use client'

import React from 'react'
import { cx } from '@/components/ui/cx'
import { DetailsPopover } from '@/components/ui/details-popover'
import { formatKuwaitDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export type KpiMetricKindAr = 'فعلي' | 'محسوب بمعادلة' | 'تقدير'
export type KpiMetricKindInput = KpiMetricKindAr | 'actual' | 'formula' | 'estimate'
export type KpiProvenanceKind = KpiMetricKindInput

export interface KpiProvenanceBadgeProps {
  /** Odoo 17 model name(s), e.g. `pos.order`, `account.move.line`, `stock.move`, `purchase.order.line` */
  odooModel?: string
  /** Alias for `odooModel` */
  model?: string
  /** Inclusive date window (`{ from, to }` or formatted ISO range string) */
  dateRange: { from: string; to: string } | string
  /** ISO timestamp of the last Odoo sync (`null` when disconnected/unsynced) */
  lastSyncAt?: string | null
  /** Explicit >24h staleness flag; also computed automatically from `lastSyncAt` when older than 24h */
  isStale24h?: boolean
  /** Classification of the KPI number: `فعلي` | `محسوب بمعادلة` | `تقدير` */
  kind: KpiMetricKindInput
  /** Actual Odoo JSON-RPC domain/read_group query or explicit mathematical formula shown on hover/title */
  queryOrFormula?: string
  isAr?: boolean
  compact?: boolean
  className?: string
}

function useSafeIsAr(explicitIsAr?: boolean): boolean {
  try {
    const i18n = useI18n()
    return explicitIsAr ?? i18n.locale === 'ar'
  } catch {
    return explicitIsAr ?? true
  }
}

function normalizeKind(kind: KpiMetricKindInput): {
  ar: KpiMetricKindAr
  en: string
  toneClass: string
} {
  if (kind === 'فعلي' || kind === 'actual') {
    return {
      ar: 'فعلي',
      en: 'Actual',
      toneClass:
        'bg-emerald-50/90 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25',
    }
  }
  if (kind === 'محسوب بمعادلة' || kind === 'formula') {
    return {
      ar: 'محسوب بمعادلة',
      en: 'Formula',
      toneClass:
        'bg-sky-50/90 text-sky-800 ring-sky-500/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25',
    }
  }
  return {
    ar: 'تقدير',
    en: 'Estimate',
    toneClass:
      'bg-slate-100/90 text-slate-700 ring-slate-400/30 dark:bg-white/[0.08] dark:text-slate-200 dark:ring-white/15',
  }
}

function formatSyncShort(lastSyncAt?: string | null): {
  labelAr: string
  labelEn: string
  computedStale24h: boolean
} {
  if (!lastSyncAt) {
    return {
      labelAr: 'غير متزامن',
      labelEn: 'Not synced',
      computedStale24h: false,
    }
  }
  const ms = Date.parse(lastSyncAt)
  if (!Number.isFinite(ms)) {
    return {
      labelAr: lastSyncAt,
      labelEn: lastSyncAt,
      computedStale24h: false,
    }
  }
  const ageMs = Date.now() - ms
  const computedStale24h = ageMs > 24 * 3_600_000
  const formatted = formatKuwaitDateTime(ms, { locale: 'en', style: 'iso' })
  return {
    labelAr: formatted,
    labelEn: formatted,
    computedStale24h,
  }
}

/**
 * Mandatory KPI Provenance Badge (`src/components/erp/KpiProvenanceBadge.tsx`).
 * Displays for every KPI:
 *   1. Odoo model (`pos.order`, `account.move.line`, `stock.move`, ...)
 *   2. Date range (`from .. to`)
 *   3. Last sync timestamp (`Asia/Kuwait`)
 *   4. Metric type (`فعلي` | `محسوب بمعادلة` | `تقدير`)
 *   5. `قديمة` badge whenever data is older than 24 hours
 *   6. Exact Odoo query or mathematical formula, opened below the badge
 */
export function KpiProvenanceBadge({
  odooModel: rawOdooModel,
  model,
  dateRange,
  lastSyncAt,
  isStale24h,
  kind,
  queryOrFormula: rawQueryOrFormula,
  isAr: explicitIsAr,
  compact = false,
  className = '',
}: KpiProvenanceBadgeProps) {
  const isAr = useSafeIsAr(explicitIsAr)
  const suppliedModel = (rawOdooModel || model || '').trim()
  const odooModel = suppliedModel || (isAr ? 'غير محدد' : 'unspecified')
  const kindMeta = normalizeKind(kind)
  const rangeStr =
    typeof dateRange === 'string'
      ? dateRange
      : dateRange.from === dateRange.to
        ? dateRange.from
        : `${dateRange.from} → ${dateRange.to}`
  const queryOrFormula =
    rawQueryOrFormula || `${odooModel} [${rangeStr}]`

  const syncInfo = formatSyncShort(lastSyncAt)
  const stale = Boolean(isStale24h || syncInfo.computedStale24h)

  const accessibleSummary = isAr
    ? [
        `النوع: ${kindMeta.ar}`,
        `موديل Odoo: ${odooModel}`,
        `نطاق التاريخ: ${rangeStr}`,
        `آخر مزامنة: ${syncInfo.labelAr}${stale ? ' (قديمة > 24 ساعة)' : ''}`,
        `الاستعلام / المعادلة: ${queryOrFormula}`,
      ].join(' | ')
    : [
        `Type: ${kindMeta.en}`,
        `Odoo Model: ${odooModel}`,
        `Date Range: ${rangeStr}`,
        `Last Sync: ${syncInfo.labelEn}${stale ? ' (Stale > 24h)' : ''}`,
        `Query / Formula: ${queryOrFormula}`,
      ].join(' | ')

  return (
    <DetailsPopover
      isAr={isAr}
      accessibleSummary={accessibleSummary}
      data-kpi-provenance={kindMeta.ar}
      data-odoo-model={odooModel}
      data-kpi-stale={stale ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
      className={cx('mt-2 tabular-nums', className)}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ring-1',
            kindMeta.toneClass,
          )}
        >
          {isAr ? kindMeta.ar : kindMeta.en}
        </span>

        <span
          dir="ltr"
          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10"
        >
          {odooModel}
        </span>

        {stale ? (
          <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-900 ring-1 ring-yellow-500/35 dark:bg-yellow-400/20 dark:text-yellow-200 dark:ring-yellow-400/35">
            {isAr ? 'قديمة' : 'Stale'}
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        <div>
          {isAr ? 'النطاق: ' : 'Range: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums">
            {rangeStr}
          </span>
        </div>
        <div>
          {isAr ? 'آخر مزامنة: ' : 'Last sync: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums">
            {isAr ? syncInfo.labelAr : syncInfo.labelEn}
          </span>
          {stale ? (isAr ? ' • قديمة (>24 ساعة)' : ' • Stale (>24h)') : ''}
        </div>
      </div>

      <div
        dir="ltr"
        className="mt-2 break-words rounded-xl bg-slate-100/90 p-2 font-mono text-xs text-slate-800 dark:bg-white/[0.06] dark:text-sky-200"
      >
        {queryOrFormula}
      </div>
    </DetailsPopover>
  )
}

export default KpiProvenanceBadge
