'use client'

import React, { useState } from 'react'

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

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [
      Number.isFinite(d.before) ? Math.max(0, d.before) : 0,
      Number.isFinite(d.after) ? Math.max(0, d.after) : 0,
    ]),
  )

  const fmtAxis =
    formatAxisValue ??
    ((v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString('en-US')))

  const activeDatum = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative select-none space-y-3">
      {/* Legend + Live Active Readout */}
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
        <span className="text-[12px] font-medium text-slate-400 dark:text-slate-400">
          {isAr ? 'مرّر الماوس على أي عمود لعرض الأرقام الدقيقة' : 'Hover any capsule for exact numbers'}
        </span>
      </div>

      {/* Plot Canvas */}
      <div className="ae-bento-subcard relative rounded-2xl bg-[#F4F6F9] p-4 pt-6">
        {/* Horizontal subtle guide lines */}
        <div className="pointer-events-none absolute inset-x-4 top-6 bottom-11 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-slate-200/80 dark:border-white/[0.06]"
            >
              <span
                dir="ltr"
                className="-translate-y-2 text-[10.5px] font-semibold tabular-nums text-slate-400 dark:text-slate-500"
              >
                {fmtAxis(maxVal * ratio)}
              </span>
            </div>
          ))}
        </div>

        {/* Floating Rich White Tooltip */}
        {activeDatum && hoveredIdx !== null ? (
          <div
            role="tooltip"
            style={{
              insetInlineStart: `${Math.min(82, Math.max(18, ((hoveredIdx + 0.5) / Math.max(1, data.length)) * 100))}%`,
            }}
            className="pointer-events-none absolute top-2 z-30 w-64 -translate-x-1/2 rounded-2xl bg-white p-3.5 text-[12.5px] text-slate-950 transition-all duration-100 rtl:translate-x-1/2"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="truncate font-extrabold text-slate-950">{activeDatum.tooltipTitle}</span>
              {(() => {
                const rawDelta = activeDatum.after - activeDatum.before
                const higherGood = activeDatum.higherIsBetter !== false
                const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
                return (
                  <span
                    dir="ltr"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
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
                <div key={line.label} className="flex items-center justify-between gap-2 text-[11.5px]">
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
        <div className={`relative z-10 flex ${heightClass} items-end gap-1.5 ps-10 pt-6 sm:gap-2.5`}>
          {data.map((d, idx) => {
            const bPct = Math.max(4, Math.min(100, (Math.max(0, d.before) / maxVal) * 100))
            const aPct = Math.max(4, Math.min(100, (Math.max(0, d.after) / maxVal) * 100))
            const rawDelta = d.after - d.before
            const higherGood = d.higherIsBetter !== false
            const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
            const isHovered = hoveredIdx === idx

            return (
              <div
                key={d.id}
                tabIndex={0}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => setHoveredIdx(idx)}
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-2xl px-1 pt-2 transition-colors duration-150 focus:outline-none ${
                  isHovered
                    ? 'bg-white/90 ring-1 ring-emerald-500/30 dark:bg-white/[0.07]'
                    : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex h-full items-end justify-center gap-1 sm:gap-1.5">
                  {/* Before Capsule (#CBD5E1) */}
                  <div
                    style={{ height: `${bPct}%` }}
                    className="ae-bar-grow w-full max-w-[18px] rounded-t-full rounded-b-md bg-[#CBD5E1] transition-all duration-200 group-hover:bg-slate-400 dark:bg-slate-600"
                  />
                  {/* After Capsule (#10B981 or Rose/Slate) */}
                  <div
                    style={{ height: `${aPct}%` }}
                    className={`ae-bar-grow w-full max-w-[18px] rounded-t-full rounded-b-md transition-all duration-200 ${
                      isGood
                        ? 'bg-[#10B981] shadow-[0_4px_12px_-2px_rgba(16,185,129,0.35)] group-hover:bg-emerald-500'
                        : 'bg-[#F43F5E] group-hover:bg-rose-500'
                    }`}
                  />
                </div>
                <div className="mt-2 truncate text-center text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {d.label}
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
 * Hovering any capsule pops up a crisp white tooltip with exact numbers.
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

  const maxVal = Math.max(
    1,
    ...data.map((d) => {
      const p = Number.isFinite(d.primaryValue) ? Math.max(0, d.primaryValue) : 0
      const s = Number.isFinite(d.secondaryValue) ? Math.max(0, d.secondaryValue ?? 0) : 0
      return stacked ? p + s : Math.max(p, s)
    }),
  )

  const fmtAxis =
    formatAxisValue ??
    ((v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString('en-US')))

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
        <span className="text-[12px] font-medium text-slate-400 dark:text-slate-400">
          {isAr ? 'مرّر الماوس على أي عمود لعرض الأرقام' : 'Hover any capsule for exact numbers'}
        </span>
      </div>

      <div className="ae-bento-subcard relative rounded-2xl bg-[#F4F6F9] p-4 pt-6">
        {/* Guide lines */}
        <div className="pointer-events-none absolute inset-x-4 top-6 bottom-11 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-slate-200/80 dark:border-white/[0.06]"
            >
              <span
                dir="ltr"
                className="-translate-y-2 text-[10.5px] font-semibold tabular-nums text-slate-400 dark:text-slate-500"
              >
                {fmtAxis(maxVal * ratio)}
              </span>
            </div>
          ))}
        </div>

        {/* Rich Hover Tooltip */}
        {activeDatum && hoveredIdx !== null ? (
          <div
            role="tooltip"
            style={{
              insetInlineStart: `${Math.min(82, Math.max(18, ((hoveredIdx + 0.5) / Math.max(1, data.length)) * 100))}%`,
            }}
            className="pointer-events-none absolute top-2 z-30 w-64 -translate-x-1/2 rounded-2xl bg-white p-3.5 text-[12.5px] text-slate-950 transition-all duration-100 rtl:translate-x-1/2"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="truncate font-extrabold text-slate-950">{activeDatum.tooltipTitle}</span>
              {activeDatum.badgeText ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
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
        <div className={`relative z-10 flex ${heightClass} items-end gap-1 ps-10 pt-6 sm:gap-2`}>
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

            return (
              <div
                key={d.id}
                tabIndex={0}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
                onClick={() => setHoveredIdx(idx)}
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-2xl px-0.5 pt-2 transition-colors duration-150 focus:outline-none ${
                  isHovered
                    ? 'bg-white/90 ring-1 ring-emerald-500/30 dark:bg-white/[0.07]'
                    : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                }`}
              >
                {stacked && secondaryLegend ? (
                  <div className="flex h-full items-end justify-center">
                    <div
                      style={{ height: `${totalPct}%` }}
                      className="ae-bar-grow flex w-full max-w-[22px] flex-col justify-end overflow-hidden rounded-t-full rounded-b-md"
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
                  <div className="flex h-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: pColor }}
                      className="ae-bar-grow w-full max-w-[16px] rounded-t-full rounded-b-md transition-all duration-150"
                    />
                    <div
                      style={{ height: `${sHeightPct}%`, backgroundColor: sColor }}
                      className="ae-bar-grow w-full max-w-[16px] rounded-t-full rounded-b-md transition-all duration-150"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-end justify-center">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: pColor }}
                      className="ae-bar-grow w-full max-w-[22px] rounded-t-full rounded-b-md transition-all duration-150 group-hover:opacity-90"
                    />
                  </div>
                )}

                <div className="mt-2 truncate text-center text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
                  {d.label}
                </div>
              </div>
            )
          })}
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
                  <span className="truncate font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {item.label}
                  </span>
                  {item.active ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {isAr ? 'مفعل' : 'Active'}
                    </span>
                  ) : null}
                </div>
                {item.subLabel ? (
                  <p
                    dir="ltr"
                    className={`mt-0.5 truncate text-[11.5px] tabular-nums text-neutral-500 dark:text-slate-400 ${
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
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/10 dark:text-slate-200"
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
  tone?: 'emerald' | 'neutral' | 'amber'
}

/**
 * Finance V2 Signature Interactive Circular Donut Ring + Pill Legend Breakdown.
 * Center container is strictly bounded (`max-w-[62%]` centered flex column with `tabular-nums`)
 * so zero characters ever touch or collide with the SVG ring stroke.
 */
export function InteractiveDonutChart({
  slices,
  centerValue,
  centerSubValue,
  centerLabel,
  summaryPill,
  isAr,
  legendColumns = 2,
}: {
  slices: DonutSliceDatum[]
  centerValue: string
  centerSubValue?: string
  centerLabel: string
  summaryPill?: DonutSummaryPill
  isAr: boolean
  legendColumns?: 1 | 2
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const positiveSlices = slices.map((s) => ({
    ...s,
    safeVal: Number.isFinite(s.value) ? Math.max(0, s.value) : 0,
  }))
  const total = Math.max(0.0001, positiveSlices.reduce((acc, s) => acc + s.safeVal, 0))

  const radius = 71
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
    activeCenterText.length > 9
      ? 'text-[14px]'
      : activeCenterText.length > 6
        ? 'text-[16.5px]'
        : 'text-[22px]'

  const summaryToneCls =
    summaryPill?.tone === 'amber'
      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-200'
      : summaryPill?.tone === 'neutral'
        ? 'bg-[#F7F7F8] text-neutral-800 dark:bg-white/[0.05] dark:text-slate-200'
        : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'

  const summaryValCls =
    summaryPill?.tone === 'amber'
      ? 'text-amber-800 dark:text-amber-300'
      : summaryPill?.tone === 'neutral'
        ? 'text-neutral-950 dark:text-white'
        : 'text-emerald-700 dark:text-emerald-300'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col justify-between gap-3.5">
      {/* Circular Donut Ring */}
      <div className="relative mx-auto flex h-44 w-44 sm:h-48 sm:w-48 items-center justify-center">
        <svg viewBox="0 0 184 184" className="h-full w-full overflow-visible">
          <circle
            cx="92"
            cy="92"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            className="text-neutral-100 dark:text-white/[0.06]"
          />
          {arcs.map((arc) => {
            if (arc.len <= 0) return null
            const isHovered = hoveredId === arc.id
            const isDimmed = hoveredId !== null && !isHovered
            return (
              <circle
                key={arc.id}
                cx="92"
                cy="92"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={isHovered ? 19 : 16}
                strokeDasharray={`${arc.len} ${circumference}`}
                strokeDashoffset={arc.offset}
                transform="rotate(-90 92 92)"
                onMouseEnter={() => setHoveredId(arc.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === arc.id ? null : cur))}
                className="cursor-pointer transition-all duration-[180ms]"
                style={{ opacity: isDimmed ? 0.42 : 1 }}
              />
            )
          })}
        </svg>

        {/* Bounded Center Callout (`max-w-[62%]` centered flex column with generous inner padding & `tabular-nums`) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="mx-auto flex max-w-[62%] flex-col items-center justify-center px-2.5 text-center tabular-nums">
            <span
              dir="ltr"
              className={`${centerFontCls} max-w-full truncate font-semibold leading-none tracking-tight tabular-nums text-neutral-950 dark:text-white`}
            >
              {activeCenterText}
            </span>
            {hoveredSlice ? (
              <span
                dir="ltr"
                className="mt-1 max-w-full truncate text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
              >
                {hoveredSlice.valueFormatted}
              </span>
            ) : centerSubValue ? (
              <span
                dir="ltr"
                className="mt-1 max-w-full truncate text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
              >
                {centerSubValue}
              </span>
            ) : null}
            <span className="mt-1 max-w-full truncate text-xs font-medium text-neutral-400 dark:text-slate-400">
              {hoveredSlice ? hoveredSlice.label : centerLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Dedicated Summary Row Beneath the Ring */}
      {summaryPill ? (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs ${summaryToneCls}`}
        >
          <span className="truncate font-medium">{summaryPill.label}</span>
          <span dir="ltr" className={`shrink-0 font-semibold tabular-nums ${summaryValCls}`}>
            {summaryPill.value}
          </span>
        </div>
      ) : null}

      {/* Color-Coded Interactive Legend Pills */}
      <div className={`grid gap-2 ${legendColumns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {slices.map((s) => {
          const isHovered = hoveredId === s.id
          return (
            <div
              key={s.id}
              tabIndex={0}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
              onFocus={() => setHoveredId(s.id)}
              onBlur={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
              className={`ae-bento-subcard flex cursor-pointer items-center justify-between gap-2 rounded-2xl px-3 py-2.5 transition-all duration-150 focus:outline-none ${
                isHovered
                  ? 'ring-1 ring-emerald-500/50 bg-white dark:bg-white/[0.08]'
                  : 'bg-[#F4F6F9] hover:bg-slate-100/90'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-200">{s.label}</p>
                  {s.subLabel ? (
                    <p className="truncate text-[10.5px] font-medium text-slate-400">{s.subLabel}</p>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <p dir="ltr" className="text-[12px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                  {s.valueFormatted}
                </p>
                <p dir="ltr" className="text-[10.5px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                  {s.pctFormatted}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
