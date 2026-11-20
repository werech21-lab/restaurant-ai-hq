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
import { Info } from 'lucide-react'

export interface CompactInfoTooltipProps {
  text: string
  label?: string
  isAr?: boolean
  className?: string
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  dataValuationNote?: boolean
  dataNetProfitWithheld?: boolean
  dataScopeNote?: boolean
  dataCommissionNote?: boolean
}

export interface CompactTooltipCoords {
  top: number
  left: number
  placement: 'top' | 'bottom'
  horizontalAlign: 'center' | 'start' | 'end'
}

const VIEWPORT_MARGIN = 12
const TRIGGER_GAP = 8
const DEFAULT_TOOLTIP_WIDTH = 288
const DEFAULT_TOOLTIP_HEIGHT = 96

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && typeof document !== 'undefined'
    ? useLayoutEffect
    : useEffect

export function computeCompactTooltipCoords(params: {
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'> & {
    width?: number
    height?: number
  }
  panelWidth?: number
  panelHeight?: number
  viewportWidth?: number
  viewportHeight?: number
  isRtl?: boolean
}): CompactTooltipCoords {
  const {
    triggerRect,
    panelWidth = DEFAULT_TOOLTIP_WIDTH,
    panelHeight = DEFAULT_TOOLTIP_HEIGHT,
    viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280,
    viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
    isRtl = false,
  } = params

  const vw = Math.max(320, viewportWidth)
  const vh = Math.max(240, viewportHeight)
  const clampedWidth = Math.min(
    panelWidth > 0 ? panelWidth : DEFAULT_TOOLTIP_WIDTH,
    Math.max(200, vw - VIEWPORT_MARGIN * 2),
  )
  const clampedHeight = panelHeight > 0 ? panelHeight : DEFAULT_TOOLTIP_HEIGHT
  const triggerWidth =
    typeof triggerRect.width === 'number'
      ? triggerRect.width
      : Math.max(0, triggerRect.right - triggerRect.left)

  const fitsAbove =
    triggerRect.top - clampedHeight - TRIGGER_GAP >= VIEWPORT_MARGIN
  const lacksSpaceBelow =
    triggerRect.bottom + TRIGGER_GAP + clampedHeight + VIEWPORT_MARGIN > vh
  const hasMoreSpaceAbove = triggerRect.top > vh - triggerRect.bottom
  const placeAbove = fitsAbove || (lacksSpaceBelow && hasMoreSpaceAbove)

  const rawTop = placeAbove
    ? triggerRect.top - clampedHeight - TRIGGER_GAP
    : triggerRect.bottom + TRIGGER_GAP
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - clampedHeight - VIEWPORT_MARGIN)
  const top = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop))

  const centeredLeft =
    triggerRect.left + triggerWidth / 2 - clampedWidth / 2
  let rawLeft = centeredLeft
  let horizontalAlign: 'center' | 'start' | 'end' = 'center'

  if (centeredLeft < VIEWPORT_MARGIN) {
    rawLeft = triggerRect.left
    horizontalAlign = isRtl ? 'end' : 'start'
  } else if (centeredLeft + clampedWidth > vw - VIEWPORT_MARGIN) {
    rawLeft = triggerRect.right - clampedWidth
    horizontalAlign = isRtl ? 'start' : 'end'
  }

  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - clampedWidth - VIEWPORT_MARGIN)
  const left = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawLeft), maxLeft))

  return {
    top,
    left,
    placement: placeAbove ? 'top' : 'bottom',
    horizontalAlign,
  }
}

