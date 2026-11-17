'use client'

import React, { useState, type ReactNode } from 'react'
import {
  ComparisonBarChart,
  SalesNetComposedChart,
  TimelineAreaChart,
  V35ChartCardHeader,
  V35DonutChart,
  type ChartTooltipLine,
  type ComparisonBarDatum,
  type TimelineHourlyDatum,
  type V35ChartHeaderExtraProps,
} from '@/components/charts/v35-chart-kit'
import {
  V35_CHART_COLORS,
  V35_GLASS_TOOLTIP_CLASS,
  V35_TOOLTIP_TONE_CLASS,
  formatCompactAxisLabel,
  formatCompactKwdTick,
} from '@/components/charts/v35-chart-theme'
import { UnavailableState } from '@/components/ui/unavailable-state'

export { formatCompactAxisLabel, formatCompactKwdTick }

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

const HEIGHT_CLASS_MAP: Record<string, number> = {
  'h-52': 220,
  'h-56': 224,
  'h-60': 240,
  'h-64': 256,
  'h-72': 288,
}

function resolveHeightFromClass(heightClass?: string, fallback = 240): number {
  if (!heightClass) return Math.max(220, fallback)
  const tokens = heightClass.trim().split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const raw = tokens[i].replace(/^[a-z]+:/, '')
    if (raw in HEIGHT_CLASS_MAP) {
      return Math.max(220, HEIGHT_CLASS_MAP[raw])
    }
  }
  return Math.max(220, fallback)
}

/**
 * Side-by-side interactive Before vs After Comparison Bar Chart built on V35 `ComparisonBarChart`.
 * Muted slate (`#94A3B8`) for Before vs V35 cobalt blue (`#2563EB`) for After,
 * with frosted glass hover tooltips showing Before, After, +/- diff, and % change.
 */
