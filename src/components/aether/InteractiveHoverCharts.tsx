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

const TONE_CLS: Record<NonNullable<TooltipLine['tone']>, string> = {
  neutral: 'text-neutral-950 dark:text-white',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-700 dark:text-amber-400',
  slate: 'text-neutral-500 dark:text-slate-400',
}

/**
 * Side-by-side interactive Before vs After bar chart.
 * Muted slate (#CBD5E1) for Before vs Emerald (#10B981) / Obsidian (#0F172A) for After.
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
          <span className="inline-flex items-center gap-2 font-semibold text-neutral-600 dark:text-slate-300">
            <span className="h-3 w-3 rounded-sm bg-[#CBD5E1]" />
            {beforeLegend}
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
            <span className="h-3 w-3 rounded-sm bg-[#10B981]" />
            {afterLegend}
          </span>
        </div>
        <span className="text-[12px] font-medium text-neutral-400 dark:text-slate-400">
          {isAr ? 'مرّر الماوس على أي عمود لعرض الأرقام الدقيقة' : 'Hover any bar for exact numbers'}
        </span>
      </div>

      {/* Plot Canvas */}
      <div className="relative rounded-2xl bg-[#F7F7F8] p-4 pt-6 dark:bg-white/[0.03]">
        {/* Horizontal subtle guide lines */}
        <div className={`pointer-events-none absolute inset-x-4 top-6 bottom-11 flex flex-col justify-between`}>
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-neutral-200/80 dark:border-white/[0.06]"
            >
              <span
                dir="ltr"
                className="-translate-y-2 text-[10.5px] font-semibold tabular-nums text-neutral-400 dark:text-slate-500"
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
            className="pointer-events-none absolute top-2 z-30 w-64 -translate-x-1/2 rtl:translate-x-1/2 rounded-2xl bg-white p-3.5 text-[12.5px] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.06)] ring-1 ring-neutral-950/[0.08] transition-all duration-100 dark:bg-[#0F1626] dark:ring-white/15"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-neutral-100 pb-1.5 dark:border-white/10">
              <span className="truncate font-extrabold text-neutral-950 dark:text-white">
                {activeDatum.tooltipTitle}
              </span>
              {(() => {
                const rawDelta = activeDatum.after - activeDatum.before
                const higherGood = activeDatum.higherIsBetter !== false
                const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
                return (
                  <span
                    dir="ltr"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                      isGood
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {activeDatum.pctFormatted}
                  </span>
                )
              })()}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-neutral-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                  {isAr ? 'الرقم قبل:' : 'Before:'}
                </span>
                <span dir="ltr" className="font-bold tabular-nums text-neutral-700 dark:text-slate-200">
                  {activeDatum.beforeFormatted}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  {isAr ? 'الرقم بعد:' : 'After:'}
                </span>
                <span dir="ltr" className="font-extrabold tabular-nums text-neutral-950 dark:text-white">
                  {activeDatum.afterFormatted}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الفرق:' : 'Change:'}
                </span>
                {(() => {
                  const rawDelta = activeDatum.after - activeDatum.before
                  const higherGood = activeDatum.higherIsBetter !== false
                  const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
                  return (
                    <span
                      dir="ltr"
                      className={`font-extrabold tabular-nums ${
                        isGood ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {activeDatum.diffFormatted}
                    </span>
                  )
                })()}
              </div>

              {activeDatum.extraLines?.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-neutral-500 dark:text-slate-400">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                      TONE_CLS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Bars Row */}
        <div className={`relative z-10 flex ${heightClass} items-end gap-1.5 ps-10 pt-6 sm:gap-2.5`}>
          {data.map((d, idx) => {
            const bPct = Math.max(3, Math.min(100, (Math.max(0, d.before) / maxVal) * 100))
            const aPct = Math.max(3, Math.min(100, (Math.max(0, d.after) / maxVal) * 100))
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
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-xl px-1 pt-2 transition-colors duration-150 focus:outline-none ${
                  isHovered ? 'bg-white/90 ring-1 ring-neutral-900/15 dark:bg-white/[0.07]' : 'hover:bg-white/60'
                }`}
              >
                <div className="flex h-full items-end justify-center gap-1 sm:gap-1.5">
                  {/* Before Bar (#CBD5E1) */}
                  <div
                    style={{ height: `${bPct}%` }}
                    className="w-full max-w-[22px] rounded-t-md bg-[#CBD5E1] transition-all duration-150 group-hover:bg-slate-400/90 dark:bg-slate-600"
                  />
                  {/* After Bar (#10B981 or #0F172A) */}
                  <div
                    style={{ height: `${aPct}%` }}
                    className={`w-full max-w-[22px] rounded-t-md transition-all duration-150 ${
                      isGood
                        ? 'bg-[#10B981] group-hover:bg-emerald-600'
                        : 'bg-[#0F172A] group-hover:bg-neutral-800 dark:bg-slate-200'
                    }`}
                  />
                </div>
                <div className="mt-2 truncate text-center text-[11px] font-bold text-neutral-600 dark:text-slate-300">
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
 * Interactive single/stacked/dual vertical hover chart for Marketing ROI, Sales Timeline, Peak Hours, Menu & Quality.
 * Hovering any bar pops up a crisp white tooltip with exact numbers.
 */
export function InteractiveHoverBarChart({
  data,
  isAr,
  primaryLegend,
  secondaryLegend,
  primaryColor = '#0F172A',
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

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="relative select-none space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-bold text-neutral-800 dark:text-slate-200">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: primaryColor }} />
            {primaryLegend}
          </span>
          {secondaryLegend ? (
            <span className="inline-flex items-center gap-2 font-bold text-neutral-800 dark:text-slate-200">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: secondaryColor }} />
              {secondaryLegend}
            </span>
          ) : null}
        </div>
        <span className="text-[12px] font-medium text-neutral-400 dark:text-slate-400">
          {isAr ? 'مرّر الماوس على أي نقطة لعرض الأرقام' : 'Hover any bar for exact numbers'}
        </span>
      </div>

      <div className="relative rounded-2xl bg-[#F7F7F8] p-4 pt-6 dark:bg-white/[0.03]">
        {/* Guide lines */}
        <div className="pointer-events-none absolute inset-x-4 top-6 bottom-11 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <div
              key={ratio}
              className="flex items-center gap-2 border-b border-dashed border-neutral-200/80 dark:border-white/[0.06]"
            >
              <span
                dir="ltr"
                className="-translate-y-2 text-[10.5px] font-semibold tabular-nums text-neutral-400 dark:text-slate-500"
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
            className="pointer-events-none absolute top-2 z-30 w-64 -translate-x-1/2 rtl:translate-x-1/2 rounded-2xl bg-white p-3.5 text-[12.5px] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.06)] ring-1 ring-neutral-950/[0.08] transition-all duration-100 dark:bg-[#0F1626] dark:ring-white/15"
          >
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-neutral-100 pb-1.5 dark:border-white/10">
              <span className="truncate font-extrabold text-neutral-950 dark:text-white">
                {activeDatum.tooltipTitle}
              </span>
              {activeDatum.badgeText ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    activeDatum.badgeTone === 'emerald'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : activeDatum.badgeTone === 'rose'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : activeDatum.badgeTone === 'amber'
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-slate-200'
                  }`}
                >
                  {activeDatum.badgeText}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {activeDatum.lines.map((line) => (
                <div key={line.label} className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500 dark:text-slate-400">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                      TONE_CLS[line.tone ?? 'neutral']
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Bars */}
        <div className={`relative z-10 flex ${heightClass} items-end gap-1 ps-10 pt-6 sm:gap-2`}>
          {data.map((d, idx) => {
            const pVal = Math.max(0, d.primaryValue || 0)
            const sVal = Math.max(0, d.secondaryValue || 0)
            const totalPct = Math.max(3, Math.min(100, ((pVal + sVal) / maxVal) * 100))
            const pHeightPct = Math.max(3, Math.min(100, (pVal / maxVal) * 100))
            const sHeightPct = Math.max(2, Math.min(100, (sVal / maxVal) * 100))
            const pShareInStack = pVal + sVal > 0 ? (pVal / (pVal + sVal)) * 100 : 100
            const sShareInStack = 100 - pShareInStack
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
                className={`group flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-xl px-0.5 pt-2 transition-colors duration-150 focus:outline-none ${
                  isHovered ? 'bg-white/90 ring-1 ring-neutral-900/15 dark:bg-white/[0.07]' : 'hover:bg-white/60'
                }`}
              >
                {stacked && secondaryLegend ? (
                  <div className="flex h-full items-end justify-center">
                    <div
                      style={{ height: `${totalPct}%` }}
                      className="flex w-full max-w-[28px] flex-col justify-end overflow-hidden rounded-t-md"
                    >
                      {sVal > 0 ? (
                        <div
                          style={{
                            height: `${sShareInStack}%`,
                            backgroundColor: d.secondaryColor ?? secondaryColor,
                          }}
                          className="w-full transition-all duration-150"
                        />
                      ) : null}
                      <div
                        style={{
                          height: `${pShareInStack}%`,
                          backgroundColor: d.primaryColor ?? primaryColor,
                        }}
                        className="w-full transition-all duration-150"
                      />
                    </div>
                  </div>
                ) : secondaryLegend ? (
                  <div className="flex h-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: d.primaryColor ?? primaryColor }}
                      className="w-full max-w-[18px] rounded-t-md transition-all duration-150"
                    />
                    <div
                      style={{ height: `${sHeightPct}%`, backgroundColor: d.secondaryColor ?? secondaryColor }}
                      className="w-full max-w-[18px] rounded-t-md transition-all duration-150"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-end justify-center">
                    <div
                      style={{ height: `${pHeightPct}%`, backgroundColor: d.primaryColor ?? primaryColor }}
                      className="w-full max-w-[28px] rounded-t-md transition-all duration-150 group-hover:opacity-90"
                    />
                  </div>
                )}

                <div className="mt-2 truncate text-center text-[10.5px] font-bold text-neutral-600 dark:text-slate-300">
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
  badgeText?: string
  lines: TooltipLine[]
}

/**
 * Interactive Horizontal Ranking Bars with floating white tooltip on hover.
 */
export function InteractiveHorizontalRankList({
  items,
  isAr,
}: {
  items: HorizontalRankDatum[]
  isAr: boolean
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const maxVal = Math.max(1, ...items.map((x) => (Number.isFinite(x.value) ? Math.max(0, x.value) : 0)))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-2.5">
      {items.map((item) => {
        const widthPct = Math.max(3, Math.min(100, (Math.max(0, item.value) / maxVal) * 100))
        const isHovered = hoveredId === item.id

        return (
          <div
            key={item.id}
            tabIndex={0}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            onFocus={() => setHoveredId(item.id)}
            onBlur={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            className="relative rounded-xl bg-[#F7F7F8] p-3 transition-colors duration-150 hover:bg-neutral-100 focus:outline-none dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          >
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <div className="flex min-w-0 items-center gap-2">
                {item.color ? (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                ) : null}
                <span className="truncate font-bold text-neutral-900 dark:text-white">{item.label}</span>
                {item.subLabel ? (
                  <span className="truncate text-[11.5px] font-medium text-neutral-400 dark:text-slate-400">
                    {item.subLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.badgeText ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-neutral-700 ring-1 ring-neutral-950/[0.05] dark:bg-white/10 dark:text-slate-200">
                    {item.badgeText}
                  </span>
                ) : null}
                <span dir="ltr" className="font-extrabold tabular-nums text-neutral-950 dark:text-white">
                  {item.valueFormatted}
                </span>
              </div>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-slate-800">
              <div
                style={{ width: `${widthPct}%`, backgroundColor: item.color ?? '#0F172A' }}
                className="h-full rounded-full transition-all duration-150"
              />
            </div>

            {isHovered ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute inset-x-3 bottom-full z-30 mb-1.5 rounded-2xl bg-white p-3 text-[12px] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.06)] ring-1 ring-neutral-950/[0.08] dark:bg-[#0F1626] dark:ring-white/15"
              >
                <div className="mb-1.5 font-extrabold text-neutral-950 dark:text-white">{item.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {item.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500 dark:text-slate-400">{line.label}</span>
                      <span
                        dir="ltr"
                        className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                          TONE_CLS[line.tone ?? 'neutral']
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