export function CompactInfoTooltip({
  text,
  label,
  isAr = false,
  className = '',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  dataValuationNote,
  dataNetProfitWithheld,
  dataScopeNote,
  dataCommissionNote,
}: CompactInfoTooltipProps) {
  const trimmed = text.trim()
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pinnedOpen, setPinnedOpen] = useState<boolean>(defaultOpen)
  const [hovered, setHovered] = useState<boolean>(false)
  const [coords, setCoords] = useState<CompactTooltipCoords>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    placement: 'top',
    horizontalAlign: 'center',
  })

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : pinnedOpen || hovered

  const notifyOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const closeAll = useCallback(() => {
    if (!isControlled) {
      setPinnedOpen(false)
      setHovered(false)
    }
    notifyOpenChange(false)
  }, [isControlled, notifyOpenChange])

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelRect = panelRef.current?.getBoundingClientRect()
    const next = computeCompactTooltipCoords({
      triggerRect: rect,
      panelWidth:
        panelRect && panelRect.width > 0 ? panelRect.width : DEFAULT_TOOLTIP_WIDTH,
      panelHeight:
        panelRect && panelRect.height > 0 ? panelRect.height : 88,
      viewportWidth:
        window.innerWidth || document.documentElement?.clientWidth || 1280,
      viewportHeight:
        window.innerHeight || document.documentElement?.clientHeight || 800,
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
      return undefined
    }
    updatePosition()
    const raf = window.requestAnimationFrame(() => updatePosition())
    const handleViewport = () => updatePosition()

    window.addEventListener('scroll', handleViewport, { capture: true, passive: true })
    window.addEventListener('resize', handleViewport, { passive: true })

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', handleViewport, { capture: true })
      window.removeEventListener('resize', handleViewport)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      closeAll()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAll()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeAll, open])

  if (!trimmed) return null

  const accessibleLabel = label?.trim() || (isAr ? 'ملاحظة توضيحية' : 'Information note')
  const canPortal = typeof document !== 'undefined' && Boolean(document.body)

  const floatingTooltip = (
    <div
      ref={panelRef}
      id={tooltipId}
      role="tooltip"
      dir={isAr ? 'rtl' : 'ltr'}
      data-compact-info-portal="true"
      data-placement={coords.placement}
      data-horizontal-align={coords.horizontalAlign}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className={`${
        pinnedOpen ? 'pointer-events-auto' : 'pointer-events-none'
      } fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/95 bg-white p-3 text-start text-xs font-medium leading-relaxed text-slate-700 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.06]`}
    >
      {label ? (
        <span className="mb-1 block font-bold text-slate-900">{label}</span>
      ) : null}
      <span className="text-slate-700">{trimmed}</span>
    </div>
  )

  return (
    <span
      data-compact-info-tooltip="true"
      data-valuation-note={dataValuationNote ? 'true' : undefined}
      data-net-profit-withheld={dataNetProfitWithheld ? 'true' : undefined}
      data-scope-note={dataScopeNote ? 'true' : undefined}
      data-commission-note={dataCommissionNote ? 'true' : undefined}
      className={`relative inline-flex shrink-0 items-center ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={accessibleLabel}
        aria-expanded={open}
        aria-describedby={tooltipId}
        onClick={() => {
          if (isControlled) {
            notifyOpenChange(!open)
            return
          }
          setPinnedOpen((prev) => {
            const next = !prev
            if (!next) setHovered(false)
            notifyOpenChange(next)
            return next
          })
        }}
        onMouseEnter={() => {
          if (isControlled) return
          setHovered(true)
          if (!pinnedOpen) notifyOpenChange(true)
        }}
        onMouseLeave={() => {
          if (isControlled) return
          setHovered(false)
          if (!pinnedOpen) notifyOpenChange(false)
        }}
        onFocus={() => {
          if (isControlled) return
          setHovered(true)
          if (!pinnedOpen) notifyOpenChange(true)
        }}
        onBlur={() => {
          if (isControlled) return
          setHovered(false)
          if (!pinnedOpen) notifyOpenChange(false)
        }}
        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100/90 text-slate-600 ring-1 ring-slate-300/70 transition-colors hover:bg-emerald-50 hover:text-[#047857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-600/60 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
      >
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </button>

      {open ? (
        canPortal ? (
          createPortal(floatingTooltip, document.body)
        ) : (
          floatingTooltip
        )
      ) : (
        <span id={tooltipId} role="tooltip" className="sr-only">
          {trimmed}
        </span>
      )}
    </span>
  )
}
