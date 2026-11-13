'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

/**
 * Normalizes YYYY-MM-DD ("2026-10-29") or MM-DD ("10-29", "11-01") date labels
 * into compact DD/MM ("29/10", "01/11") so X-axis ticks never clip into "1." on 390px mobile.
 */
export function formatCompactAxisLabel(raw: string): string {
  const s = (raw ?? '').trim()
  const fullIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (fullIso) return `${fullIso[3]}/${fullIso[2]}`
  const mmDd = /^(\d{2})-(\d{2})$/.exec(s)
  if (mmDd) return `${mmDd[2]}/${mmDd[1]}`
  return s
}

/**
 * Formats Y-axis KWD ticks using Western 0-9 numerals (`tabular-nums`),
 * rendering `7.3 ألف` / `5.4 ألف` / `1.1 ألف` in Arabic and `7.3k` / `5.4k` in English.
 */
export function formatCompactKwdTick(v: number, isAr: boolean): string {
  const safe = Number.isFinite(v) ? Math.max(0, v) : 0
  if (safe >= 1000) {
    const k = (safe / 1000).toFixed(1)
    return isAr ? `${k} ألف` : `${k}k`
  }
  return Math.round(safe).toLocaleString('en-US')
}

export interface TooltipLine {
  label: string
  value: string
  tone?: 'neutral' | 'emerald' | 'rose' | 'amber' | 'slate'
  bold?: boolean
}

export interface DualBarDatum {
  id: string
  label: string
  tooltipTitle: string
  before: number
  after: number
  beforeFormatted: string
  afterFormatted: string
  diffFormatted: string
  pctFormatted: string
  /** True when increase is positive (sales, profit, orders, aov); false when decrease is positive (expenses, voids). */
  higherIsBetter?: boolean
  extraLines?: TooltipLine[]
}

/** Tooltip text tones — always rendered on pure #FFFFFF [role="tooltip"] surface in both themes */
const TOOLTIP_TONE_CLS: Record<NonNullable<TooltipLine['tone']>, string> = {
  neutral: 'text-slate-950',
  emerald: 'text-emerald-700',
  rose: 'text-rose-600',
  amber: 'text-amber-700',
  slate: 'text-slate-500',
}

/**
 * Side-by-side interactive Before vs After Skerry Capsule Bar Chart.
 * Muted slate (#CBD5E1) for Before vs Crisp Emerald (#10B981) / Deep Slate (#0B1220) for After.
 * Hovering any bar group pops up a crisp white tooltip with exact Before, After, +/- diff, and % change.
 */
