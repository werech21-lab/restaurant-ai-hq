'use client'

import React from 'react'
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
      en: 'فعلي (Actual)',
      toneClass:
        'bg-emerald-50 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-400/25',
    }
  }
  if (kind === 'محسوب بمعادلة' || kind === 'formula') {
    return {
      ar: 'محسوب بمعادلة',
      en: 'محسوب بمعادلة (Formula)',
      toneClass:
        'bg-sky-50 text-sky-900 ring-sky-500/25 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-400/25',
    }
  }
  return {
    ar: 'تقدير',
    en: 'تقدير (Estimate)',
    toneClass:
      'bg-amber-100/90 text-amber-950 ring-amber-500/35 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-400/30',
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
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ms))
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const formatted = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
    return {
      labelAr: formatted,
      labelEn: formatted,
      computedStale24h,
    }
  } catch {
    const iso = new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
    return {
      labelAr: iso,
      labelEn: iso,
      computedStale24h,
    }
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
 *   6. Exact Odoo query or mathematical formula on `title` / hover
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
  const odooModel = rawOdooModel || model || 'pos.order'
  const isAr = useSafeIsAr(explicitIsAr)
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

  const fullTitle = isAr
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
        `Last Sync: ${syncInfo.labelEn}${stale ? ' (قديمة > 24h)' : ''}`,
        `Query / Formula: ${queryOrFormula}`,
      ].join(' | ')

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      title={fullTitle}
      data-kpi-provenance={kindMeta.ar}
      data-odoo-model={odooModel}
      data-kpi-stale={stale ? 'true' : 'false'}
      className={`group relative mt-2 flex flex-wrap items-center gap-1.5 text-[11px] leading-tight tabular-nums ${className}`}
    >
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-extrabold ring-1 ${kindMeta.toneClass}`}
      >
        {isAr ? kindMeta.ar : kindMeta.en}
      </span>

      <span
        dir="ltr"
        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10"
      >
        {odooModel}
      </span>

      <span
        dir="ltr"
        className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10"
      >
        {rangeStr}
      </span>

      <span className="inline-flex items-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
        {isAr ? `مزامنة: ${syncInfo.labelAr}` : `Sync: ${syncInfo.labelEn}`}
      </span>

      {stale ? (
        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold bg-yellow-100 text-yellow-900 ring-1 ring-yellow-500/40 dark:bg-yellow-400/20 dark:text-yellow-200 dark:ring-yellow-400/40">
          قديمة
        </span>
      ) : null}

      <div
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full start-0 z-40 mb-1.5 w-72 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 dark:border-white/15 dark:bg-[#0E1713] dark:text-slate-200"
      >
        <div className="font-bold text-slate-900 dark:text-white">
          {isAr ? `${kindMeta.ar} — ${odooModel}` : `${kindMeta.en} — ${odooModel}`}
        </div>
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          {isAr ? `التاريخ: ${rangeStr}` : `Range: ${rangeStr}`}
          {' • '}
          {isAr ? `آخر مزامنة: ${syncInfo.labelAr}` : `Last sync: ${syncInfo.labelEn}`}
          {stale ? ' • قديمة (>24h)' : ''}
        </div>
        <div
          dir="ltr"
          className="mt-1.5 break-words rounded-lg bg-slate-100/90 p-1.5 font-mono text-[10px] text-slate-800 dark:bg-white/[0.06] dark:text-emerald-200"
        >
          {queryOrFormula}
        </div>
      </div>
    </div>
  )
}

export default KpiProvenanceBadge
