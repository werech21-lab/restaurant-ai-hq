'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'

export interface SlidingPillOption<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
  badge?: string | number
}

export interface SlidingPillTabsProps<T extends string> {
  options: readonly SlidingPillOption<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel?: string
  /** 'muted' (#EEF1F6 / #0C131A) for in-card switchers; 'white' (#FFFFFF / #111A22) for floating canvas strips */
  surface?: 'muted' | 'white'
  size?: 'sm' | 'md'
  className?: string
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Verdelo-Signature Sliding Pill Segmented Control.
 * Smoothly glides an active capsule indicator (#0B1220 in Light Mode, #10B981 in Obsidian-Emerald Dark Mode)
 * across options in both RTL (Arabic) and LTR (English) with snappy spring physics and zero layout jump.
 */
export function SlidingPillTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  surface = 'muted',
  size = 'md',
  className = '',
}: SlidingPillTabsProps<T>) {
  const { locale } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Map<T, HTMLButtonElement>>(new Map())

  const [pillBox, setPillBox] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [animate, setAnimate] = useState(false)

  const measure = useCallback(() => {
    const btn = btnRefs.current.get(value)
    if (!btn) return
    const next = {
      left: btn.offsetLeft,
      top: btn.offsetTop,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
    }
    setPillBox((prev) => {
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev
      }
      return next
    })
  }, [value])

  useIsomorphicLayoutEffect(() => {
    measure()
    const raf = window.requestAnimationFrame(() => {
      measure()
      setAnimate(true)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [measure, locale, options.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    const activeBtn = btnRefs.current.get(value)
    if (activeBtn) ro.observe(activeBtn)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, value])

  const btnPadding =
    size === 'sm'
      ? 'h-7 px-3 text-[12px]'
      : 'h-8.5 px-3.5 py-1.5 text-[12.5px] sm:text-[13px]'

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      data-surface={surface}
      className={`ae-sliding-tabs relative inline-flex flex-wrap items-center gap-0.5 select-none ${className}`}
    >
      {pillBox ? (
        <span
          aria-hidden
          data-sliding-pill-indicator="true"
          style={{
            left: 0,
            top: 0,
            width: `${pillBox.width}px`,
            height: `${pillBox.height}px`,
            transform: `translate3d(${pillBox.left}px, ${pillBox.top}px, 0)`,
            transition: animate
              ? 'transform 200ms cubic-bezier(0.22, 1.18, 0.36, 1), width 200ms cubic-bezier(0.22, 1.18, 0.36, 1), height 180ms ease'
              : 'none',
          }}
          className="pointer-events-none absolute z-0 rounded-full"
        />
      ) : null}

      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            ref={(el) => {
              if (el) btnRefs.current.set(opt.id, el)
              else btnRefs.current.delete(opt.id)
            }}
            type="button"
            role="tab"
            aria-selected={active}
            data-sliding-pill-btn="true"
            data-active={active}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap focus:outline-none ${btnPadding} ${
              !pillBox && active ? 'bg-[#0B1220] text-white dark:bg-[#10B981] dark:text-[#04130D]' : ''
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {opt.badge !== undefined ? (
              <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10.5px] font-extrabold tabular-nums dark:bg-white/15">
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
