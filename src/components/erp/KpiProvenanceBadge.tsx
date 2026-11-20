'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/components/ui/cx'
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
  /** Actual Odoo JSON-RPC domain/read_group query or explicit mathematical formula */
  queryOrFormula?: string
  isAr?: boolean
  compact?: boolean
  /** Optional controlled open state */
  open?: boolean
  /** Optional initial open state for uncontrolled usage */
  defaultOpen?: boolean
  /** Callback fired whenever open state changes */
  onOpenChange?: (open: boolean) => void
  className?: string
}

interface PopoverCoords {
  top: number
  left: number
  placement: 'bottom' | 'top'
  horizontalAlign: 'start' | 'end'
}

const VIEWPORT_MARGIN = 12
const TRIGGER_GAP = 8
const FALLBACK_POPOVER_WIDTH = 288
const FALLBACK_POPOVER_HEIGHT = 176

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && typeof document !== 'undefined'
    ? useLayoutEffect
    : useEffect

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
        'bg-emerald-50 text-emerald-800 ring-emerald-500/25',
    }
  }
  if (kind === 'محسوب بمعادلة' || kind === 'formula') {
    return {
      ar: 'محسوب بمعادلة',
      en: 'Formula',
      toneClass:
        'bg-sky-50 text-sky-800 ring-sky-500/25',
    }
  }
  return {
    ar: 'تقدير',
    en: 'Estimate',
    toneClass:
      'bg-slate-100 text-slate-700 ring-slate-400/30',
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

export function computeCollisionAwarePopoverCoords(params: {
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>
  popoverWidth: number
  popoverHeight: number
  viewportWidth: number
  viewportHeight: number
  isRtl: boolean
  align?: 'start' | 'end'
}): PopoverCoords {
  const {
    triggerRect,
    popoverWidth,
    popoverHeight,
    viewportWidth,
    viewportHeight,
    isRtl,
    align = 'start',
  } = params

  const vw = Math.max(320, viewportWidth)
  const vh = Math.max(240, viewportHeight)
  const clampedWidth = Math.min(
    popoverWidth > 0 ? popoverWidth : FALLBACK_POPOVER_WIDTH,
    Math.max(200, vw - VIEWPORT_MARGIN * 2),
  )
  const clampedHeight = popoverHeight > 0 ? popoverHeight : FALLBACK_POPOVER_HEIGHT

  const lacksSpaceBelow =
    triggerRect.bottom + TRIGGER_GAP + clampedHeight + VIEWPORT_MARGIN > vh
  const hasMoreSpaceAbove = triggerRect.top > vh - triggerRect.bottom
  const shouldFlipUp =
    lacksSpaceBelow &&
    (triggerRect.top - clampedHeight - TRIGGER_GAP >= VIEWPORT_MARGIN ||
      hasMoreSpaceAbove)

  const rawTop = shouldFlipUp
    ? triggerRect.top - clampedHeight - TRIGGER_GAP
    : triggerRect.bottom + TRIGGER_GAP
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - clampedHeight - VIEWPORT_MARGIN)
  const top = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop))

  const prefersRightEdge = isRtl ? align === 'start' : align === 'end'
  let resolvedAlign: 'start' | 'end' = align
  let rawLeft = prefersRightEdge
    ? triggerRect.right - clampedWidth
    : triggerRect.left

  if (prefersRightEdge && rawLeft < VIEWPORT_MARGIN) {
    if (
      triggerRect.left + clampedWidth <= vw - VIEWPORT_MARGIN ||
      vw - triggerRect.left > triggerRect.right
    ) {
      rawLeft = triggerRect.left
      resolvedAlign = align === 'start' ? 'end' : 'start'
    }
  } else if (!prefersRightEdge && rawLeft + clampedWidth > vw - VIEWPORT_MARGIN) {
    if (
      triggerRect.right - clampedWidth >= VIEWPORT_MARGIN ||
      triggerRect.right > vw - triggerRect.left
    ) {
      rawLeft = triggerRect.right - clampedWidth
      resolvedAlign = align === 'start' ? 'end' : 'start'
    }
  }

  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - clampedWidth - VIEWPORT_MARGIN)
  const left = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawLeft), maxLeft))

  return {
    top,
    left,
    placement: shouldFlipUp ? 'top' : 'bottom',
    horizontalAlign: resolvedAlign,
  }
}

