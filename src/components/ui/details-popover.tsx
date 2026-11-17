'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import type { FormatLocale } from '@/lib/format'
import { cx } from './cx'

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
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
 * Accessible frosted-glass progressive disclosure popover.
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
  const [internalOpen, setInternalOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  const defaultTriggerText = resolvedIsAr ? 'التفاصيل' : 'Details'
  const resolvedTriggerLabel = triggerLabel ?? defaultTriggerText
  const resolvedAriaLabel =
    accessibleSummary ||
    (typeof resolvedTriggerLabel === 'string' ? resolvedTriggerLabel : defaultTriggerText)

  return (
    <div
      ref={rootRef}
      dir={resolvedDir}
      data-details-popover="true"
      className={cx('relative inline-flex items-center text-xs leading-tight', className)}
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
          'inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-300/65 bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur-sm transition-colors hover:border-slate-400/75 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white',
          triggerClassName,
        )}
      >
        <span aria-hidden="true">ⓘ</span>
        <span>{resolvedTriggerLabel}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className={cx(
            'absolute top-full z-40 mt-2 w-72 max-w-[min(90vw,22rem)] rounded-2xl border border-slate-200/85 bg-white/95 p-3 text-xs text-slate-700 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-[#0F1A30]/95 dark:text-slate-200 dark:shadow-[0_18px_42px_-12px_rgba(2,6,23,0.75)]',
            align === 'end' ? 'end-0' : 'start-0',
            panelClassName,
          )}
        >
          {heading ? (
            <div className="mb-1.5 font-bold text-slate-900 dark:text-white">{heading}</div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}

export default DetailsPopover
