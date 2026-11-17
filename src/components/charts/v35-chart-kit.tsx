'use client'

import React, { useId, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatInt, formatKwd, formatPct, type FormatLocale } from '@/lib/format'
import { formatChartKwdTooltip } from '@/components/ui/chart-card'
import {
  V35_AXIS_TICK_STYLE,
  V35_CHART_COLORS,
  V35_CHART_GRID_PROPS,
  V35_CHART_PLOT_SURFACE_CLASS,
  V35_GLASS_TOOLTIP_CLASS,
  V35_TOOLTIP_TONE_CLASS,
  type ChartTooltipTone,
  formatCompactAxisLabel,
  formatCompactKwdTick,
  normalizeV35SeriesColor,
  resolveV35DonutColor,
} from '@/components/charts/v35-chart-theme'

export { formatCompactAxisLabel, formatCompactKwdTick }

export interface ChartTooltipLine {
  label: string
  value: string
  tone?: ChartTooltipTone
  bold?: boolean
}

export interface TimelineAreaDatum {
  day: string
  netKwd: number
  orders?: number
  label?: string
  secondaryValue?: number
  tooltipLines?: ReadonlyArray<ChartTooltipLine>
}

export interface TimelineHourlyDatum {
  hour: number | string
  netKwd: number
  orders?: number
  label?: string
  secondaryValue?: number
  tooltipLines?: ReadonlyArray<ChartTooltipLine>
}

export interface TimelineAreaChartProps {
  dailySeries: TimelineAreaDatum[]
  hourlySeries?: TimelineHourlyDatum[]
  secondarySeries?: Array<{
    day: string
    value: number
    label?: string
  }>
  isAr: boolean
  title?: string
  valueLabel?: string
  secondaryLabel?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  yAxisLabel?: string
  formatValue?: (v: number) => string
  formatTick?: (v: number) => string
  height?: number
  ariaLabel?: string
  className?: string
}

export interface ComparisonBarDatum {
  id: string
  label: string
  tooltipTitle?: string
  value: number
  comparisonValue?: number
  valueFormatted?: string
  comparisonFormatted?: string
  diffFormatted?: string
  pctFormatted?: string
  higherIsBetter?: boolean
  primaryColor?: string
  comparisonColor?: string
  badgeText?: string
  badgeTone?: 'emerald' | 'rose' | 'amber' | 'neutral'
  lines?: ReadonlyArray<ChartTooltipLine>
}

export interface ComparisonBarChartProps {
  data: ComparisonBarDatum[]
  isAr: boolean
  primaryLabel?: string
  comparisonLabel?: string
  primaryColor?: string
  comparisonColor?: string
  stacked?: boolean
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  yAxisLabel?: string
  formatTick?: (v: number) => string
  formatTooltip?: (v: number, isComparison?: boolean) => string
  height?: number
  ariaLabel?: string
  className?: string
}

export interface V35DonutSlice {
  id: string
  label: string
  value: number
  valueFormatted: string
  pctFormatted: string
  color?: string
  subLabel?: string
}

export interface V35DonutSummaryRow {
  label: string
  value: string
  tone?: 'emerald' | 'neutral' | 'amber' | 'rose' | 'blue'
}

export interface V35DonutChartProps {
  slices: V35DonutSlice[]
  centerValue: string
  centerSubValue?: string
  centerLabel?: string
  summaryPill?: V35DonutSummaryRow
  summaryRows?: V35DonutSummaryRow[]
  activeSliceId?: string
  onSelectSlice?: (id: string) => void
  isAr: boolean
  legendColumns?: 1 | 2
  legendLayout?: 'below' | 'beside'
  ariaLabel?: string
  className?: string
}

export interface SalesNetComposedDatum {
  id: string
  label: string
  tooltipTitle: string
  salesKwd: number
  netKwd: number
  netMarginPct: number
  lines: ReadonlyArray<ChartTooltipLine>
}

export interface SalesNetComposedChartProps {
  data: SalesNetComposedDatum[]
  isAr: boolean
  salesLegend: string
  netLegend: string
  height?: number
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  ariaLabel?: string
  className?: string
}

interface RechartsTooltipRenderProps {
  active?: boolean
  payload?: ReadonlyArray<{
    name?: string | number
    value?: number | string | ReadonlyArray<number | string>
    color?: string
    payload?: unknown
  }>
  label?: string | number
}

const RESPONSIVE_SSR_DIMENSION = { width: 640, height: 240 } as const

function safeFinite(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
}

function formatHourTickLabel(hour: number | string, explicit?: string): string {
  if (explicit) return explicit
  if (typeof hour === 'number' && Number.isFinite(hour)) {
    const h = Math.max(0, Math.min(23, Math.floor(hour)))
    return `${String(h).padStart(2, '0')}:00`
  }
  return String(hour)
}

