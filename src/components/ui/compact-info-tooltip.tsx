'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export interface CompactInfoTooltipProps {
  text: string
  label?: string
  isAr?: boolean
  className?: string
  dataValuationNote?: boolean
  dataNetProfitWithheld?: boolean
  dataScopeNote?: boolean
  dataCommissionNote?: boolean
}

interface FloatingCoords {
  top: number
  left: number
  placement: 'top' | 'bottom'
}

function computeTooltipCoords(triggerRect: DOMRect, panelWidth = 280, panelHeight = 96): FloatingCoords {
  const margin = 12
  const gap = 8
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const placeAbove = triggerRect.top - panelHeight - gap >= margin || triggerRect.bottom + panelHeight + gap > vh
  const top = placeAbove
    ? Math.max(margin, triggerRect.top - panelHeight - gap)
    : Math.min(vh - panelHeight - margin, triggerRect.bottom + gap)

  const centeredLeft = triggerRect.left + triggerRect.width / 2 - panelWidth / 2
  const left = Math.max(margin, Math.min(vw - panelWidth - margin, centeredLeft))

  return {
    top,
    left,
    placement: placeAbove ? 'top' : 'bottom',
  }
}

export function CompactInfoTooltip({
  text,
  label,
  isAr = false,
  className = '',
  dataValuationNote,
  dataNetProfitWithheld,
  dataScopeNote,
  dataCommissionNote,
}: CompactInfoTooltipProps) {
  const trimmed = text.trim()
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<FloatingCoords | null>(null)

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelRect = panelRef.current?.getBoundingClientRect()
    setCoords(
      computeTooltipCoords(
        rect,
        panelRect && panelRect.width > 0 ? panelRect.width : 280,
        panelRect && panelRect.height > 0 ? panelRect.height : 88,
      ),
    )
  }, [])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    updatePosition()

    const handleViewport = () => updatePosition()
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener('scroll', handleViewport, { capture: true, passive: true })
    window.addEventListener('resize', handleViewport, { passive: true })
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleViewport, true)
      window.removeEventListener('resize', handleViewport)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, updatePosition])

  if (!trimmed) return null

  const accessibleLabel = label?.trim() || (isAr ? 'ملاحظة توضيحية' : 'Information note')
  const canPortal = typeof document !== 'undefined' && Boolean(document.body)

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
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100/90 text-slate-600 ring-1 ring-slate-300/70 transition-colors hover:bg-emerald-50 hover:text-[#047857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-600/60 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && canPortal
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              dir={isAr ? 'rtl' : 'ltr'}
              data-placement={coords?.placement ?? 'top'}
              style={{
                top: coords?.top ?? 12,
                left: coords?.left ?? 12,
                zIndex: 9999,
              }}
              className="pointer-events-none fixed z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/95 bg-white p-3 text-start text-xs font-medium leading-relaxed text-slate-700 shadow-lg ring-1 ring-slate-900/[0.05] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {label ? (
                <span className="mb-1 block font-bold text-slate-900 dark:text-white">{label}</span>
              ) : null}
              <span>{trimmed}</span>
            </div>,
            document.body,
          )
        : (
            <span id={tooltipId} role="tooltip" className="sr-only">
              {trimmed}
            </span>
          )}
    </span>
  )
}