export function BeforeAfterDualBarChart({
  data,
  isAr,
  beforeLegend,
  afterLegend,
  formatAxisValue,
  heightClass = 'h-72',
  title,
  subtitle,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  ariaLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  infoContent,
  infoLabel,
  sparklineValues,
  unavailableReason,
  showGhostBars,
  hourlyFallback,
}: {
  data: DualBarDatum[]
  isAr: boolean
  beforeLegend: string
  afterLegend: string
  formatAxisValue?: (v: number) => string
  heightClass?: string
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  yAxisLabel?: string
  ariaLabel?: string
  showGhostBars?: boolean
  hourlyFallback?: TimelineHourlyDatum[]
} & V35ChartHeaderExtraProps) {
  const mapped: ComparisonBarDatum[] = data.map((d) => {
    const rawDelta = d.after - d.before
    const higherGood = d.higherIsBetter !== false
    const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0

    let lines: ChartTooltipLine[] | undefined
    if (d.extraLines && d.extraLines.length > 0) {
      lines = [
        { label: isAr ? 'الرقم قبل:' : 'Before:', value: d.beforeFormatted, tone: 'slate' },
        { label: isAr ? 'الرقم بعد:' : 'After:', value: d.afterFormatted, tone: 'blue', bold: true },
        {
          label: isAr ? 'الفرق:' : 'Change:',
          value: d.diffFormatted,
          tone: isGood ? 'emerald' : 'rose',
          bold: true,
        },
        ...d.extraLines,
      ]
    }

    return {
      id: d.id,
      label: d.label,
      tooltipTitle: d.tooltipTitle,
      value: d.after,
      comparisonValue: d.before,
      valueFormatted: d.afterFormatted,
      comparisonFormatted: d.beforeFormatted,
      diffFormatted: d.diffFormatted,
      pctFormatted: d.pctFormatted,
      higherIsBetter: d.higherIsBetter,
      badgeTone: isGood ? 'emerald' : 'rose',
      lines,
    }
  })

  return (
    <ComparisonBarChart
      data={mapped}
      isAr={isAr}
      primaryLabel={afterLegend}
      comparisonLabel={beforeLegend}
      primaryColor={V35_CHART_COLORS.primary}
      comparisonColor={V35_CHART_COLORS.comparison}
      showGhostBars={showGhostBars}
      hourlyFallback={hourlyFallback}
      formatTick={formatAxisValue}
      height={resolveHeightFromClass(heightClass, 288)}
      title={title}
      subtitle={subtitle}
      periodLabel={periodLabel}
      unitLabel={unitLabel}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
      kpiValue={kpiValue}
      deltaPct={deltaPct}
      deltaLabel={deltaLabel}
      deltaHigherIsBetter={deltaHigherIsBetter}
      infoContent={infoContent}
      infoLabel={infoLabel}
      sparklineValues={sparklineValues}
      unavailableReason={unavailableReason}
      ariaLabel={
        ariaLabel ??
        ([title, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
          (isAr ? 'مخطط مقارنة قبل وبعد' : 'Before vs After comparison chart'))
      }
    />
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
 * Interactive V35 Bar Chart for Cash-Flow, Marketing ROI, Sales Timeline, Peak Hours, Menu & Quality,
 * built directly on `ComparisonBarChart`.
 */
export function InteractiveHoverBarChart({
  data,
  isAr,
  primaryLegend,
  secondaryLegend,
  primaryColor = V35_CHART_COLORS.primary,
  secondaryColor = V35_CHART_COLORS.comparison,
  stacked = false,
  formatAxisValue,
  heightClass = 'h-64',
  title,
  subtitle,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  ariaLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  infoContent,
  infoLabel,
  sparklineValues,
  unavailableReason,
  showGhostBars,
  hourlyFallback,
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
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  yAxisLabel?: string
  ariaLabel?: string
  showGhostBars?: boolean
  hourlyFallback?: TimelineHourlyDatum[]
} & V35ChartHeaderExtraProps) {
  const mapped: ComparisonBarDatum[] = data.map((d) => ({
    id: d.id,
    label: d.label,
    tooltipTitle: d.tooltipTitle,
    value: d.primaryValue,
    comparisonValue: secondaryLegend ? (d.secondaryValue ?? 0) : undefined,
    primaryColor: d.primaryColor,
    comparisonColor: d.secondaryColor,
    badgeText: d.badgeText,
    badgeTone: d.badgeTone,
    lines: d.lines,
  }))

  return (
    <ComparisonBarChart
      data={mapped}
      isAr={isAr}
      primaryLabel={primaryLegend}
      comparisonLabel={secondaryLegend}
      primaryColor={primaryColor}
      comparisonColor={secondaryColor}
      stacked={stacked}
      showGhostBars={showGhostBars}
      hourlyFallback={hourlyFallback}
      formatTick={formatAxisValue}
      height={resolveHeightFromClass(heightClass, 256)}
      title={title}
      subtitle={subtitle}
      periodLabel={periodLabel}
      unitLabel={unitLabel}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
      kpiValue={kpiValue}
      deltaPct={deltaPct}
      deltaLabel={deltaLabel}
      deltaHigherIsBetter={deltaHigherIsBetter}
      infoContent={infoContent}
      infoLabel={infoLabel}
      sparklineValues={sparklineValues}
      unavailableReason={unavailableReason}
      ariaLabel={
        ariaLabel ??
        ([title, primaryLegend, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
          (isAr ? 'مخطط أعمدة بياني' : 'Interactive bar chart'))
      }
    />
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
 * - When `data.length === 1`: delegates to V35 `TimelineAreaChart` (hourly area when `hourlyFallback`
 *   is provided, or compact single-value stat — never one fat bar!).
 * - When `data.length > 1`: delegates to V35 `SalesNetComposedChart` with slim ghost-backed slate
 *   sales bars and smooth cobalt blue operating net line.
 */
export function SalesNetComboChart({
  data,
  isAr,
  salesLegend,
  netLegend,
  heightClass = 'h-60',
  title,
  subtitle,
  periodLabel,
  unitLabel,
  xAxisLabel,
  ariaLabel,
  hourlyFallback,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  infoContent,
  infoLabel,
  sparklineValues,
  unavailableReason,
  showGhostBars,
}: {
  data: ComboBarLineDatum[]
  isAr: boolean
  salesLegend: string
  netLegend: string
  heightClass?: string
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  ariaLabel?: string
  hourlyFallback?: TimelineHourlyDatum[]
  showGhostBars?: boolean
} & V35ChartHeaderExtraProps) {
  const resolvedHeight = resolveHeightFromClass(heightClass, 240)
  const resolvedAriaLabel =
    ariaLabel ??
    ([title, salesLegend, netLegend, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط المبيعات وصافي الربح' : 'Sales and net profit chart'))

  if (data.length === 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={isAr ? 'rtl' : 'ltr'}
        data-chart-kind="sales-net-combo"
        data-chart-mode="empty"
        className="space-y-3"
      >
        <V35ChartCardHeader
          title={title}
          subtitle={subtitle}
          period={periodLabel}
          unit={unitLabel}
          infoContent={infoContent}
          infoLabel={infoLabel}
          kpiValue={kpiValue}
          deltaPct={deltaPct}
          deltaLabel={deltaLabel}
          deltaHigherIsBetter={deltaHigherIsBetter}
          sparklineValues={sparklineValues}
          isAr={isAr}
        />
        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
      </div>
    )
  }

  if (data.length === 1) {
    const single = data[0]
    return (
      <TimelineAreaChart
        dailySeries={[
          {
            day: single.tooltipTitle || single.id || single.label,
            label: single.label,
            netKwd: single.salesKwd,
            secondaryValue: single.netKwd > 0 ? single.netKwd : undefined,
            tooltipLines: single.lines,
          },
        ]}
        hourlySeries={hourlyFallback}
        isAr={isAr}
        title={title}
        subtitle={subtitle}
        valueLabel={salesLegend}
        secondaryLabel={netLegend}
        periodLabel={periodLabel}
        unitLabel={unitLabel ?? (isAr ? 'د.ك' : 'KWD')}
        xAxisLabel={xAxisLabel}
        kpiValue={kpiValue}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
        deltaHigherIsBetter={deltaHigherIsBetter}
        infoContent={infoContent}
        infoLabel={infoLabel}
        sparklineValues={sparklineValues}
        unavailableReason={unavailableReason}
        ariaLabel={resolvedAriaLabel}
        height={resolvedHeight}
      />
    )
  }

  return (
    <SalesNetComposedChart
      data={data}
      isAr={isAr}
      salesLegend={salesLegend}
      netLegend={netLegend}
      showGhostBars={showGhostBars}
      height={resolvedHeight}
      title={title}
      subtitle={subtitle}
      periodLabel={periodLabel}
      unitLabel={unitLabel}
      xAxisLabel={xAxisLabel}
      kpiValue={kpiValue}
      deltaPct={deltaPct}
      deltaLabel={deltaLabel}
      deltaHigherIsBetter={deltaHigherIsBetter}
      infoContent={infoContent}
      infoLabel={infoLabel}
      sparklineValues={sparklineValues}
      unavailableReason={unavailableReason}
      ariaLabel={resolvedAriaLabel}
    />
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
 * Interactive Horizontal V35 Ranking List styled with 1px hairline cards,
 * soft rounded progress tracks, and frosted glass hover/focus tooltips.
 */
export function InteractiveHorizontalRankList({
  items,
  isAr,
  onSelect,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  infoContent,
  infoLabel,
  sparklineValues,
}: {
  items: HorizontalRankDatum[]
  isAr: boolean
  onSelect?: (id: string) => void
  title?: ReactNode
  periodLabel?: string
  unitLabel?: string
} & V35ChartHeaderExtraProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const maxVal = Math.max(
    1,
    ...items.map((x) => (Number.isFinite(x.value) ? Math.max(0, x.value) : 0)),
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-2.5">
      <V35ChartCardHeader
        title={title}
        subtitle={subtitle}
        period={periodLabel}
        unit={unitLabel}
        infoContent={infoContent}
        infoLabel={infoLabel}
        kpiValue={kpiValue}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
        deltaHigherIsBetter={deltaHigherIsBetter}
        sparklineValues={sparklineValues}
        isAr={isAr}
      />
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setHoveredId(null)
                return
              }
              if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onSelect(item.id)
              }
            }}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            onFocus={() => setHoveredId(item.id)}
            onBlur={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
            className={`relative rounded-xl border p-3 transition-colors duration-[180ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              isInteractive ? 'cursor-pointer' : ''
            } ${
              item.active
                ? 'border-blue-500/50 bg-blue-50/80 dark:border-sky-400/45 dark:bg-sky-950/35'
                : 'border-slate-200/85 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
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
                  <span className="whitespace-normal break-words font-semibold tracking-tight text-slate-950 dark:text-white">
                    {item.label}
                  </span>
                  {item.active ? (
                    <span className="shrink-0 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-sky-300">
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
                    className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {item.badgeText}
                  </span>
                ) : null}
                <span
                  dir="ltr"
                  className="font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white"
                >
                  {item.valueFormatted}
                </span>
              </div>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80">
              <div
                style={{
                  width: `${widthPct}%`,
                  ...(item.barClassName
                    ? {}
                    : { backgroundColor: item.color ?? V35_CHART_COLORS.primary }),
                }}
                className={`h-full rounded-full transition-all duration-[180ms] ${
                  item.barClassName ?? ''
                }`}
              />
            </div>

            {isHovered ? (
              <div
                role="tooltip"
                className={`pointer-events-none absolute inset-x-3 bottom-full z-30 mb-1.5 ${V35_GLASS_TOOLTIP_CLASS}`}
              >
                <div className="mb-1.5 font-semibold text-slate-950">{item.label}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {item.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">{line.label}</span>
                      <span
                        dir="ltr"
                        className={`tabular-nums ${line.bold ? 'font-bold' : 'font-medium'} ${
                          V35_TOOLTIP_TONE_CLASS[line.tone ?? 'neutral']
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
 * V35 Interactive Circular Donut Ring + Hairline Legend Breakdown built on `V35DonutChart`.
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
  ariaLabel,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  infoContent,
  infoLabel,
  sparklineValues,
  unavailableReason,
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
  ariaLabel?: string
  title?: ReactNode
  periodLabel?: string
  unitLabel?: string
} & V35ChartHeaderExtraProps) {
  return (
    <V35DonutChart
      slices={slices}
      centerValue={centerValue}
      centerSubValue={centerSubValue}
      centerLabel={centerLabel}
      summaryPill={summaryPill}
      summaryRows={summaryRows}
      activeSliceId={activeSliceId}
      onSelectSlice={onSelectSlice}
      isAr={isAr}
      legendColumns={legendColumns}
      legendLayout={legendLayout}
      ariaLabel={ariaLabel}
      title={title}
      subtitle={subtitle}
      periodLabel={periodLabel}
      unitLabel={unitLabel}
      kpiValue={kpiValue}
      deltaPct={deltaPct}
      deltaLabel={deltaLabel}
      deltaHigherIsBetter={deltaHigherIsBetter}
      infoContent={infoContent}
      infoLabel={infoLabel}
      sparklineValues={sparklineValues}
      unavailableReason={unavailableReason}
    />
  )
}