function GlassTooltipLines({
  title,
  badgeText,
  badgeTone,
  lines,
  isAr,
}: {
  title: string
  badgeText?: string
  badgeTone?: 'emerald' | 'rose' | 'amber' | 'neutral' | 'blue'
  lines: ReadonlyArray<ChartTooltipLine>
  isAr: boolean
}) {
  const badgeCls =
    badgeTone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : badgeTone === 'rose'
        ? 'bg-rose-50 text-rose-700'
        : badgeTone === 'amber'
          ? 'bg-amber-50 text-amber-800'
          : badgeTone === 'blue'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-800'

  return (
    <div role="tooltip" dir={isAr ? 'rtl' : 'ltr'} className={V35_GLASS_TOOLTIP_CLASS}>
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
        <span className="font-bold text-slate-950">{title}</span>
        {badgeText ? (
          <span dir="ltr" className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${badgeCls}`}>
            {badgeText}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <div key={`${line.label}-${idx}`} className="flex items-center justify-between gap-3">
            <span className="text-slate-600">{line.label}</span>
            <span
              dir="ltr"
              className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} ${
                V35_TOOLTIP_TONE_CLASS[line.tone ?? 'neutral']
              }`}
            >
              {line.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * V35 Timeline Area Chart:
 * - Multi-day `dailySeries`: smooth `monotone` Recharts `<AreaChart>` with soft blue gradient & horizontal hairline grid.
 * - 1-point `dailySeries` WITH non-empty `hourlySeries`: smooth hourly `<AreaChart>` (`data-chart-mode="hourly-area"`).
 * - 1-point `dailySeries` WITHOUT `hourlySeries`: compact single-value glass stat (`data-chart-mode="single-stat"`, ZERO `<rect>` bars).
 */
export function TimelineAreaChart({
  dailySeries,
  hourlySeries,
  secondarySeries,
  isAr,
  title,
  valueLabel,
  secondaryLabel,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  formatValue,
  formatTick,
  height = 240,
  ariaLabel,
  className = '',
}: TimelineAreaChartProps) {
  const safeId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const locale: FormatLocale = isAr ? 'ar' : 'en'
  const chartHeight = Math.max(220, height)
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const xAxisReversed = isAr ? 'true' : 'false'
  const metaSubtitle = [periodLabel, unitLabel].filter(Boolean).join(' · ')
  const resolvedAriaLabel =
    ariaLabel ??
    ([title, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط الاتجاه الزمني' : 'Timeline area chart'))

  const fmtVal = (v: number) =>
    formatValue ? formatValue(v) : formatChartKwdTooltip(v, locale)
  const fmtTick = (v: number) =>
    formatTick ? formatTick(v) : formatCompactKwdTick(v, isAr)

  if (dailySeries.length === 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="timeline-area"
        data-chart-mode="empty"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={`rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-center text-xs font-medium text-slate-500 dark:border-sky-400/15 dark:bg-slate-900/35 dark:text-slate-300 ${className}`}
      >
        {isAr ? 'لا توجد نقاط زمنية متاحة لهذه الفترة' : 'No timeline points available for this window'}
      </div>
    )
  }

  const hasHourly = Array.isArray(hourlySeries) && hourlySeries.length > 0

  if (dailySeries.length === 1 && !hasHourly) {
    const point = dailySeries[0]
    const rawNumFormatted = formatValue
      ? formatValue(point.netKwd)
      : unitLabel
        ? formatKwd(point.netKwd, { locale, decimals: 3, showUnit: false })
        : formatChartKwdTooltip(point.netKwd, locale)
    const compactDate = formatCompactAxisLabel(point.day)
    const dateDisplay =
      point.day && compactDate !== point.day
        ? `${point.day}`
        : (point.label ?? point.day)

    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="timeline-area"
        data-chart-mode="single-stat"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={`space-y-3 ${className}`}
      >
        {title || metaSubtitle ? (
          <div className="space-y-0.5">
            {title ? (
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            ) : null}
            {metaSubtitle ? (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metaSubtitle}</p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white/85 via-blue-50/45 to-slate-50/70 p-4 sm:p-5 backdrop-blur-md dark:border-sky-400/20 dark:from-slate-900/70 dark:via-slate-900/55 dark:to-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50/90 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25">
              <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-sky-400" aria-hidden />
              <span dir="ltr" className="tabular-nums">
                {dateDisplay}
              </span>
            </span>
            {valueLabel ? (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {valueLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span
                dir="ltr"
                className="text-2xl sm:text-[26px] font-extrabold tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {rawNumFormatted}
              </span>
              {!formatValue && unitLabel ? (
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {unitLabel}
                </span>
              ) : null}
            </div>

            {typeof point.orders === 'number' && Number.isFinite(point.orders) ? (
              <span className="rounded-full bg-slate-100/90 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
                {isAr
                  ? `${formatInt(point.orders, { locale })} طلب`
                  : `${formatInt(point.orders, { locale })} orders`}
              </span>
            ) : null}
          </div>

          {point.tooltipLines && point.tooltipLines.length > 0 ? (
            <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-2 dark:border-white/10">
              {point.tooltipLines.map((line, idx) => (
                <div
                  key={`${line.label}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs ring-1 ring-slate-200/60 dark:bg-white/[0.04] dark:ring-white/10"
                >
                  <span className="text-slate-600 dark:text-slate-300">{line.label}</span>
                  <span
                    dir="ltr"
                    className={`tabular-nums ${line.bold ? 'font-extrabold' : 'font-semibold'} text-slate-950 dark:text-white`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const mode = dailySeries.length === 1 && hasHourly ? 'hourly-area' : 'daily-area'

  interface AreaPlotRow {
    hour?: number | string
    label: string
    tooltipTitle: string
    value: number
    secondaryValue?: number
    orders?: number
    tooltipLines?: ReadonlyArray<ChartTooltipLine>
  }

  const secondaryMap = new Map<string, number>()
  if (secondarySeries) {
    for (const s of secondarySeries) {
      secondaryMap.set(s.day, safeFinite(s.value))
    }
  }

  const plottedData: AreaPlotRow[] =
    mode === 'hourly-area'
      ? (hourlySeries ?? []).map((pt) => {
          const lbl = formatHourTickLabel(pt.hour, pt.label)
          return {
            hour: pt.hour,
            label: lbl,
            tooltipTitle: `${dailySeries[0]?.day ?? ''} · ${lbl}`,
            value: safeFinite(pt.netKwd),
            secondaryValue:
              typeof pt.secondaryValue === 'number' && Number.isFinite(pt.secondaryValue)
                ? safeFinite(pt.secondaryValue)
                : undefined,
            orders: pt.orders,
            tooltipLines: pt.tooltipLines,
          }
        })
      : dailySeries.map((pt) => {
          const secFromMap = secondaryMap.get(pt.day)
          const secVal =
            typeof pt.secondaryValue === 'number' && Number.isFinite(pt.secondaryValue)
              ? safeFinite(pt.secondaryValue)
              : secFromMap
          return {
            label: pt.label ?? formatCompactAxisLabel(pt.day),
            tooltipTitle: pt.day,
            value: safeFinite(pt.netKwd),
            secondaryValue: secVal,
            orders: pt.orders,
            tooltipLines: pt.tooltipLines,
          }
        })

  const hasSecondary = plottedData.some(
    (d) => typeof d.secondaryValue === 'number' && Number.isFinite(d.secondaryValue),
  )

  const primarySeriesName = valueLabel ?? (isAr ? 'صافي المبيعات' : 'Net Sales')
  const secondarySeriesName = secondaryLabel ?? (isAr ? 'الفترة السابقة' : 'Comparison')

  const renderTooltip = (props: RechartsTooltipRenderProps) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null
    const row = props.payload[0]?.payload as AreaPlotRow | undefined
    if (!row) return null
    if (row.tooltipLines && row.tooltipLines.length > 0) {
      return <GlassTooltipLines title={row.tooltipTitle} lines={row.tooltipLines} isAr={isAr} />
    }
    const lines: ChartTooltipLine[] = [
      { label: primarySeriesName, value: fmtVal(row.value), bold: true, tone: 'blue' },
    ]
    if (typeof row.secondaryValue === 'number') {
      lines.push({
        label: secondarySeriesName,
        value: fmtVal(row.secondaryValue),
        tone: 'slate',
      })
    }
    if (typeof row.orders === 'number' && Number.isFinite(row.orders)) {
      lines.push({
        label: isAr ? 'الطلبات' : 'Orders',
        value: formatInt(row.orders, { locale }),
        tone: 'neutral',
      })
    }
    return <GlassTooltipLines title={row.tooltipTitle} lines={lines} isAr={isAr} />
  }

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="timeline-area"
      data-chart-mode={mode}
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={`select-none space-y-3 ${className}`}
    >
      {title || metaSubtitle ? (
        <div className="space-y-0.5">
          {title ? <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3> : null}
          {metaSubtitle ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metaSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: V35_CHART_COLORS.primary }}
              aria-hidden
            />
            <span>{primarySeriesName}</span>
          </span>
          {hasSecondary ? (
            <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: V35_CHART_COLORS.comparison }}
                aria-hidden
              />
              <span>{secondarySeriesName}</span>
            </span>
          ) : null}
        </div>
        {yAxisLabel ? (
          <span data-chart-axis-y="true" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {yAxisLabel}
          </span>
        ) : null}
      </div>

      <div className={V35_CHART_PLOT_SURFACE_CLASS}>
        <div className="w-full min-w-0" style={{ height: chartHeight, minHeight: 220 }}>
          <ResponsiveContainer
            width="100%"
            height={chartHeight}
            minHeight={220}
            initialDimension={RESPONSIVE_SSR_DIMENSION}
          >
            <AreaChart data={plottedData} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id={`v35Area-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={V35_CHART_COLORS.primary} stopOpacity={0.28} />
                  <stop offset="65%" stopColor={V35_CHART_COLORS.primaryDark} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={V35_CHART_COLORS.primaryDark} stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id={`v35AreaSec-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={V35_CHART_COLORS.comparison} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={V35_CHART_COLORS.comparison} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid {...V35_CHART_GRID_PROPS} />
              <XAxis
                dataKey="label"
                reversed={isAr}
                tick={V35_AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                orientation={yAxisSide}
                tick={V35_AXIS_TICK_STYLE}
                tickFormatter={fmtTick}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={renderTooltip} />
              {hasSecondary ? (
                <Area
                  type="monotone"
                  dataKey="secondaryValue"
                  name={secondarySeriesName}
                  stroke={V35_CHART_COLORS.comparison}
                  strokeWidth={2}
                  fill={`url(#v35AreaSec-${safeId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="value"
                name={primarySeriesName}
                stroke={V35_CHART_COLORS.primary}
                strokeWidth={2.5}
                fill={`url(#v35Area-${safeId})`}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: V35_CHART_COLORS.primary,
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {xAxisLabel ? (
        <div
          data-chart-axis-x="true"
          className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
        >
          {xAxisLabel}
        </div>
      ) : null}
    </div>
  )
}

/**
 * V35 Grouped / Comparison Bar Chart:
 * - Rounded top corners (`radius={[6, 6, 0, 0]}`), proportional widths (`barCategoryGap="28%"`).
 * - Zero gray background tracks and zero per-bar value stamps.
 * - Soft blue primary (`#2563EB`) + calm comparison slate (`#94A3B8`) + frosted glass tooltips.
 */
export function ComparisonBarChart({
  data,
  isAr,
  primaryLabel,
  comparisonLabel,
  primaryColor = V35_CHART_COLORS.primary,
  comparisonColor = V35_CHART_COLORS.comparison,
  stacked = false,
  title,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  formatTick,
  formatTooltip,
  height = 240,
  ariaLabel,
  className = '',
}: ComparisonBarChartProps) {
  const locale: FormatLocale = isAr ? 'ar' : 'en'
  const chartHeight = Math.max(220, height)
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const xAxisReversed = isAr ? 'true' : 'false'

  const resolvedPrimaryColor = normalizeV35SeriesColor(primaryColor, V35_CHART_COLORS.primary)
  const resolvedComparisonColor = normalizeV35SeriesColor(
    comparisonColor,
    V35_CHART_COLORS.comparison,
  )
  const primarySeriesName = primaryLabel ?? (isAr ? 'الحالي' : 'Current')
  const comparisonSeriesName = comparisonLabel ?? (isAr ? 'السابق' : 'Comparison')

  const fmtTick = (v: number) =>
    formatTick ? formatTick(v) : formatCompactKwdTick(v, isAr)
  const fmtTip = (v: number, isComp = false) =>
    formatTooltip ? formatTooltip(v, isComp) : formatChartKwdTooltip(v, locale)

  const metaSubtitle = [periodLabel, unitLabel].filter(Boolean).join(' · ')
  const resolvedAriaLabel =
    ariaLabel ??
    ([title, primaryLabel, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط الأعمدة المقارن' : 'Comparison bar chart'))

  interface BarPlotRow {
    id: string
    axisLabel: string
    tooltipTitle: string
    value: number
    comparisonValue?: number
    valueFormatted?: string
    comparisonFormatted?: string
    diffFormatted?: string
    pctFormatted?: string
    higherIsBetter?: boolean
    primaryColor?: string
    comparisonColor?: string
    badgeText?: string
    badgeTone?: 'emerald' | 'rose' | 'amber' | 'neutral'
    lines?: ReadonlyArray<ChartTooltipLine>
  }

  const plottedData: BarPlotRow[] = data.map((d) => ({
    id: d.id,
    axisLabel: formatCompactAxisLabel(d.label),
    tooltipTitle: d.tooltipTitle ?? d.label,
    value: safeFinite(d.value),
    comparisonValue:
      typeof d.comparisonValue === 'number' && Number.isFinite(d.comparisonValue)
        ? safeFinite(d.comparisonValue)
        : undefined,
    valueFormatted: d.valueFormatted,
    comparisonFormatted: d.comparisonFormatted,
    diffFormatted: d.diffFormatted,
    pctFormatted: d.pctFormatted,
    higherIsBetter: d.higherIsBetter,
    primaryColor: d.primaryColor
      ? normalizeV35SeriesColor(d.primaryColor, resolvedPrimaryColor)
      : undefined,
    comparisonColor: d.comparisonColor
      ? normalizeV35SeriesColor(d.comparisonColor, resolvedComparisonColor)
      : undefined,
    badgeText: d.badgeText,
    badgeTone: d.badgeTone,
    lines: d.lines,
  }))

  const hasComparison = plottedData.some((d) => typeof d.comparisonValue === 'number')
  const hasCustomPrimaryColors = plottedData.some((d) => Boolean(d.primaryColor))
  const hasCustomComparisonColors = plottedData.some((d) => Boolean(d.comparisonColor))

  const maxAxisVal = Math.max(
    0,
    ...plottedData.map((d) => {
      const p = d.value
      const c = d.comparisonValue ?? 0
      return stacked ? p + c : Math.max(p, c)
    }),
  )

  const renderTooltip = (props: RechartsTooltipRenderProps) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null
    const row = props.payload[0]?.payload as BarPlotRow | undefined
    if (!row) return null

    if (row.lines && row.lines.length > 0) {
      return (
        <GlassTooltipLines
          title={row.tooltipTitle}
          badgeText={row.badgeText}
          badgeTone={row.badgeTone}
          lines={row.lines}
          isAr={isAr}
        />
      )
    }

    const lines: ChartTooltipLine[] = []
    if (typeof row.comparisonValue === 'number') {
      lines.push({
        label: comparisonSeriesName,
        value: row.comparisonFormatted ?? fmtTip(row.comparisonValue, true),
        tone: 'slate',
      })
    }
    lines.push({
      label: primarySeriesName,
      value: row.valueFormatted ?? fmtTip(row.value, false),
      tone: 'blue',
      bold: true,
    })

    let badgeTone = row.badgeTone
    if (row.diffFormatted) {
      const rawDelta = row.value - (row.comparisonValue ?? 0)
      const higherGood = row.higherIsBetter !== false
      const isGood = higherGood ? rawDelta >= 0 : rawDelta <= 0
      badgeTone = badgeTone ?? (isGood ? 'emerald' : 'rose')
      lines.push({
        label: isAr ? 'الفرق' : 'Change',
        value: row.diffFormatted,
        tone: isGood ? 'emerald' : 'rose',
        bold: true,
      })
    }

    return (
      <GlassTooltipLines
        title={row.tooltipTitle}
        badgeText={row.pctFormatted ?? row.badgeText}
        badgeTone={badgeTone}
        lines={lines}
        isAr={isAr}
      />
    )
  }

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="comparison-bar"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={`select-none space-y-3 ${className}`}
    >
      {title || metaSubtitle ? (
        <div className="space-y-0.5">
          {title ? <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3> : null}
          {metaSubtitle ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metaSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {hasComparison ? (
            <span className="inline-flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolvedComparisonColor }}
                aria-hidden
              />
              <span>{comparisonSeriesName}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolvedPrimaryColor }}
              aria-hidden
            />
            <span>{primarySeriesName}</span>
          </span>
        </div>
        {yAxisLabel ? (
          <span data-chart-axis-y="true" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {yAxisLabel}
          </span>
        ) : null}
      </div>

      <div className={V35_CHART_PLOT_SURFACE_CLASS}>
        <div className="w-full min-w-0" style={{ height: chartHeight, minHeight: 220 }}>
          <ResponsiveContainer
            width="100%"
            height={chartHeight}
            minHeight={220}
            initialDimension={RESPONSIVE_SSR_DIMENSION}
          >
            <BarChart
              data={plottedData}
              barCategoryGap="28%"
              barGap={6}
              margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid {...V35_CHART_GRID_PROPS} />
              <XAxis
                dataKey="axisLabel"
                reversed={isAr}
                tick={V35_AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                minTickGap={14}
              />
              <YAxis
                orientation={yAxisSide}
                tick={V35_AXIS_TICK_STYLE}
                tickFormatter={fmtTick}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={renderTooltip}
              />
              {hasComparison ? (
                <Bar
                  dataKey="comparisonValue"
                  name={comparisonSeriesName}
                  stackId={stacked ? 'v35' : undefined}
                  fill={resolvedComparisonColor}
                  radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                >
                  {hasCustomComparisonColors
                    ? plottedData.map((entry) => (
                        <Cell
                          key={`cmp-${entry.id}`}
                          fill={entry.comparisonColor ?? resolvedComparisonColor}
                        />
                      ))
                    : null}
                </Bar>
              ) : null}
              <Bar
                dataKey="value"
                name={primarySeriesName}
                stackId={stacked ? 'v35' : undefined}
                fill={resolvedPrimaryColor}
                radius={[6, 6, 0, 0]}
                maxBarSize={hasComparison ? 32 : 36}
                isAnimationActive={false}
              >
                {hasCustomPrimaryColors
                  ? plottedData.map((entry) => (
                      <Cell
                        key={`pri-${entry.id}`}
                        fill={entry.primaryColor ?? resolvedPrimaryColor}
                      />
                    ))
                  : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Screen-reader & SSR accessible summary of axis peak and compact data ticks */}
        {plottedData.length > 0 ? (
          <div className="sr-only">
            <span dir="ltr">{fmtTick(maxAxisVal)}</span>
            <ul>
              {plottedData.map((row) => (
                <li key={`sr-${row.id}`}>
                  <span>{row.tooltipTitle}: </span>
                  <span dir="ltr">{fmtTick(row.value)}</span>
                  {typeof row.comparisonValue === 'number' ? (
                    <span dir="ltr"> ({fmtTick(row.comparisonValue)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {xAxisLabel ? (
        <div
          data-chart-axis-x="true"
          className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
        >
          {xAxisLabel}
        </div>
      ) : null}
    </div>
  )
}

/**
 * V35 Donut Ring Chart:
 * - Thin ring (`innerRadius="70%"`, `outerRadius="92%"`) on Recharts `<PieChart>`.
 * - V35 blue / slate / indigo palette (`#2563EB`, `#38BDF8`, `#818CF8`, `#94A3B8`, `#0EA5E9`).
 * - Legend beside donut on desktop (`md:grid-cols-[228px_minmax(0,1fr)]`) and below on mobile by default.
 */
export function V35DonutChart({
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
  legendLayout = 'beside',
  ariaLabel,
  className = '',
}: V35DonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const xAxisReversed = isAr ? 'true' : 'false'

  const normalizedSlices = slices.map((s, idx) => ({
    ...s,
    safeVal: safeFinite(s.value),
    resolvedColor: resolveV35DonutColor(idx, s.color),
  }))
  const positiveSlices = normalizedSlices.filter((s) => s.safeVal > 0)
  const activeCount = positiveSlices.length

  const hoveredSlice = hoveredId ? normalizedSlices.find((s) => s.id === hoveredId) ?? null : null
  const activeCenterText = hoveredSlice ? hoveredSlice.pctFormatted : centerValue
  const centerFontCls =
    activeCenterText.length > 10
      ? 'text-[13px]'
      : activeCenterText.length > 8
        ? 'text-[15px]'
        : activeCenterText.length > 6
          ? 'text-[18px]'
          : 'text-[22px]'

  const resolvePillToneCls = (tone?: V35DonutSummaryRow['tone']) =>
    tone === 'amber'
      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-200'
      : tone === 'rose'
        ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/45 dark:text-rose-200'
        : tone === 'neutral'
          ? 'bg-slate-100/80 text-slate-800 dark:bg-white/[0.05] dark:text-slate-200'
          : tone === 'blue'
            ? 'bg-blue-50/90 text-blue-950 dark:bg-sky-950/50 dark:text-sky-200'
            : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'

  const resolveValToneCls = (tone?: V35DonutSummaryRow['tone']) =>
    tone === 'amber'
      ? 'text-amber-800 dark:text-amber-300'
      : tone === 'rose'
        ? 'text-rose-700 dark:text-rose-300'
        : tone === 'neutral'
          ? 'text-slate-950 dark:text-white'
          : tone === 'blue'
            ? 'text-blue-700 dark:text-sky-300'
            : 'text-emerald-700 dark:text-emerald-300'

  const allSummaryRows: V35DonutSummaryRow[] = summaryRows
    ? summaryRows
    : summaryPill
      ? [summaryPill]
      : []

  const resolvedDonutAria =
    ariaLabel ??
    ([centerLabel, centerValue].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط دائري لتوزيع الحصص' : 'Distribution donut chart'))

  const renderDonutTooltip = (props: RechartsTooltipRenderProps) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null
    const raw = props.payload[0]?.payload as (typeof normalizedSlices)[number] | undefined
    if (!raw) return null
    return (
      <GlassTooltipLines
        title={raw.label}
        badgeText={raw.pctFormatted}
        badgeTone="neutral"
        lines={[
          {
            label: isAr ? 'القيمة' : 'Value',
            value: raw.valueFormatted,
            bold: true,
            tone: 'blue',
          },
        ]}
        isAr={isAr}
      />
    )
  }

  const pieData = positiveSlices.length > 0 ? positiveSlices : normalizedSlices

  const ringBlock = (
    <div
      role="img"
      aria-label={resolvedDonutAria}
      className="relative mx-auto flex h-[220px] w-full max-w-[232px] shrink-0 items-center justify-center"
    >
      <div className="h-[220px] w-full min-w-0" style={{ minHeight: 220 }}>
        <ResponsiveContainer
          width="100%"
          height={220}
          minHeight={220}
          initialDimension={RESPONSIVE_SSR_DIMENSION}
        >
          <PieChart>
            <Pie
              data={pieData}
              dataKey="safeVal"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="92%"
              paddingAngle={activeCount > 1 ? 2.5 : 0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_entry, idx) => {
                const target = pieData[idx]
                if (target) setHoveredId(target.id)
              }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(_entry, idx) => {
                const target = pieData[idx]
                if (target && onSelectSlice) onSelectSlice(target.id)
              }}
            >
              {pieData.map((slice) => {
                const isDimmed = hoveredId !== null && hoveredId !== slice.id
                return (
                  <Cell
                    key={slice.id}
                    fill={slice.resolvedColor}
                    fillOpacity={isDimmed ? 0.4 : 1}
                    className={onSelectSlice ? 'cursor-pointer' : undefined}
                  />
                )
              })}
            </Pie>
            <Tooltip content={renderDonutTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center safe-zone inside the 70% inner ring diameter */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="mx-auto flex h-[116px] w-[116px] max-w-[62%] flex-col items-center justify-center px-1.5 text-center tabular-nums">
          <span
            dir="ltr"
            className={`${centerFontCls} max-w-[104px] whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums text-slate-950 dark:text-white`}
          >
            {activeCenterText}
          </span>
          {centerSubValue && !hoveredSlice ? (
            <span
              dir={dir}
              className="mt-1 max-w-[104px] whitespace-nowrap text-xs font-semibold tabular-nums text-blue-700 dark:text-sky-300"
            >
              {centerSubValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span className="mt-1.5 max-w-[104px] whitespace-normal text-xs font-semibold leading-tight text-slate-600 dark:text-slate-300">
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
      {normalizedSlices.map((s) => {
        const isHovered = hoveredId === s.id
        const isSelected = activeSliceId === s.id
        return (
          <div
            key={s.id}
            role={onSelectSlice ? 'button' : undefined}
            aria-pressed={onSelectSlice ? isSelected : undefined}
            tabIndex={0}
            onClick={onSelectSlice ? () => onSelectSlice(s.id) : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setHoveredId(null)
                return
              }
              if (onSelectSlice && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onSelectSlice(s.id)
              }
            }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
            onFocus={() => setHoveredId(s.id)}
            onBlur={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
            className={`ae-bento-subcard flex cursor-pointer flex-col justify-center gap-1 rounded-xl px-3 py-2.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              isSelected
                ? 'bg-blue-50/90 ring-1 ring-blue-500/45 dark:bg-sky-950/45 dark:ring-sky-400/40'
                : isHovered
                  ? 'bg-white ring-1 ring-blue-500/35 dark:bg-white/[0.08]'
                  : 'bg-slate-50/85 hover:bg-slate-100/90 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.resolvedColor }}
                  aria-hidden
                />
                <p className="whitespace-normal text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {s.label}
                </p>
              </div>
              <span
                dir="ltr"
                className="shrink-0 text-xs font-bold tabular-nums text-slate-950 dark:text-white"
              >
                {s.valueFormatted}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 ps-4">
              {s.subLabel ? (
                <p className="whitespace-normal text-xs font-medium leading-snug tabular-nums text-slate-600 dark:text-slate-300">
                  {s.subLabel}
                </p>
              ) : (
                <span />
              )}
              <span
                dir="ltr"
                className="shrink-0 rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
              >
                {s.pctFormatted}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const summaryBlock =
    allSummaryRows.length > 0 ? (
      <div className="space-y-1.5">
        {hoveredSlice ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50/90 px-3.5 py-2 text-xs text-blue-950 dark:bg-sky-950/50 dark:text-sky-200">
            <span className="whitespace-normal font-medium">{hoveredSlice.label}</span>
            <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-blue-700 dark:text-sky-300">
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
    ) : null

  if (legendLayout === 'beside') {
    return (
      <div
        dir={dir}
        data-chart-kind="v35-donut"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={`grid grid-cols-1 items-center gap-5 md:grid-cols-[224px_minmax(0,1fr)] ${className}`}
      >
        {ringBlock}
        <div className="min-w-0 space-y-2.5">
          {summaryBlock}
          {legendBlock}
        </div>
      </div>
    )
  }

  return (
    <div
      dir={dir}
      data-chart-kind="v35-donut"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={`flex flex-col justify-between gap-3.5 ${className}`}
    >
      {ringBlock}
      {summaryBlock}
      {legendBlock}
    </div>
  )
}

/**
 * Dual-Scale Composed Bar + Line Chart for Sales (`pos.order`) vs GL Operating Profit.
 * Built on Recharts `<ComposedChart>` with V35 slate bars + cobalt line and frosted tooltips.
 */
export function SalesNetComposedChart({
  data,
  isAr,
  salesLegend,
  netLegend,
  height = 240,
  title,
  periodLabel,
  unitLabel,
  xAxisLabel,
  ariaLabel,
  className = '',
}: SalesNetComposedChartProps) {
  const locale: FormatLocale = isAr ? 'ar' : 'en'
  const chartHeight = Math.max(220, height)
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const netAxisSide = isAr ? 'left' : 'right'
  const xAxisReversed = isAr ? 'true' : 'false'

  const metaSubtitle = [periodLabel, unitLabel].filter(Boolean).join(' · ')
  const resolvedAriaLabel =
    ariaLabel ??
    ([title, salesLegend, netLegend, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط المبيعات وصافي الربح' : 'Sales and net profit chart'))

  const plottedData = data.map((d) => ({
    ...d,
    axisLabel: formatCompactAxisLabel(d.label),
    salesKwd: safeFinite(d.salesKwd),
    netKwd: safeFinite(d.netKwd),
  }))

  const renderTooltip = (props: RechartsTooltipRenderProps) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null
    const row = props.payload[0]?.payload as (typeof plottedData)[number] | undefined
    if (!row) return null
    return (
      <GlassTooltipLines
        title={row.tooltipTitle}
        badgeText={formatPct(row.netMarginPct, { locale })}
        badgeTone="blue"
        lines={row.lines}
        isAr={isAr}
      />
    )
  }

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="sales-net-combo"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={`relative select-none space-y-3 ${className}`}
    >
      {title || metaSubtitle ? (
        <div className="space-y-0.5">
          {title ? <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3> : null}
          {metaSubtitle ? (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metaSubtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <span
              className="h-3 w-2.5 rounded-sm"
              style={{ backgroundColor: V35_CHART_COLORS.comparison }}
              aria-hidden
            />
            <span>{salesLegend}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              ({isAr ? 'المحور الأيمن' : 'Left Axis'})
            </span>
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-blue-700 dark:text-sky-300">
            <span className="relative inline-flex h-3 w-5 items-center justify-center" aria-hidden>
              <span
                className="h-[2.5px] w-full rounded-full"
                style={{ backgroundColor: V35_CHART_COLORS.primary }}
              />
              <span
                className="absolute h-2 w-2 rounded-full ring-1 ring-white"
                style={{ backgroundColor: V35_CHART_COLORS.primary }}
              />
            </span>
            <span>{netLegend}</span>
            <span className="text-xs font-semibold text-blue-700 dark:text-sky-300">
              ({isAr ? 'المحور الأيسر المستقل' : 'Right Axis'})
            </span>
          </span>
        </div>
      </div>

      <div className={V35_CHART_PLOT_SURFACE_CLASS}>
        <div data-chart-axis-y="true" className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="whitespace-nowrap font-bold text-slate-600 dark:text-slate-300">
            {isAr ? 'المبيعات (ألف د.ك)' : 'Sales (K KWD)'}
          </span>
          <span className="whitespace-nowrap font-bold text-blue-700 dark:text-sky-300">
            {isAr ? 'الصافي بالجيب (ألف د.ك)' : 'Net Profit (K KWD)'}
          </span>
        </div>

        <div className="w-full min-w-0" style={{ height: chartHeight, minHeight: 220 }}>
          <ResponsiveContainer
            width="100%"
            height={chartHeight}
            minHeight={220}
            initialDimension={RESPONSIVE_SSR_DIMENSION}
          >
            <ComposedChart data={plottedData} margin={{ top: 10, right: 12, left: 12, bottom: 4 }}>
              <CartesianGrid {...V35_CHART_GRID_PROPS} />
              <XAxis
                dataKey="axisLabel"
                reversed={isAr}
                tick={V35_AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                yAxisId="sales"
                orientation={yAxisSide}
                tick={V35_AXIS_TICK_STYLE}
                tickFormatter={(v: number) => formatCompactKwdTick(v, isAr)}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <YAxis
                yAxisId="net"
                orientation={netAxisSide}
                tick={{ ...V35_AXIS_TICK_STYLE, fill: V35_CHART_COLORS.primary }}
                tickFormatter={(v: number) => formatCompactKwdTick(v, isAr)}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={renderTooltip}
              />
              <Bar
                yAxisId="sales"
                dataKey="salesKwd"
                name={salesLegend}
                fill={V35_CHART_COLORS.comparison}
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Line
                yAxisId="net"
                type="monotone"
                dataKey="netKwd"
                name={netLegend}
                stroke={V35_CHART_COLORS.primary}
                strokeWidth={2.5}
                dot={{
                  r: 3.5,
                  fill: V35_CHART_COLORS.primary,
                  stroke: '#FFFFFF',
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 5,
                  fill: V35_CHART_COLORS.primaryDeep,
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {xAxisLabel ? (
        <div
          data-chart-axis-x="true"
          className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
        >
          {xAxisLabel}
        </div>
      ) : null}
    </div>
  )
}