export function BeforeAfterDualBarChart({
  data,
  isAr,
  beforeLegend,
  afterLegend,
  formatAxisValue,
  heightClass = 'h-72',
}: {
  data: DualBarDatum[]
  isAr: boolean
  beforeLegend: string
  afterLegend: string
  formatAxisValue?: (v: number) => string
  heightClass?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const isTouchRef = useRef(false)

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [
      Number.isFinite(d.before) ? Math.max(0, d.before) : 0,
      Number.isFinite(d.after) ? Math.max(0, d.after) : 0,
    ]),
  )

  const fmtAxis = formatAxisValue ?? ((v: number) => formatCompactKwdTick(v, isAr))

  const activeDatum = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative select-none space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
            <span className="h-3 w-3 rounded-full bg-[#CBD5E1] dark:bg-slate-500" />
            {beforeLegend}
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="h-3 w-3 rounded-full bg-[#10B981]" />
            {afterLegend}
          </span>
        </div>
      </div>

      {/* Plot Canvas */}
      <div className="ae-bento-subcard relative rounded-2xl bg-[#F4F6F9] px-2.5 py-3.5 pt-6 sm:p-4 sm:pt-6">
        {/* Horizontal subtle guide lines */}
        <div className="pointer-events-none absolute inset-x-2.5 sm:inset-x-4 top-6 bottom-11 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-slate-200/80 dark:border-white/[0.06]"
            >
              <span
                dir={isAr ? 'rtl' : 'ltr'}
                className="-translate-y-2 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
              >
                {fmtAxis(maxVal * ratio)}
              </span>
            </div>
          ))}
        </div>

        {/* Floating Rich White Tooltip (mobile-clamped inside 390px viewport) */}
        {activeDatum && hoveredIdx !== null ? (
          <div
            role="tooltip"
            style={{
              insetInlineStart: `clamp(128px, ${(((hoveredIdx + 0.5) / Math.max(1, data.length)) * 100).toFixed(1)}%, calc(100% - 128px))`,
            }}
            className="pointer-events-none absolute top-2 z-30 w-56 sm:w-64 max-w-[calc(100%-16px)] -translate-x-1/2 rounded-2xl bg-white p-3 sm:p-3.5 text-[12px] sm:text-[12.5px] text-slate-950 shadow-lg ring-1 ring-slate-900/5 transition-all duration-100 rtl:translate-x-1/2"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="whitespace-normal break-words font-extrabold text-slate-950">{activeDatum.tooltipTitle}</span>
              {(() => {
                const rawDelta = activeDatum.after - activeDatum.before
                const higherGood = activeDatum.higherIsBetter !== false
                const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
                return (
                  <span
                    dir="ltr"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${
                      isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {activeDatum.pctFormatted}
                  </span>
                )
              })()}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                  {isAr ? 'الرقم قبل:' : 'Before:'}
                </span>
                <span dir="ltr" className="font-bold tabular-nums text-slate-700">
                  {activeDatum.beforeFormatted}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  {isAr ? 'الرقم بعد:' : 'After:'}
                </span>
                <span dir="ltr" className="font-extrabold tabular-nums text-slate-950">
                  {activeDatum.afterFormatted}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-semibold text-slate-500">{isAr ? 'الفرق:' : 'Change:'}</span>
                {(() => {
                  const rawDelta = activeDatum.after - activeDatum.before
                  const higherGood = activeDatum.higherIsBetter !== false
                  const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
                  return (
                    <span
                      dir="ltr"
                      className={`font-extrabold tabular-nums ${
                        isGood ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {activeDatum.diffFormatted}
                    </span>
                  )
                })()}
              </div>

              {activeDatum.extraLines?.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-slate-500">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                      TOOLTIP_TONE_CLS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Skerry Rounded Capsule Bars Row */}
        <div className={`relative z-10 flex ${heightClass} items-end gap-1 ps-11 pt-6 sm:gap-2.5 sm:ps-12`}>
          {data.map((d, idx) => {
            const bPct = Math.max(4, Math.min(100, (Math.max(0, d.before) / maxVal) * 100))
            const aPct = Math.max(4, Math.min(100, (Math.max(0, d.after) / maxVal) * 100))
            const rawDelta = d.after - d.before
            const higherGood = d.higherIsBetter !== false
            const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
            const isHovered = hoveredIdx === idx
            const displayLabel = formatCompactAxisLabel(d.label)

            return (
              <div
                key={d.id}
                tabIndex={0}
                onPointerMove={(e) => {
                  if (e.pointerType === 'mouse') isTouchRef.current = false
                }}
                onTouchStart={() => {
                  isTouchRef.current = true
                }}
                onMouseEnter={() => {
                  if (!isTouchRef.current) setHoveredIdx(idx)
                }}
                onMouseLeave={() => {
                  if (!isTouchRef.current) setHoveredIdx((cur) => (cur === idx ? null : cur))
                }}
                onFocus={() => {
                  if (!isTouchRef.current) setHoveredIdx(idx)
                }}
                onBlur={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-2xl px-0 pt-2 transition-colors duration-150 focus:outline-none sm:px-1 ${
                  isHovered
                    ? 'bg-white/90 ring-1 ring-emerald-500/30 dark:bg-white/[0.07]'
                    : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex h-full w-full items-end justify-center gap-[2px] sm:gap-1.5">
                  {/* Before Capsule (#CBD5E1) */}
                  <div
                    style={{ height: `${bPct}%` }}
                    className="ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[18px] rounded-full bg-[#CBD5E1] transition-all duration-200 group-hover:bg-slate-400 dark:bg-slate-600"
                  />
                  {/* After Capsule (#10B981 or Rose/Slate) */}
                  <div
                    style={{ height: `${aPct}%` }}
                    className={`ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[18px] rounded-full transition-all duration-200 ${
                      isGood
                        ? 'bg-[#10B981] shadow-[0_4px_12px_-2px_rgba(16,185,129,0.35)] group-hover:bg-emerald-500'
                        : 'bg-[#F43F5E] group-hover:bg-rose-500'
                    }`}
                  />
                </div>
                <div className="mt-2 flex h-4 items-center justify-center">
                  <span
                    dir="ltr"
                    className={`whitespace-nowrap text-center text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 ${
                      data.length > 7
                        ? (idx % 3 === 0 || idx === data.length - 1) && idx !== data.length - 2
                          ? ''
                          : 'hidden sm:inline-block'
                        : ''
                    }`}
                  >
                    {displayLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export interface MultiSeriesBarDatum {
  id: string
  label: string
  tooltipTitle: string
  primaryValue: number
  secondaryValue?: number
  costValue?: number
  badgeText?: string
  badgeTone?: 'emerald' | 'rose' | 'amber' | 'neutral'
  primaryColor?: string
  secondaryColor?: string
  lines: TooltipLine[]
}

/**
 * Interactive Skerry Rounded Capsule Chart for Cash-Flow, Marketing ROI, Sales Timeline, Peak Hours, Menu & Quality.
 * Tapping or hovering any capsule pops up a crisp white tooltip with exact numbers.
 */
export function InteractiveHoverBarChart({
  data,
  isAr,
  primaryLegend,
  secondaryLegend,
  primaryColor = '#0B1220',
  secondaryColor = '#10B981',
  stacked = false,
  formatAxisValue,
  heightClass = 'h-64',
}: {
  data: MultiSeriesBarDatum[]
  isAr: boolean
  primaryLegend: string
  secondaryLegend?: string
  primaryColor?: string
  secondaryColor?: string
  stacked?: boolean
  formatAxisValue?: (v: number) => string
  heightClass?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const isTouchRef = useRef(false)

  const maxVal = Math.max(
    1,
    ...data.map((d) => {
      const p = Number.isFinite(d.primaryValue) ? Math.max(0, d.primaryValue) : 0
      const s = Number.isFinite(d.secondaryValue) ? Math.max(0, d.secondaryValue ?? 0) : 0
      return stacked ? p + s : Math.max(p, s)
    }),
  )

  const fmtAxis = formatAxisValue ?? ((v: number) => formatCompactKwdTick(v, isAr))

  const activeDatum = hoveredIdx !== null ? data[hoveredIdx] : null

  // Normalize ultra-dark #0F172A / #0B1220 primary bars so they stay visible against dark cards too
  const resolvePrimaryColor = (c?: string) => {
    const raw = c ?? primaryColor
    return raw === '#0F172A' || raw === '#0B1220' ? '#334155' : raw
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative select-none space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: resolvePrimaryColor() }} />
            {primaryLegend}
          </span>
          {secondaryLegend ? (
            <span className="inline-flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: secondaryColor }} />
              {secondaryLegend}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ae-bento-subcard relative rounded-2xl bg-[#F4F6F9] px-2.5 py-3.5 pt-6 sm:p-4 sm:pt-6">
        {/* Guide lines */}
        <div className="pointer-events-none absolute inset-x-2.5 sm:inset-x-4 top-6 bottom-11 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-slate-200/80 dark:border-white/[0.06]"
            >
              <span
                dir={isAr ? 'rtl' : 'ltr'}
                className="-translate-y-2 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
              >
                {fmtAxis(maxVal * ratio)}
              </span>
            </div>
          ))}
        </div>

        {/* Rich Tap/Hover Tooltip (mobile-clamped inside 390px viewport) */}
        {activeDatum && hoveredIdx !== null ? (
          <div
            role="tooltip"
            style={{
              insetInlineStart: `clamp(128px, ${(((hoveredIdx + 0.5) / Math.max(1, data.length)) * 100).toFixed(1)}%, calc(100% - 128px))`,
            }}
            className="pointer-events-none absolute top-2 z-30 w-56 sm:w-64 max-w-[calc(100%-16px)] -translate-x-1/2 rounded-2xl bg-white p-3 sm:p-3.5 text-[12px] sm:text-[12.5px] text-slate-950 shadow-lg ring-1 ring-slate-900/5 transition-all duration-100 rtl:translate-x-1/2"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="whitespace-normal break-words font-extrabold text-slate-950">{activeDatum.tooltipTitle}</span>
              {activeDatum.badgeText ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                    activeDatum.badgeTone === 'emerald'
                      ? 'bg-emerald-50 text-emerald-700'
                      : activeDatum.badgeTone === 'rose'
                        ? 'bg-rose-50 text-rose-700'
                        : activeDatum.badgeTone === 'amber'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {activeDatum.badgeText}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {activeDatum.lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                      TOOLTIP_TONE_CLS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Skerry Capsule Bars */}
        <div className={`relative z-10 flex ${heightClass} items-end gap-0.5 ps-11 pt-6 sm:gap-2 sm:ps-12`}>
          {data.map((d, idx) => {
            const pVal = Math.max(0, d.primaryValue || 0)
            const sVal = Math.max(0, d.secondaryValue || 0)
            const totalPct = Math.max(4, Math.min(100, ((pVal + sVal) / maxVal) * 100))
            const pHeightPct = Math.max(4, Math.min(100, (pVal / maxVal) * 100))
            const sHeightPct = Math.max(4, Math.min(100, (sVal / maxVal) * 100))
            const pShareInStack = pVal + sVal > 0 ? (pVal / (pVal + sVal)) * 100 : 100
            const sShareInStack = 100 - pShareInStack
            const isHovered = hoveredIdx === idx
            const pColor = resolvePrimaryColor(d.primaryColor)
            const sColor = d.secondaryColor ?? secondaryColor
            const displayLabel = formatCompactAxisLabel(d.label)

            return (
              <div
                key={d.id}
                tabIndex={0}
                onPointerMove={(e) => {
                  if (e.pointerType === 'mouse') isTouchRef.current = false
                }}
                onTouchStart={() => {
                  isTouchRef.current = true
                }}
                onMouseEnter={() => {
                  if (!isTouchRef.current) setHoveredIdx(idx)
                }}
                onMouseLeave={() => {
                  if (!isTouchRef.current) setHoveredIdx((cur) => (cur === idx ? null : cur))
                }}
                onFocus={() => {
                  if (!isTouchRef.current) setHoveredIdx(idx)
                }}
                onBlur={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-2xl px-0 pt-2 transition-colors duration-150 focus:outline-none sm:px-0.5 ${
                  isHovered
                    ? 'bg-white/90 ring-1 ring-emerald-500/30 dark:bg-white/[0.07]'
                    : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                }`}
              >
                {stacked && secondaryLegend ? (
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      style={{ height: `${totalPct}%` }}
                      className="ae-bar-grow flex w-full min-w-[6px] sm:min-w-[10px] max-w-[16px] sm:max-w-[22px] flex-col justify-end overflow-hidden rounded-full"
                    >
                      {sVal > 0 ? (
                        <div
                          style={{
                            height: `${sShareInStack}%`,
                            backgroundColor: sColor,
                          }}
                          className="w-full transition-all duration-150"
                        />
                      ) : null}
                      <div
                        style={{
                          height: `${pShareInStack}%`,
                          backgroundColor: pColor,
                        }}
                        className="w-full transition-all duration-150"
                      />
                    </div>
                  </div>
                ) : secondaryLegend ? (
                  <div className="flex h-full w-full items-end justify-center gap-[2px] sm:gap-1">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: pColor }}
                      className="ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[16px] rounded-full transition-all duration-150"
                    />
                    <div
                      style={{ height: `${sHeightPct}%`, backgroundColor: sColor }}
                      className="ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[16px] rounded-full transition-all duration-150"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: pColor }}
                      className="ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[16px] sm:max-w-[22px] rounded-full transition-all duration-150 group-hover:opacity-90"
                    />
                  </div>
                )}

                <div className="mt-2 flex h-4 items-center justify-center">
                  <span
                    dir="ltr"
                    className={`whitespace-nowrap text-center text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 ${
                      data.length > 7
                        ? (idx % 3 === 0 || idx === data.length - 1) && idx !== data.length - 2
                          ? ''
                          : 'hidden sm:inline-block'
                        : ''
                    }`}
                  >
                    {displayLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export interface ComboBarLineDatum {
  id: string
  label: string
  tooltipTitle: string
  salesKwd: number
  netKwd: number
  netMarginPct: number
  lines: TooltipLine[]
}

/**
 * Dual-Scale Combo Bar + Line Chart for `/erp` (`المبيعات والصافي بالجيب` / `Sales & Net in Pocket`).
 * - Sales (`المبيعات`): soft slate rounded vertical bars (`#CBD5E1` light / `#334155` dark, active `#94A3B8`) on the start Y-axis (right in RTL, left in LTR).
 * - Net in Pocket (`الصافي بالجيب`): bold Emerald SVG line (`#10B981`, `strokeWidth={2.5}`) + circular data dots (`r={3.5}` / `r={5}` on active with `#FFFFFF` ring)
 *   scaled against its own dedicated Net Profit Y-axis (`minNet..maxNet * 1.18`) on the end Y-axis (left in RTL, right in LTR).
 */
export function SalesNetComboChart({
  data,
  isAr,
  salesLegend,
  netLegend,
  heightClass = 'h-60',
}: {
  data: ComboBarLineDatum[]
  isAr: boolean
  salesLegend: string
  netLegend: string
  heightClass?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const isTouchRef = useRef(false)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [plotSize, setPlotSize] = useState<{ w: number; h: number }>({ w: 640, h: 240 })
  const gradId = useId().replace(/:/g, '')

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setPlotSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [data.length])

  const n = Math.max(1, data.length)
  const maxSales = Math.max(
    1,
    ...data.map((d) => (Number.isFinite(d.salesKwd) ? Math.max(0, d.salesKwd) : 0)),
  )

  const netValues = data.map((d) => (Number.isFinite(d.netKwd) ? Math.max(0, d.netKwd) : 0))
  const rawMinNet = netValues.length > 0 ? Math.min(...netValues) : 0
  const rawMaxNet = netValues.length > 0 ? Math.max(...netValues) : 1
  const minNet =
    data.length > 1 && rawMaxNet - rawMinNet * 0.65 > 1 ? Math.max(0, rawMinNet * 0.65) : 0
  const maxNetAxis = Math.max(minNet + 1, rawMaxNet * 1.18)
  const netSpan = Math.max(1, maxNetAxis - minNet)

  const points = data.map((d, idx) => {
    const safeNet = Number.isFinite(d.netKwd) ? Math.max(0, d.netKwd) : 0
    // In RTL CSS grid, column 0 is on the right; in LTR, column 0 is on the left.
    const xFrac = isAr ? (n - 1 - idx + 0.5) / n : (idx + 0.5) / n
    const yNorm = Math.max(0.06, Math.min(0.94, (safeNet - minNet) / netSpan))
    return {
      idx,
      x: xFrac * plotSize.w,
      y: (1 - yNorm) * plotSize.h,
    }
  })

  const linePath =
    points.length > 1
      ? points
          .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
          .join(' ')
      : points.length === 1
        ? `M 0 ${points[0].y.toFixed(1)} L ${plotSize.w.toFixed(1)} ${points[0].y.toFixed(1)}`
        : ''

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${plotSize.h} L ${points[0].x.toFixed(1)} ${plotSize.h} Z`
      : ''

  const activeDatum = hoveredIdx !== null ? data[hoveredIdx] : null
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null
  const axisRatios = [1, 0.75, 0.5, 0.25, 0] as const

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative select-none space-y-3">
      {/* Legend & Dual-Scale Key */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <span className="h-3 w-2.5 rounded-sm bg-[#CBD5E1] ring-1 ring-slate-400/30 dark:bg-[#334155]" />
            <span>{salesLegend}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              ({isAr ? 'المحور الأيمن' : 'Left Axis'})
            </span>
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
            <span className="relative inline-flex h-3 w-5 items-center justify-center">
              <span className="h-[2.5px] w-full rounded-full bg-[#10B981]" />
              <span className="absolute h-2 w-2 rounded-full bg-[#10B981] ring-1 ring-white" />
            </span>
            <span>{netLegend}</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              ({isAr ? 'المحور الأيسر المستقل' : 'Right Axis'})
            </span>
          </span>
        </div>
      </div>

      {/* Dual-Axis Plot Card */}
      <div className="ae-bento-subcard relative rounded-2xl bg-[#F4F6F9] px-2.5 py-3.5 pt-4 sm:p-4 sm:pt-4 dark:bg-white/[0.03]">
        {/* Floating Interactive White Tooltip */}
        {activeDatum && hoveredIdx !== null ? (
          <div
            role="tooltip"
            style={{
              insetInlineStart: `clamp(132px, ${(((hoveredIdx + 0.5) / n) * 100).toFixed(1)}%, calc(100% - 132px))`,
            }}
            className="pointer-events-none absolute top-2 z-30 w-60 sm:w-64 max-w-[calc(100%-16px)] -translate-x-1/2 rounded-2xl bg-white p-3 sm:p-3.5 text-[12px] sm:text-[12.5px] text-slate-950 shadow-lg ring-1 ring-slate-900/5 transition-all duration-100 rtl:translate-x-1/2"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="font-extrabold text-slate-950">{activeDatum.tooltipTitle}</span>
              <span
                dir="ltr"
                className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-extrabold tabular-nums text-emerald-700"
              >
                {activeDatum.netMarginPct.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1.5">
              {activeDatum.lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                      TOOLTIP_TONE_CLS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Explicit Y-Axis Unit Titles: Sales (K KWD / ألف د.ك) & Net Profit (K KWD / ألف د.ك) */}
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="whitespace-nowrap font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'المبيعات (ألف د.ك)' : 'Sales (K KWD)'}
          </span>
          <span className="whitespace-nowrap font-bold text-emerald-700 dark:text-emerald-400">
            {isAr ? 'الصافي بالجيب (ألف د.ك)' : 'Net Profit (K KWD)'}
          </span>
        </div>

        {/* 3-Column Dual-Scale Grid: [Start=Sales Axis] [Center=Bars+Line Plot] [End=Emerald Net Axis] */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-1.5 sm:gap-2.5">
          {/* Start Y-Axis: Sales Scale (Right in RTL, Left in LTR) */}
          <div className="flex flex-col justify-between pb-6 pt-1 text-start">
            {axisRatios.map((ratio) => (
              <span
                key={`sales-${ratio}`}
                dir={isAr ? 'rtl' : 'ltr'}
                className="whitespace-nowrap text-xs font-semibold leading-none tabular-nums text-slate-600 dark:text-slate-300"
              >
                {formatCompactKwdTick(maxSales * ratio, isAr)}
              </span>
            ))}
          </div>

          {/* Center Plot Column: Guide Lines + Equal-Width Grid Bars + SVG Net Profit Line + X-Axis Labels */}
          <div className="min-w-0">
            <div ref={plotRef} className={`relative ${heightClass} w-full`}>
              {/* Horizontal Guide Lines */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                {axisRatios.map((ratio) => (
                  <div
                    key={`guide-${ratio}`}
                    className="w-full border-b border-dashed border-slate-200/90 dark:border-white/[0.07]"
                  />
                ))}
              </div>

              {/* Sales Vertical Rounded Bars in Equal-Width Grid (guarantees 0.00px alignment with SVG points) */}
              <div
                style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
                className="relative z-10 grid h-full w-full items-end"
              >
                {data.map((d, idx) => {
                  const sVal = Math.max(0, d.salesKwd || 0)
                  const sHeightPct = Math.max(4, Math.min(100, (sVal / maxSales) * 100))
                  const isHovered = hoveredIdx === idx

                  return (
                    <div
                      key={d.id}
                      tabIndex={0}
                      onPointerMove={(e) => {
                        if (e.pointerType === 'mouse') isTouchRef.current = false
                      }}
                      onTouchStart={() => {
                        isTouchRef.current = true
                      }}
                      onMouseEnter={() => {
                        if (!isTouchRef.current) setHoveredIdx(idx)
                      }}
                      onMouseLeave={() => {
                        if (!isTouchRef.current) setHoveredIdx((cur) => (cur === idx ? null : cur))
                      }}
                      onFocus={() => {
                        if (!isTouchRef.current) setHoveredIdx(idx)
                      }}
                      onBlur={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                      onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                      className={`group flex h-full min-w-0 cursor-pointer items-end justify-center rounded-xl px-[1.5px] sm:px-1 transition-colors duration-150 focus:outline-none ${
                        isHovered ? 'bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]' : ''
                      }`}
                    >
                      <div
                        style={{ height: `${sHeightPct}%` }}
                        className={`ae-bar-grow w-full min-w-[6px] sm:min-w-[10px] max-w-[20px] rounded-t-lg rounded-b-[3px] transition-all duration-150 ${
                          isHovered
                            ? 'bg-[#94A3B8] dark:bg-[#94A3B8]'
                            : 'bg-[#CBD5E1] group-hover:bg-[#94A3B8] dark:bg-[#334155] dark:group-hover:bg-[#64748B]'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Bold Emerald Net Profit SVG Line + Circular Dots Overlay */}
              <svg
                viewBox={`0 0 ${plotSize.w} ${plotSize.h}`}
                className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id={`netArea-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {areaPath ? <path d={areaPath} fill={`url(#netArea-${gradId})`} /> : null}

                {activePoint ? (
                  <line
                    x1={activePoint.x}
                    y1={0}
                    x2={activePoint.x}
                    y2={plotSize.h}
                    stroke="#10B981"
                    strokeOpacity="0.35"
                    strokeDasharray="3 3"
                    strokeWidth={1.25}
                  />
                ) : null}

                {linePath ? (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {points.map((pt) => {
                  const isActive = hoveredIdx === pt.idx
                  return (
                    <circle
                      key={`dot-${data[pt.idx]?.id ?? pt.idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? 5 : 3.5}
                      fill={isActive ? '#059669' : '#10B981'}
                      stroke="#FFFFFF"
                      strokeWidth={isActive ? 2 : 1.5}
                    />
                  )
                })}
              </svg>
            </div>

            {/* X-Axis Labels Row (DD/MM compact dates with < sm mobile tick thinning) */}
            <div
              style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
              className="mt-2 grid h-4 items-center"
            >
              {data.map((d, idx) => {
                const displayLabel = formatCompactAxisLabel(d.label)
                return (
                  <div key={`lbl-${d.id}`} className="flex items-center justify-center">
                    <span
                      dir={/^\d/.test(displayLabel) ? 'ltr' : undefined}
                      className={`whitespace-nowrap text-center text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 ${
                        data.length > 7
                          ? (idx % 3 === 0 || idx === data.length - 1) && idx !== data.length - 2
                            ? ''
                            : 'hidden sm:inline-block'
                          : ''
                      }`}
                    >
                      {displayLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* End Y-Axis: Dedicated Emerald Net Profit Scale (Left in RTL, Right in LTR) */}
          <div className="flex flex-col justify-between pb-6 pt-1 text-end">
            {axisRatios.map((ratio) => (
              <span
                key={`net-${ratio}`}
                dir={isAr ? 'rtl' : 'ltr'}
                className="whitespace-nowrap text-xs font-bold leading-none tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {formatCompactKwdTick(minNet + netSpan * ratio, isAr)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export interface HorizontalRankDatum {
  id: string
  label: string
  subLabel?: string
  value: number
  valueFormatted: string
  color?: string
  barClassName?: string
  dotClassName?: string
  badgeText?: string
  active?: boolean
  lines: TooltipLine[]
}

/**
 * Interactive Horizontal Skerry Capsule Ranking Bars with floating white tooltip on hover
 * and optional click-to-filter selection.
 */
export function InteractiveHorizontalRankList({
  items,
  isAr,
  onSelect,
}: {
  items: HorizontalRankDatum[]
  isAr: boolean
  onSelect?: (id: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const maxVal = Math.max(1, ...items.map((x) => (Number.isFinite(x.value) ? Math.max(0, x.value) : 0)))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-2.5">
      {items.map((item) => {
        const safeVal = Number.isFinite(item.value) ? Math.max(0, item.value) : 0
        const widthPct = safeVal > 0 ? Math.max(3, Math.min(100, (safeVal / maxVal) * 100)) : 0
        const isHovered = hoveredId === item.id
        const isInteractive = typeof onSelect === 'function'

        return (
          <div
            key={item.id}
            role={isInteractive ? 'button' : undefined}
            aria-pressed={isInteractive ? Boolean(item.active) : undefined}
            tabIndex={0}
            onClick={isInteractive ? () => onSelect(item.id) : undefined}
            onKeyDown={
              isInteractive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(item.id)
                    }
                  }
                : undefined
            }
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            onFocus={() => setHoveredId(item.id)}
            onBlur={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            className={`relative rounded-xl p-3 transition-all duration-[180ms] focus:outline-none ${
              isInteractive ? 'cursor-pointer' : ''
            } ${
              item.active
                ? 'bg-emerald-50/80 ring-1 ring-emerald-500/50 dark:bg-emerald-950/40 dark:ring-emerald-400/40'
                : 'ae-bento-subcard bg-[#F7F7F8] hover:bg-neutral-100 dark:hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-start justify-between gap-2 text-[13px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {item.dotClassName ? (
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClassName}`} />
                  ) : item.color ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  ) : null}
                  <span className="whitespace-normal break-words font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {item.label}
                  </span>
                  {item.active ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {isAr ? 'مفعل' : 'Active'}
                    </span>
                  ) : null}
                </div>
                {item.subLabel ? (
                  <p
                    dir="ltr"
                    className={`mt-0.5 whitespace-normal break-words text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300 ${
                      isAr ? 'text-end' : 'text-start'
                    }`}
                  >
                    {item.subLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.badgeText ? (
                  <span
                    dir="ltr"
                    className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/10 dark:text-slate-200"
                  >
                    {item.badgeText}
                  </span>
                ) : null}
                <span
                  dir="ltr"
                  className="font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
                >
                  {item.valueFormatted}
                </span>
              </div>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-white/[0.08]">
              <div
                style={{
                  width: `${widthPct}%`,
                  ...(item.barClassName ? {} : { backgroundColor: item.color ?? '#10B981' }),
                }}
                className={`h-full rounded-full transition-all duration-[180ms] ${
                  item.barClassName ?? ''
                }`}
              />
            </div>

            {isHovered ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute inset-x-3 bottom-full z-30 mb-1.5 rounded-2xl bg-white p-3 text-[12px] text-slate-950"
              >
                <div className="mb-1.5 font-semibold text-slate-950">{item.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {item.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">{line.label}</span>
                      <span
                        dir="ltr"
                        className={`tabular-nums ${line.bold ? 'font-bold' : 'font-medium'} ${
                          TOOLTIP_TONE_CLS[line.tone ?? 'neutral']
                        }`}
                      >
                        {line.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export interface DonutSliceDatum {
  id: string
  label: string
  value: number
  valueFormatted: string
  pctFormatted: string
  color: string
  subLabel?: string
}

export interface DonutSummaryPill {
  label: string
  value: string
  tone?: 'emerald' | 'neutral' | 'amber' | 'rose'
}

/**
 * Finance V2 Signature Interactive Circular Donut Ring + Pill Legend Breakdown.
 * Center container is strictly bounded (`max-w-[62%]` outer guard + `104px` circular safe zone inside a `140px` inner ring diameter with `tabular-nums`)
 * so zero characters ever touch or collide with the SVG ring stroke.
 */
export function InteractiveDonutChart({
  slices,
  centerValue,
  centerSubValue,
  centerLabel,
  summaryPill,
  summaryRows,
  activeSliceId,
  onSelectSlice,
  isAr,
  legendColumns = 2,
  legendLayout = 'below',
}: {
  slices: DonutSliceDatum[]
  centerValue: string
  centerSubValue?: string
  centerLabel?: string
  summaryPill?: DonutSummaryPill
  summaryRows?: DonutSummaryPill[]
  activeSliceId?: string
  onSelectSlice?: (id: string) => void
  isAr: boolean
  legendColumns?: 1 | 2
  legendLayout?: 'below' | 'beside'
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const positiveSlices = slices.map((s) => ({
    ...s,
    safeVal: Number.isFinite(s.value) ? Math.max(0, s.value) : 0,
  }))
  const total = Math.max(0.0001, positiveSlices.reduce((acc, s) => acc + s.safeVal, 0))

  // 192x192 SVG with r=78 and strokeWidth=13..15 => inner clear diameter = 141px (zero stroke collision)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  const activeCount = positiveSlices.filter((s) => s.safeVal > 0).length
  const gapPx = activeCount > 1 ? 3 : 0

  let cumulativeFraction = 0
  const arcs = positiveSlices.map((s) => {
    const frac = s.safeVal / total
    const rawLen = frac * circumference
    const len = s.safeVal > 0 ? Math.max(2, rawLen - gapPx) : 0
    const offset = -cumulativeFraction * circumference
    cumulativeFraction += frac
    return { ...s, len, offset }
  })

  const hoveredSlice = hoveredId ? slices.find((s) => s.id === hoveredId) ?? null : null
  const activeCenterText = hoveredSlice ? hoveredSlice.pctFormatted : centerValue
  const centerFontCls =
    activeCenterText.length > 8
      ? 'text-[15px]'
      : activeCenterText.length > 6
        ? 'text-[18px]'
        : 'text-[22px]'

  const resolvePillToneCls = (tone?: DonutSummaryPill['tone']) =>
    tone === 'amber'
      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-200'
      : tone === 'rose'
        ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/45 dark:text-rose-200'
        : tone === 'neutral'
          ? 'bg-[#F7F7F8] text-neutral-800 dark:bg-white/[0.05] dark:text-slate-200'
          : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'

  const resolveValToneCls = (tone?: DonutSummaryPill['tone']) =>
    tone === 'amber'
      ? 'text-amber-800 dark:text-amber-300'
      : tone === 'rose'
        ? 'text-rose-700 dark:text-rose-300'
        : tone === 'neutral'
          ? 'text-neutral-950 dark:text-white'
          : 'text-emerald-700 dark:text-emerald-300'

  const allSummaryRows: DonutSummaryPill[] = summaryRows
    ? summaryRows
    : summaryPill
      ? [summaryPill]
      : []

  const ringBlock = (
    <div className="relative mx-auto flex h-48 w-48 shrink-0 items-center justify-center">
      <svg viewBox="0 0 192 192" className="h-full w-full overflow-visible">
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="13"
          className="text-neutral-100 dark:text-white/[0.06]"
        />
        {arcs.map((arc) => {
          if (arc.len <= 0) return null
          const isHovered = hoveredId === arc.id || activeSliceId === arc.id
          const isDimmed = hoveredId !== null && hoveredId !== arc.id
          return (
            <circle
              key={arc.id}
              cx="96"
              cy="96"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={isHovered ? 15.5 : 13}
              strokeDasharray={`${arc.len} ${circumference}`}
              strokeDashoffset={arc.offset}
              transform="rotate(-90 96 96)"
              onMouseEnter={() => setHoveredId(arc.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === arc.id ? null : cur))}
              onClick={onSelectSlice ? () => onSelectSlice(arc.id) : undefined}
              className="cursor-pointer transition-all duration-[180ms]"
              style={{ opacity: isDimmed ? 0.42 : 1 }}
            />
          )
        })}
      </svg>

      {/* Strictly Padded Circular Center Safe Zone: 102px inside 141px clear ring (>19px radial padding all around) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="mx-auto flex h-[102px] w-[102px] max-w-[62%] flex-col items-center justify-center rounded-full px-1.5 text-center tabular-nums">
          <span
            dir="ltr"
            className={`${centerFontCls} max-w-[92px] whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums text-neutral-950 dark:text-white`}
          >
            {activeCenterText}
          </span>
          {centerSubValue && !hoveredSlice ? (
            <span
              dir={isAr ? 'rtl' : 'ltr'}
              className="mt-1 max-w-[92px] whitespace-nowrap text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
            >
              {centerSubValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span className="mt-1.5 max-w-[92px] whitespace-normal text-xs font-semibold leading-tight text-slate-600 dark:text-slate-300">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )

  const legendBlock = (
    <div
      className={`min-w-0 grid gap-2 ${
        legendLayout === 'beside'
          ? 'grid-cols-1'
          : legendColumns === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1'
      }`}
    >
      {slices.map((s) => {
        const isHovered = hoveredId === s.id
        const isSelected = activeSliceId === s.id
        return (
          <div
            key={s.id}
            role={onSelectSlice ? 'button' : undefined}
            aria-pressed={onSelectSlice ? isSelected : undefined}
            tabIndex={0}
            onClick={onSelectSlice ? () => onSelectSlice(s.id) : undefined}
            onKeyDown={
              onSelectSlice
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectSlice(s.id)
                    }
                  }
                : undefined
            }
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
            onFocus={() => setHoveredId(s.id)}
            onBlur={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
            className={`ae-bento-subcard flex cursor-pointer flex-col justify-center gap-1 rounded-xl px-3 py-2.5 transition-all duration-150 focus:outline-none ${
              isSelected
                ? 'bg-emerald-50/90 ring-1 ring-emerald-500/50 dark:bg-emerald-950/45 dark:ring-emerald-400/40'
                : isHovered
                  ? 'bg-white ring-1 ring-emerald-500/40 dark:bg-white/[0.08]'
                  : 'bg-[#F7F7F8] hover:bg-neutral-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <p className="whitespace-normal text-[12.5px] font-semibold leading-snug text-neutral-900 dark:text-slate-100">
                  {s.label}
                </p>
              </div>
              <span
                dir="ltr"
                className="shrink-0 text-[12px] font-bold tabular-nums text-neutral-950 dark:text-white"
              >
                {s.valueFormatted}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 ps-4.5">
              {s.subLabel ? (
                <p className="whitespace-normal text-xs font-medium leading-snug text-slate-600 dark:text-slate-300 tabular-nums">
                  {s.subLabel}
                </p>
              ) : (
                <span />
              )}
              <span
                dir="ltr"
                className="shrink-0 rounded-md bg-white/80 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
              >
                {s.pctFormatted}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (legendLayout === 'beside') {
    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="grid grid-cols-1 sm:grid-cols-[185px_minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)] items-center gap-5"
      >
        {ringBlock}
        {legendBlock}
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col justify-between gap-3.5">
      {ringBlock}

      {/* Dedicated KWD Summary Rows Beneath the Ring */}
      {allSummaryRows.length > 0 ? (
        <div className="space-y-1.5">
          {hoveredSlice ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/90 px-3.5 py-2 text-xs text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-200">
              <span className="whitespace-normal font-medium">{hoveredSlice.label}</span>
              <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {hoveredSlice.valueFormatted} ({hoveredSlice.pctFormatted})
              </span>
            </div>
          ) : null}
          {allSummaryRows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs ${resolvePillToneCls(
                row.tone,
              )}`}
            >
              <span className="whitespace-normal font-medium">{row.label}</span>
              <span dir="ltr" className={`shrink-0 font-semibold tabular-nums ${resolveValToneCls(row.tone)}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {legendBlock}
    </div>
  )
}
