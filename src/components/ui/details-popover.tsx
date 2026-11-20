'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { FormatLocale } from '@/lib/format'
import { cx } from './cx'

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

export interface DetailsPopoverCoords {
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

export function computeDetailsPopoverCoords(params: {
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>
  popoverWidth: number
  popoverHeight: number
  viewportWidth: number
  viewportHeight: number
  isRtl: boolean
  align?: 'start' | 'end'
}): DetailsPopoverCoords {
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
  const clampedHeight =
    popoverHeight > 0 ? popoverHeight : FALLBACK_POPOVER_HEIGHT

  const lacksSpaceBelow =
    triggerRect.bottom + TRIGGER_GAP + clampedHeight + VIEWPORT_MARGIN > vh
  const fitsAbove =
    triggerRect.top - TRIGGER_GAP - clampedHeight >= VIEWPORT_MARGIN
  const hasMoreSpaceAbove = triggerRect.top > vh - triggerRect.bottom
  const shouldFlipUp = lacksSpaceBelow && (fitsAbove || hasMoreSpaceAbove)

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
    const fitsFlippingRight =
      triggerRect.left + clampedWidth <= vw - VIEWPORT_MARGIN
    const moreRoomRight = vw - triggerRect.left > triggerRect.right
    if (fitsFlippingRight || moreRoomRight) {
      rawLeft = triggerRect.left
      resolvedAlign = align === 'start' ? 'end' : 'start'
    }
  } else if (!prefersRightEdge && rawLeft + clampedWidth > vw - VIEWPORT_MARGIN) {
    const fitsFlippingLeft =
      triggerRect.right - clampedWidth >= VIEWPORT_MARGIN
    const moreRoomLeft = triggerRect.right > vw - triggerRect.left
    if (fitsFlippingLeft || moreRoomLeft) {
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

export interface DetailsPopoverProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>,
    DataAttributes {
  /** Accessible summary exposed via `aria-label` on the trigger button (never uses `title=`). */
  accessibleSummary?: string
  /** Visible trigger label (defaults to `'التفاصيل'` in AR and `'Details'` in EN). */
  triggerLabel?: ReactNode
  /** Optional heading rendered inside the open frosted-glass popover. */
  heading?: ReactNode
  /** Explicit Arabic/RTL toggle; defaults to `true` unless `locale === 'en'` or `isAr === false`. */
  isAr?: boolean
  /** Alternative locale toggle (`'ar' | 'en'`). */
  locale?: FormatLocale
  /** Horizontal alignment of the popover relative to the trigger. */
  align?: 'start' | 'end'
  /** Controlled open state. */
  open?: boolean
  /** Initial uncontrolled open state. */
  defaultOpen?: boolean
  /** Controlled open state callback. */
  onOpenChange?: (open: boolean) => void
  /** Additional classes for the trigger button. */
  triggerClassName?: string
  /** Additional classes for the floating frosted-glass panel. */
  panelClassName?: string
  /** Content displayed inside the popover when open. */
  children: ReactNode
}

/**
 * Accessible frosted-glass progressive disclosure popover rendered via top-level React Portal
 * (`createPortal(..., document.body)`) with collision-aware vertical & horizontal flip.
 * Triggers via `<button data-details-trigger="true">` with zero `title=` attributes
 * and closes on outside pointer clicks or the `Escape` key.
 */
export function DetailsPopover({
  accessibleSummary,
  triggerLabel,
  heading,
  isAr,
  locale,
  align = 'start',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className = '',
  triggerClassName = '',
  panelClassName = '',
  dir,
  children,
  ...rest
}: DetailsPopoverProps) {
  const resolvedIsAr = isAr ?? (locale ? locale !== 'en' : true)
  const resolvedDir = dir ?? (resolvedIsAr ? 'rtl' : 'ltr')
  const isRtl = resolvedDir === 'rtl'
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen)
  const [coords, setCoords] = useState<DetailsPopoverCoords>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    placement: 'bottom',
    horizontalAlign: align,
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popRect = panelRef.current?.getBoundingClientRect()
    const next = computeDetailsPopoverCoords({
      triggerRect,
      popoverWidth: popRect?.width ?? FALLBACK_POPOVER_WIDTH,
      popoverHeight: popRect?.height ?? FALLBACK_POPOVER_HEIGHT,
      viewportWidth:
        window.innerWidth || document.documentElement?.clientWidth || 1024,
      viewportHeight:
        window.innerHeight || document.documentElement?.clientHeight || 768,
      isRtl,
      align,
    })
    setCoords((prev) =>
      prev.top === next.top &&
      prev.left === next.left &&
      prev.placement === next.placement &&
      prev.horizontalAlign === next.horizontalAlign
        ? prev
        : next,
    )
  }, [align, isRtl])

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

  const defaultTriggerText = resolvedIsAr ? 'التفاصيل' : 'Details'
  const resolvedTriggerLabel = triggerLabel ?? defaultTriggerText
  const resolvedAriaLabel =
    accessibleSummary ||
    (typeof resolvedTriggerLabel === 'string' ? resolvedTriggerLabel : defaultTriggerText)

  const popoverPanel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="tooltip"
      dir={resolvedDir}
      data-details-portal="true"
      data-placement={coords.placement}
      data-horizontal-align={coords.horizontalAlign}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className={cx(
        'fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 text-start text-xs text-slate-700 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.24)] backdrop-blur-xl ring-1 ring-slate-900/[0.05]',
        panelClassName,
      )}
    >
      {heading ? (
        <div className="mb-1.5 font-bold text-slate-900">{heading}</div>
      ) : null}
      <div className="text-slate-700">{children}</div>
    </div>
  ) : null

  return (
    <div
      ref={rootRef}
      dir={resolvedDir}
      data-details-popover="true"
      className={cx('relative inline-flex shrink-0 items-center text-xs leading-tight', className)}
      {...rest}
    >
      <button
        ref={triggerRef}
        type="button"
        data-details-trigger="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={resolvedAriaLabel}
        onClick={() => setOpen(!open)}
        className={cx(
          'inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-slate-300/65 bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur-sm transition-colors hover:border-slate-400/75 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white',
          triggerClassName,
        )}
      >
        <span aria-hidden="true">ⓘ</span>
        <span>{resolvedTriggerLabel}</span>
      </button>

      {popoverPanel
        ? typeof document !== 'undefined' && document.body
          ? createPortal(popoverPanel, document.body)
          : popoverPanel
        : null}
    </div>
  )
}

export default DetailsPopover