/**
 * Mandatory KPI Provenance Badge (`src/components/erp/KpiProvenanceBadge.tsx`).
 * Displays for every KPI via a portal-rendered, collision-aware floating popover:
 *   1. Odoo model (`pos.order`, `account.move.line`, `stock.move`, ...)
 *   2. Date range (`from .. to`)
 *   3. Last sync timestamp (`Asia/Kuwait`)
 *   4. Metric type (`فعلي` | `محسوب بمعادلة` | `تقدير`)
 *   5. `قديمة` badge whenever data is older than 24 hours
 *   6. Exact Odoo query or mathematical formula
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
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className = '',
}: KpiProvenanceBadgeProps) {
  const isAr = useSafeIsAr(explicitIsAr)
  const resolvedDir = isAr ? 'rtl' : 'ltr'
  const suppliedModel = (rawOdooModel || model || '').trim()
  const odooModel = suppliedModel || (isAr ? 'غير محدد' : 'unspecified')
  const kindMeta = normalizeKind(kind)
  const rangeStr =
    typeof dateRange === 'string'
      ? dateRange
      : dateRange.from === dateRange.to
        ? dateRange.from
        : `${dateRange.from} → ${dateRange.to}`
  const queryOrFormula = rawQueryOrFormula || `${odooModel} [${rangeStr}]`

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

  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen)
  const [coords, setCoords] = useState<PopoverCoords>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    placement: 'bottom',
    horizontalAlign: 'start',
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popRect = panelRef.current?.getBoundingClientRect()
    const next = computeCollisionAwarePopoverCoords({
      triggerRect,
      popoverWidth: popRect?.width ?? FALLBACK_POPOVER_WIDTH,
      popoverHeight: popRect?.height ?? FALLBACK_POPOVER_HEIGHT,
      viewportWidth:
        window.innerWidth || document.documentElement?.clientWidth || 1024,
      viewportHeight:
        window.innerHeight || document.documentElement?.clientHeight || 768,
      isRtl: isAr,
    })
    setCoords((prev) =>
      prev.top === next.top &&
      prev.left === next.left &&
      prev.placement === next.placement &&
      prev.horizontalAlign === next.horizontalAlign
        ? prev
        : next,
    )
  }, [isAr])

  useIsomorphicLayoutEffect(() => {
    if (!open || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }
    updatePosition()
    const raf = window.requestAnimationFrame(() => updatePosition())
    const handleReposition = () => updatePosition()
    window.addEventListener('scroll', handleReposition, {
      capture: true,
      passive: true,
    })
    window.addEventListener('resize', handleReposition, { passive: true })
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', handleReposition, { capture: true })
      window.removeEventListener('resize', handleReposition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onOutsidePointer)
    document.addEventListener('touchstart', onOutsidePointer, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onOutsidePointer)
      document.removeEventListener('touchstart', onOutsidePointer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  const triggerText = isAr ? 'التفاصيل' : 'Details'

  const popoverPanel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="tooltip"
      dir={resolvedDir}
      data-kpi-provenance-portal="true"
      data-placement={coords.placement}
      data-horizontal-align={coords.horizontalAlign}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className="fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 text-start text-xs text-slate-700 tabular-nums shadow-[0_20px_48px_-12px_rgba(15,23,42,0.24)] backdrop-blur-xl ring-1 ring-slate-900/[0.05]"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-bold ring-1',
            kindMeta.toneClass,
          )}
        >
          {isAr ? kindMeta.ar : kindMeta.en}
        </span>

        <span
          dir="ltr"
          className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10"
        >
          {odooModel}
        </span>

        {stale ? (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-yellow-100 px-1.5 py-0.5 text-xs font-bold text-yellow-900 ring-1 ring-yellow-500/35">
            {isAr ? 'قديمة' : 'Stale'}
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <div>
          {isAr ? 'النطاق: ' : 'Range: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums text-slate-800">
            {rangeStr}
          </span>
        </div>
        <div>
          {isAr ? 'آخر مزامنة: ' : 'Last sync: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums text-slate-800">
            {isAr ? syncInfo.labelAr : syncInfo.labelEn}
          </span>
          {stale ? (isAr ? ' • قديمة (>24 ساعة)' : ' • Stale (>24h)') : ''}
        </div>
      </div>

      <div
        dir="ltr"
        className="mt-2 break-words rounded-xl bg-slate-100 p-2 font-mono text-xs text-slate-800 ring-1 ring-slate-900/[0.06]"
      >
        {queryOrFormula}
      </div>
    </div>
  ) : null

  return (
    <div
      ref={rootRef}
      dir={resolvedDir}
      data-details-popover="true"
      data-kpi-provenance={kindMeta.ar}
      data-odoo-model={odooModel}
      data-kpi-stale={stale ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
      className={cx(
        'relative inline-flex items-center text-xs leading-tight mt-2 tabular-nums',
        className,
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        data-details-trigger="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={accessibleSummary}
        onClick={() => setOpen(!open)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-slate-300/65 bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur-sm transition-colors hover:border-slate-400/75 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
      >
        <span aria-hidden="true">ⓘ</span>
        <span>{triggerText}</span>
      </button>

      {popoverPanel
        ? typeof document !== 'undefined' && document.body
          ? createPortal(popoverPanel, document.body)
          : popoverPanel
        : null}
    </div>
  )
}

export default KpiProvenanceBadge
