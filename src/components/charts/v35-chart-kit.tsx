'use client'

import React, { useId, useState, type ReactNode } from 'react'
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
import {
  V35ChartCardHeader,
  V35Sparkline,
  formatChartKwdTooltip,
  type V35ChartCardHeaderProps,
  type V35SparklineProps,
} from '@/components/ui/chart-card'
import { UnavailableState } from '@/components/ui/unavailable-state'
import { cx } from '@/components/ui/cx'
import {
  V35_AXIS_TICK_STYLE,
  V35_CHART_COLORS,
  V35_CHART_GRID_PROPS,
  V35_CHART_PLOT_SURFACE_CLASS,
  V35_GLASS_TOOLTIP_CLASS,
  V35_HEATMAP_SCALE_DARK,
  V35_HEATMAP_SCALE_LIGHT,
  V35_TOOLTIP_TONE_CLASS,
  type ChartTooltipTone,
  formatCompactAxisLabel,
  formatCompactKwdTick,
  normalizeV35SeriesColor,
  resolveV35DonutColor,
} from '@/components/charts/v35-chart-theme'

export {
  V35ChartCardHeader,
  V35Sparkline,
  formatCompactAxisLabel,
  formatCompactKwdTick,
  type V35ChartCardHeaderProps,
  type V35SparklineProps,
}

export interface ChartTooltipLine {
  label: string
  value: string
  tone?: ChartTooltipTone
  bold?: boolean
}

export interface V35ChartHeaderExtraProps {
  subtitle?: ReactNode
  infoContent?: ReactNode
  infoLabel?: string
  kpiValue?: ReactNode
  deltaPct?: number | null
  deltaLabel?: string
  deltaHigherIsBetter?: boolean
  sparklineValues?: ReadonlyArray<number>
  unavailableReason?: string
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

export interface TimelineAreaChartProps extends V35ChartHeaderExtraProps {
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

export interface ComparisonBarChartProps extends V35ChartHeaderExtraProps {
  data: ComparisonBarDatum[]
  isAr: boolean
  primaryLabel?: string
  comparisonLabel?: string
  primaryColor?: string
  comparisonColor?: string
  stacked?: boolean
  showGhostBars?: boolean
  hourlyFallback?: TimelineHourlyDatum[]
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

export interface V35DonutChartProps extends V35ChartHeaderExtraProps {
  slices: V35DonutSlice[]
  centerValue: string
  centerSubValue?: string
  centerLabel?: string
  summaryPill?: V35DonutSummaryRow
  summaryRows?: V35DonutSummaryRow[]
  activeSliceId?: string
  onSelectSlice?: (id: string) => void
  isAr: boolean
  title?: ReactNode
  periodLabel?: string
  unitLabel?: string
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

export interface SalesNetComposedChartProps extends V35ChartHeaderExtraProps {
  data: SalesNetComposedDatum[]
  isAr: boolean
  salesLegend: string
  netLegend: string
  showGhostBars?: boolean
  height?: number
  title?: string
  periodLabel?: string
  unitLabel?: string
  xAxisLabel?: string
  ariaLabel?: string
  className?: string
}

export interface StackedProgressSegment {
  id: string
  label: string
  subLabel?: string
  value: number
  valueFormatted?: string
  pctFormatted?: string
  color?: string
  orders?: number
  tooltipLines?: ReadonlyArray<ChartTooltipLine>
}

export interface StackedProgressBarProps extends V35ChartHeaderExtraProps {
  segments?: ReadonlyArray<StackedProgressSegment>
  /** Optional alias for `segments`. */
  items?: ReadonlyArray<StackedProgressSegment>
  isAr?: boolean
  locale?: FormatLocale
  title?: ReactNode
  periodLabel?: string
  unitLabel?: string
  activeSegmentId?: string
  onSelectSegment?: (id: string) => void
  ariaLabel?: string
  className?: string
}

export interface HourWeekdayHeatmapCell {
  /** Day of week: 0 = Sun .. 6 = Sat */
  dow: number
  /** Hour of day: 0 .. 23 */
  hour: number
  /** Real net sales in KWD */
  salesKwd: number
  /** Optional real order count */
  orders?: number
}

export interface HourWeekdayHeatmapProps extends V35ChartHeaderExtraProps {
  cells?: ReadonlyArray<HourWeekdayHeatmapCell> | null
  isAr?: boolean
  locale?: FormatLocale
  title?: ReactNode
  periodLabel?: string
  unitLabel?: string
  weekdayOrder?: ReadonlyArray<number>
  hours?: ReadonlyArray<number>
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
const GHOST_BAR_FILL = 'var(--v35-chart-ghost, rgba(226, 232, 240, 0.72))'

const DEFAULT_WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const

const WEEKDAY_LABELS_AR: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
}

const WEEKDAY_LABELS_EN: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

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
  className = '',
}: {
  title: string
  badgeText?: string
  badgeTone?: 'emerald' | 'rose' | 'amber' | 'neutral' | 'blue'
  lines: ReadonlyArray<ChartTooltipLine>
  isAr: boolean
  className?: string
}) {
  const badgeCls =
    badgeTone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700'
      : badgeTone === 'rose'
        ? 'bg-rose-50 text-rose-700'
        : badgeTone === 'amber'
          ? 'bg-amber-50 text-amber-800'
          : badgeTone === 'blue'
            ? 'bg-[#ECFDF5] text-[#047857]'
            : 'bg-slate-100 text-slate-800'

  return (
    <div
      role="tooltip"
      dir={isAr ? 'rtl' : 'ltr'}
      className={cx(V35_GLASS_TOOLTIP_CLASS, className)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
        <span className="font-bold text-slate-950">{title}</span>
        {badgeText ? (
          <span
            dir="ltr"
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${badgeCls}`}
          >
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
 * - Multi-day `dailySeries`: smooth `monotone` Recharts `<AreaChart>` with thin `strokeWidth={2}`,
 *   soft vertical gradient (`0.22 -> 0.01`), and faint horizontal gridlines.
 * - 1-point `dailySeries` WITH non-empty `hourlySeries`: smooth hourly `<AreaChart>` (`data-chart-mode="hourly-area"`).
 * - 1-point `dailySeries` WITHOUT `hourlySeries`: compact single-value stat (`data-chart-mode="single-stat"`, ZERO `<rect>` bars).
 * - Empty `dailySeries`: calm `<UnavailableState compact isAr={isAr} />`.
 */
export function TimelineAreaChart({
  dailySeries,
  hourlySeries,
  secondarySeries,
  isAr,
  title,
  subtitle,
  valueLabel,
  secondaryLabel,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
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
  const resolvedAriaLabel =
    ariaLabel ??
    ([title, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط الاتجاه الزمني' : 'Timeline area chart'))

  const fmtVal = (v: number) =>
    formatValue ? formatValue(v) : formatChartKwdTooltip(v, locale)
  const fmtTick = (v: number) =>
    formatTick ? formatTick(v) : formatCompactKwdTick(v, isAr)

  const headerNode = (
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
      locale={locale}
    />
  )

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
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
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
        className={cx('space-y-3', className)}
      >
        {headerNode}

        <div className="rounded-2xl border border-slate-200/85 bg-slate-50/75 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-800/45">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-[#ECFDF5] px-3 py-1 text-xs font-semibold text-[#047857] dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
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
                className="text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-slate-950 dark:text-white"
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
            <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-2 dark:border-slate-800">
              {point.tooltipLines.map((line, idx) => (
                <div
                  key={`${line.label}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/75 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60"
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
      className={cx('select-none space-y-3', className)}
    >
      {headerNode}

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
                  <stop offset="0%" stopColor={V35_CHART_COLORS.primary} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={V35_CHART_COLORS.primaryDark} stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id={`v35AreaSec-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={V35_CHART_COLORS.comparison} stopOpacity={0.14} />
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
                  strokeWidth={1.75}
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
                strokeWidth={2}
                fill={`url(#v35Area-${safeId})`}
                dot={false}
                activeDot={{
                  r: 4.5,
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
 * - Slim rounded bars (`maxBarSize={hasComparison ? 16 : 22}`, `radius={[6, 6, 0, 0]}`, `barCategoryGap="28%"`)
 *   with light background "ghost" bars (`showGhostBars = true`) for visual context.
 * - Optional `hourlyFallback`: when `data.length === 1 && !hasComparison && hourlyFallback.length > 0`,
 *   delegates cleanly to `TimelineAreaChart` (`hourly-area`).
 * - Empty `data`: renders `<UnavailableState compact isAr={isAr} />`.
 */
export function ComparisonBarChart({
  data,
  isAr,
  primaryLabel,
  comparisonLabel,
  primaryColor = V35_CHART_COLORS.primary,
  comparisonColor = V35_CHART_COLORS.comparison,
  stacked = false,
  showGhostBars = true,
  hourlyFallback,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  xAxisLabel,
  yAxisLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
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

  const resolvedAriaLabel =
    ariaLabel ??
    ([title, primaryLabel, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط الأعمدة المقارن' : 'Comparison bar chart'))

  const hasComparison = data.some(
    (d) => typeof d.comparisonValue === 'number' && Number.isFinite(d.comparisonValue),
  )

  if (
    data.length === 1 &&
    !hasComparison &&
    Array.isArray(hourlyFallback) &&
    hourlyFallback.length > 0
  ) {
    const single = data[0]
    return (
      <TimelineAreaChart
        dailySeries={[
          {
            day: single.tooltipTitle ?? single.id ?? single.label,
            label: single.label,
            netKwd: safeFinite(single.value),
            tooltipLines: single.lines,
          },
        ]}
        hourlySeries={hourlyFallback}
        isAr={isAr}
        title={title}
        subtitle={subtitle}
        valueLabel={primarySeriesName}
        periodLabel={periodLabel}
        unitLabel={unitLabel}
        xAxisLabel={xAxisLabel}
        yAxisLabel={yAxisLabel}
        infoContent={infoContent}
        infoLabel={infoLabel}
        kpiValue={kpiValue}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
        deltaHigherIsBetter={deltaHigherIsBetter}
        sparklineValues={sparklineValues}
        unavailableReason={unavailableReason}
        formatValue={formatTooltip ? (v) => formatTooltip(v, false) : undefined}
        formatTick={formatTick}
        height={height}
        ariaLabel={resolvedAriaLabel}
        className={className}
      />
    )
  }

  const headerNode = (
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
      locale={locale}
    />
  )

  if (data.length === 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="comparison-bar"
        data-chart-mode="empty"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
      </div>
    )
  }

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

  const hasCustomPrimaryColors = plottedData.some((d) => Boolean(d.primaryColor))
  const hasCustomComparisonColors = plottedData.some((d) => Boolean(d.comparisonColor))
  const ghostBarBackground = showGhostBars ? { fill: GHOST_BAR_FILL, radius: 6 } : undefined

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

  const barMaxWidth = hasComparison ? 16 : 22

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="comparison-bar"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={cx('select-none space-y-3', className)}
    >
      {headerNode}

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
                  maxBarSize={barMaxWidth}
                  background={stacked ? undefined : ghostBarBackground}
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
                maxBarSize={barMaxWidth}
                background={ghostBarBackground}
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
 * - Thin ring (`innerRadius="72%"`, `outerRadius="92%"`, `cornerRadius={5}`) on Recharts `<PieChart>`.
 * - Soft V35 palette (`V35_DONUT_PALETTE`) + center value, subvalue, and label inside the hole.
 * - Interactive 1px hairline legend cards with hover/focus 3-decimal KWD tooltip.
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
  title,
  subtitle,
  periodLabel,
  unitLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
  legendColumns = 2,
  legendLayout = 'beside',
  ariaLabel,
  className = '',
}: V35DonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const locale: FormatLocale = isAr ? 'ar' : 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const xAxisReversed = isAr ? 'true' : 'false'

  const headerNode = (
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
      locale={locale}
    />
  )

  const resolvedDonutAria =
    ariaLabel ??
    ([centerLabel, centerValue].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط دائري لتوزيع الحصص' : 'Distribution donut chart'))

  if (slices.length === 0) {
    return (
      <div
        dir={dir}
        data-chart-kind="v35-donut"
        data-chart-mode="unavailable"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
      </div>
    )
  }

  const normalizedSlices = slices.map((s, idx) => ({
    ...s,
    safeVal: safeFinite(s.value),
    resolvedColor: resolveV35DonutColor(idx, s.color),
  }))
  const positiveSlices = normalizedSlices.filter((s) => s.safeVal > 0)
  const activeCount = positiveSlices.length

  const highlightedId = hoveredId ?? focusedId
  const highlightedSlice = highlightedId
    ? normalizedSlices.find((s) => s.id === highlightedId) ?? null
    : null
  const activeCenterText = highlightedSlice ? highlightedSlice.pctFormatted : centerValue
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
          ? 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/70 dark:text-slate-200'
          : tone === 'blue'
            ? 'bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/50 dark:text-emerald-200'
            : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'

  const resolveValToneCls = (tone?: V35DonutSummaryRow['tone']) =>
    tone === 'amber'
      ? 'text-amber-800 dark:text-amber-300'
      : tone === 'rose'
        ? 'text-rose-700 dark:text-rose-300'
        : tone === 'neutral'
          ? 'text-slate-950 dark:text-white'
          : tone === 'blue'
            ? 'text-[#047857] dark:text-emerald-300'
            : 'text-emerald-700 dark:text-emerald-300'

  const allSummaryRows: V35DonutSummaryRow[] = summaryRows
    ? summaryRows
    : summaryPill
      ? [summaryPill]
      : []

  const resolveSliceDisplayValue = (slice: (typeof normalizedSlices)[number]) =>
    slice.valueFormatted || formatChartKwdTooltip(slice.safeVal, locale)

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
            value: resolveSliceDisplayValue(raw),
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
              innerRadius="72%"
              outerRadius="92%"
              paddingAngle={activeCount > 1 ? 2.5 : 0}
              cornerRadius={5}
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
                const isDimmed = highlightedId !== null && highlightedId !== slice.id
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

      {/* Center safe-zone inside the 72% inner ring diameter */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="mx-auto flex h-[116px] w-[116px] max-w-[62%] flex-col items-center justify-center px-1.5 text-center tabular-nums">
          <span
            dir="ltr"
            className={`${centerFontCls} max-w-[104px] whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums text-slate-950 dark:text-white`}
          >
            {activeCenterText}
          </span>
          {centerSubValue && !highlightedSlice ? (
            <span
              dir={dir}
              className="mt-1 max-w-[104px] whitespace-nowrap text-xs font-semibold tabular-nums text-[#047857] dark:text-emerald-300"
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
        const isFocused = focusedId === s.id
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
                setFocusedId(null)
                return
              }
              if (onSelectSlice && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onSelectSlice(s.id)
              }
            }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
            onFocus={() => setFocusedId(s.id)}
            onBlur={() => setFocusedId((cur) => (cur === s.id ? null : cur))}
            className={cx(
              'relative flex cursor-pointer flex-col justify-center gap-1 rounded-xl border px-3 py-2.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60',
              isSelected
                ? 'border-emerald-600/45 bg-[#ECFDF5] dark:border-emerald-400/50 dark:bg-emerald-950/40'
                : isHovered || isFocused
                  ? 'border-emerald-500/45 bg-white shadow-[0_2px_6px_rgba(30,58,95,0.03)] dark:border-emerald-400/40 dark:bg-slate-800/80'
                  : 'border-[#1E3A5F]/[0.08] bg-white hover:border-[#1E3A5F]/20 hover:bg-[#F4F8F6]/70 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-slate-700 dark:hover:bg-slate-800/70',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.resolvedColor }}
                  aria-hidden
                />
                <p className="whitespace-normal text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {s.label}
                </p>
              </div>
              <span
                dir="ltr"
                className="shrink-0 text-xs font-bold tabular-nums text-slate-950 dark:text-white"
              >
                {resolveSliceDisplayValue(s)}
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
                className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {s.pctFormatted}
              </span>
            </div>

            {isFocused ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-full z-30 mb-1.5">
                <GlassTooltipLines
                  title={s.label}
                  badgeText={s.pctFormatted}
                  badgeTone="neutral"
                  lines={[
                    {
                      label: isAr ? 'القيمة' : 'Value',
                      value: resolveSliceDisplayValue(s),
                      bold: true,
                      tone: 'blue',
                    },
                  ]}
                  isAr={isAr}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )

  const summaryBlock =
    allSummaryRows.length > 0 ? (
      <div className="space-y-1.5">
        {highlightedSlice ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-600/20 bg-[#ECFDF5] px-3.5 py-2 text-xs text-[#1E3A5F] dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-200">
            <span className="whitespace-normal font-medium">{highlightedSlice.label}</span>
            <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-[#047857] dark:text-emerald-300">
              {resolveSliceDisplayValue(highlightedSlice)} ({highlightedSlice.pctFormatted})
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

  const body =
    legendLayout === 'beside' ? (
      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[224px_minmax(0,1fr)]">
        {ringBlock}
        <div className="min-w-0 space-y-2.5">
          {summaryBlock}
          {legendBlock}
        </div>
      </div>
    ) : (
      <div className="flex flex-col justify-between gap-3.5">
        {ringBlock}
        {summaryBlock}
        {legendBlock}
      </div>
    )

  return (
    <div
      dir={dir}
      data-chart-kind="v35-donut"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={cx('space-y-3', className)}
    >
      {headerNode}
      {body}
    </div>
  )
}

/**
 * V35 Stacked Horizontal Progress Bar for branch / channel / category mix.
 * - 100% dynamic from caller `segments` / `items` (zero hardcoded vendor names).
 * - Interactive hover/focus 3-decimal KWD tooltip (`formatChartKwdTooltip`) + hairline breakdown rows.
 * - Missing, empty, or zero-total input renders calm `<UnavailableState compact />`.
 */
export function StackedProgressBar({
  segments,
  items,
  isAr,
  locale,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
  activeSegmentId,
  onSelectSegment,
  ariaLabel,
  className = '',
}: StackedProgressBarProps) {
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null)
  const resolvedLocale: FormatLocale = locale ?? (isAr === false ? 'en' : 'ar')
  const resolvedIsAr = isAr ?? resolvedLocale !== 'en'
  const dir = resolvedIsAr ? 'rtl' : 'ltr'
  const rawList = segments ?? items ?? []

  const resolvedAriaLabel =
    ariaLabel ??
    ([typeof title === 'string' ? title : '', periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (resolvedIsAr ? 'شريط توزيع الحصص' : 'Stacked mix progress bar'))

  const headerNode = (
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
      isAr={resolvedIsAr}
      locale={resolvedLocale}
    />
  )

  const normalized = rawList.map((seg, idx) => ({
    ...seg,
    safeVal: safeFinite(seg.value),
    resolvedColor: resolveV35DonutColor(idx, seg.color),
  }))
  const total = normalized.reduce((sum, seg) => sum + seg.safeVal, 0)

  if (normalized.length === 0 || total <= 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="stacked-progress"
        data-chart-mode="unavailable"
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={resolvedIsAr} reason={unavailableReason} />
      </div>
    )
  }

  const enriched = normalized.map((seg) => {
    const pct = total > 0 ? (seg.safeVal / total) * 100 : 0
    return {
      ...seg,
      pct,
      formattedValue: seg.valueFormatted ?? formatChartKwdTooltip(seg.safeVal, resolvedLocale),
      formattedPct: seg.pctFormatted ?? formatPct(pct, { locale: resolvedLocale, decimals: 1 }),
    }
  })

  const hoveredSeg = activeHoverId
    ? enriched.find((seg) => seg.id === activeHoverId) ?? null
    : null

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="stacked-progress"
      data-chart-mode="ready"
      className={cx('space-y-3.5', className)}
    >
      {headerNode}

      <div className="relative">
        <div
          role="group"
          aria-label={resolvedAriaLabel}
          className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80"
        >
          {enriched.map((seg) => {
            if (seg.safeVal <= 0) return null
            const dimmed = activeHoverId !== null && activeHoverId !== seg.id
            return (
              <button
                key={`track-${seg.id}`}
                type="button"
                aria-label={`${seg.label}: ${seg.formattedValue} (${seg.formattedPct})`}
                onMouseEnter={() => setActiveHoverId(seg.id)}
                onMouseLeave={() => setActiveHoverId((cur) => (cur === seg.id ? null : cur))}
                onFocus={() => setActiveHoverId(seg.id)}
                onBlur={() => setActiveHoverId((cur) => (cur === seg.id ? null : cur))}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setActiveHoverId(null)
                }}
                onClick={onSelectSegment ? () => onSelectSegment(seg.id) : undefined}
                style={{
                  width: `${Math.max(0.5, seg.pct)}%`,
                  backgroundColor: seg.resolvedColor,
                }}
                className={cx(
                  'h-full border-e border-white/70 transition-opacity duration-150 last:border-e-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:border-slate-900/70',
                  onSelectSegment ? 'cursor-pointer' : 'cursor-default',
                  dimmed ? 'opacity-45' : 'opacity-100',
                )}
              />
            )
          })}
        </div>

        {hoveredSeg ? (
          <div className="pointer-events-none absolute start-0 top-full z-30 mt-2">
            <GlassTooltipLines
              title={hoveredSeg.label}
              badgeText={hoveredSeg.formattedPct}
              badgeTone="neutral"
              lines={
                hoveredSeg.tooltipLines && hoveredSeg.tooltipLines.length > 0
                  ? hoveredSeg.tooltipLines
                  : [
                      {
                        label: resolvedIsAr ? 'القيمة' : 'Value',
                        value: hoveredSeg.formattedValue,
                        bold: true,
                        tone: 'blue',
                      },
                      ...(typeof hoveredSeg.orders === 'number' && Number.isFinite(hoveredSeg.orders)
                        ? [
                            {
                              label: resolvedIsAr ? 'الطلبات' : 'Orders',
                              value: formatInt(hoveredSeg.orders, { locale: resolvedLocale }),
                              tone: 'neutral' as const,
                            },
                          ]
                        : []),
                    ]
              }
              isAr={resolvedIsAr}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {enriched.map((seg) => {
          const isHovered = activeHoverId === seg.id
          const isSelected = activeSegmentId === seg.id
          const isInteractive = typeof onSelectSegment === 'function'
          const fillWidth = seg.safeVal > 0 ? Math.max(2, Math.min(100, seg.pct)) : 0

          return (
            <div
              key={seg.id}
              role={isInteractive ? 'button' : undefined}
              aria-pressed={isInteractive ? isSelected : undefined}
              tabIndex={0}
              onClick={isInteractive ? () => onSelectSegment(seg.id) : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setActiveHoverId(null)
                  return
                }
                if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onSelectSegment(seg.id)
                }
              }}
              onMouseEnter={() => setActiveHoverId(seg.id)}
              onMouseLeave={() => setActiveHoverId((cur) => (cur === seg.id ? null : cur))}
              onFocus={() => setActiveHoverId(seg.id)}
              onBlur={() => setActiveHoverId((cur) => (cur === seg.id ? null : cur))}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-start transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60',
                isInteractive ? 'cursor-pointer' : '',
                isSelected
                  ? 'border-emerald-600/45 bg-[#ECFDF5] dark:border-emerald-400/45 dark:bg-emerald-950/35'
                  : isHovered
                    ? 'border-emerald-500/45 bg-[#F4F8F6]/70 dark:border-emerald-400/35 dark:bg-slate-800/70'
                    : 'border-[#1E3A5F]/[0.08] bg-white hover:border-[#1E3A5F]/20 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-slate-700',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.resolvedColor }}
                    aria-hidden
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {seg.label}
                  </span>
                  {seg.subLabel ? (
                    <span className="ms-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {seg.subLabel}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span dir="ltr" className="font-bold tabular-nums text-slate-950 dark:text-white">
                    {seg.formattedValue}
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {seg.formattedPct}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D1FAE5]/55 dark:bg-slate-800/80">
                <div
                  style={{ width: `${fillWidth}%`, backgroundColor: seg.resolvedColor }}
                  className="h-full rounded-full transition-all duration-150"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function resolveHeatLevel(value: number, minVal: number, maxVal: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(value) || value <= 0 || maxVal <= 0) return 0
  if (maxVal === minVal) return 3
  const ratio = (value - minVal) / (maxVal - minVal)
  if (ratio <= 0.15) return 0
  if (ratio <= 0.4) return 1
  if (ratio <= 0.65) return 2
  if (ratio <= 0.85) return 3
  return 4
}

/**
 * V35 Hour × Weekday Activity Heatmap (strict Answer 3):
 * - Renders the Hour × Weekday matrix ONLY when non-empty real `cells` are supplied.
 * - Missing/null/empty `cells` immediately render `<UnavailableState compact />` (`«غير متاح بعد»`) with zero fabricated cells.
 * - Missing `(dow, hour)` intersections inside a partial matrix render empty unavailable slots (never `0.000 KWD`).
 */
export function HourWeekdayHeatmap({
  cells,
  isAr,
  locale,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
  weekdayOrder,
  hours,
  ariaLabel,
  className = '',
}: HourWeekdayHeatmapProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const resolvedLocale: FormatLocale = locale ?? (isAr === false ? 'en' : 'ar')
  const resolvedIsAr = isAr ?? resolvedLocale !== 'en'
  const dir = resolvedIsAr ? 'rtl' : 'ltr'

  const resolvedAriaLabel =
    ariaLabel ??
    ([typeof title === 'string' ? title : '', periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (resolvedIsAr ? 'خريطة النشاط بالساعة واليوم' : 'Hour by weekday activity heatmap'))

  const headerNode = (
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
      isAr={resolvedIsAr}
      locale={resolvedLocale}
    />
  )

  const validCells = (cells ?? []).filter(
    (c): c is HourWeekdayHeatmapCell =>
      Boolean(c) &&
      Number.isInteger(c.dow) &&
      c.dow >= 0 &&
      c.dow <= 6 &&
      Number.isInteger(c.hour) &&
      c.hour >= 0 &&
      c.hour <= 23 &&
      typeof c.salesKwd === 'number' &&
      Number.isFinite(c.salesKwd) &&
      c.salesKwd >= 0,
  )

  if (validCells.length === 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="hour-weekday-heatmap"
        data-chart-mode="unavailable"
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={resolvedIsAr} reason={unavailableReason} />
      </div>
    )
  }

  const cellMap = new Map<string, HourWeekdayHeatmapCell>()
  let minSales = Number.POSITIVE_INFINITY
  let maxSales = 0

  for (const cell of validCells) {
    const key = `${cell.dow}-${cell.hour}`
    cellMap.set(key, cell)
    if (cell.salesKwd < minSales) minSales = cell.salesKwd
    if (cell.salesKwd > maxSales) maxSales = cell.salesKwd
  }
  if (!Number.isFinite(minSales)) minSales = 0

  const resolvedHours: number[] =
    hours && hours.length > 0
      ? Array.from(new Set(hours.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))).sort(
          (a, b) => a - b,
        )
      : (() => {
          const allH = validCells.map((c) => c.hour)
          const minH = Math.min(...allH)
          const maxH = Math.max(...allH)
          const list: number[] = []
          for (let h = minH; h <= maxH; h += 1) {
            list.push(h)
          }
          return list
        })()

  const resolvedDays: number[] =
    weekdayOrder && weekdayOrder.length > 0
      ? weekdayOrder.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [...DEFAULT_WEEKDAY_ORDER]

  const weekdayLabels = resolvedIsAr ? WEEKDAY_LABELS_AR : WEEKDAY_LABELS_EN
  const activeCell = activeKey ? cellMap.get(activeKey) ?? null : null

  return (
    <div
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-kind="hour-weekday-heatmap"
      data-chart-mode="matrix"
      className={cx('relative space-y-3', className)}
    >
      {headerNode}

      <div className="min-w-0 overflow-x-auto pb-1">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="min-w-[64px] py-1 text-start text-xs font-semibold text-slate-500 dark:text-slate-400">
                {resolvedIsAr ? 'اليوم' : 'Day'}
              </th>
              {resolvedHours.map((h) => (
                <th
                  key={`h-${h}`}
                  className="min-w-[26px] py-1 text-center text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400"
                >
                  <span dir="ltr">{String(h).padStart(2, '0')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resolvedDays.map((dow) => {
              const dayName = weekdayLabels[dow] ?? String(dow)
              return (
                <tr key={`d-${dow}`}>
                  <th
                    scope="row"
                    className="whitespace-nowrap pe-2 text-start text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {dayName}
                  </th>
                  {resolvedHours.map((h) => {
                    const cellKey = `${dow}-${h}`
                    const cell = cellMap.get(cellKey)
                    if (!cell) {
                      return (
                        <td key={cellKey} className="p-0">
                          <span
                            aria-hidden="true"
                            data-heat-empty="true"
                            className="block h-6 w-full min-w-[24px] rounded-md border border-dashed border-slate-200/80 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30"
                          />
                        </td>
                      )
                    }

                    const level = resolveHeatLevel(cell.salesKwd, minSales, maxSales)
                    const formattedSales = formatChartKwdTooltip(cell.salesKwd, resolvedLocale)
                    const hourLabel = formatHourTickLabel(h)
                    const cellStyle = {
                      '--hm-light': V35_HEATMAP_SCALE_LIGHT[level],
                      '--hm-dark': V35_HEATMAP_SCALE_DARK[level],
                    } as React.CSSProperties

                    return (
                      <td key={cellKey} className="p-0">
                        <button
                          type="button"
                          data-heat-level={level}
                          aria-label={`${dayName} ${hourLabel}: ${formattedSales}`}
                          onMouseEnter={() => setActiveKey(cellKey)}
                          onMouseLeave={() => setActiveKey((cur) => (cur === cellKey ? null : cur))}
                          onFocus={() => setActiveKey(cellKey)}
                          onBlur={() => setActiveKey((cur) => (cur === cellKey ? null : cur))}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setActiveKey(null)
                          }}
                          style={cellStyle}
                          className={cx(
                            'block h-6 w-full min-w-[24px] cursor-pointer rounded-md bg-[var(--hm-light)] transition-transform duration-150 hover:scale-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:bg-[var(--hm-dark)]',
                            activeKey === cellKey ? 'ring-2 ring-blue-600/70 dark:ring-sky-300/70' : '',
                          )}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {activeCell ? (
        <div className="pointer-events-none absolute end-2 top-2 z-30">
          <GlassTooltipLines
            title={`${weekdayLabels[activeCell.dow] ?? activeCell.dow} · ${formatHourTickLabel(activeCell.hour)}`}
            lines={[
              {
                label: resolvedIsAr ? 'صافي المبيعات' : 'Net Sales',
                value: formatChartKwdTooltip(activeCell.salesKwd, resolvedLocale),
                bold: true,
                tone: 'blue',
              },
              ...(typeof activeCell.orders === 'number' && Number.isFinite(activeCell.orders)
                ? [
                    {
                      label: resolvedIsAr ? 'الطلبات' : 'Orders',
                      value: formatInt(activeCell.orders, { locale: resolvedLocale }),
                      tone: 'neutral' as const,
                    },
                  ]
                : []),
            ]}
            isAr={resolvedIsAr}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span>{resolvedIsAr ? 'الأقل' : 'Less'}</span>
        {([0, 1, 2, 3, 4] as const).map((lvl) => (
          <span
            key={`legend-${lvl}`}
            aria-hidden="true"
            style={
              {
                '--hm-light': V35_HEATMAP_SCALE_LIGHT[lvl],
                '--hm-dark': V35_HEATMAP_SCALE_DARK[lvl],
              } as React.CSSProperties
            }
            className="h-3 w-3 rounded-sm bg-[var(--hm-light)] dark:bg-[var(--hm-dark)]"
          />
        ))}
        <span>{resolvedIsAr ? 'الأعلى' : 'More'}</span>
      </div>
    </div>
  )
}

/**
 * Dual-Scale Composed Bar + Line Chart for Sales (`pos.order`) vs GL Operating Profit.
 * Built on Recharts `<ComposedChart>` with slim ghost-backed sales bars (`maxBarSize={20}`)
 * and smooth cobalt `monotone` operating profit line (`strokeWidth={2}`).
 */
export function SalesNetComposedChart({
  data,
  isAr,
  salesLegend,
  netLegend,
  showGhostBars = true,
  height = 240,
  title,
  subtitle,
  periodLabel,
  unitLabel,
  xAxisLabel,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter,
  sparklineValues,
  unavailableReason,
  ariaLabel,
  className = '',
}: SalesNetComposedChartProps) {
  const locale: FormatLocale = isAr ? 'ar' : 'en'
  const chartHeight = Math.max(220, height)
  const dir = isAr ? 'rtl' : 'ltr'
  const yAxisSide = isAr ? 'right' : 'left'
  const netAxisSide = isAr ? 'left' : 'right'
  const xAxisReversed = isAr ? 'true' : 'false'

  const resolvedAriaLabel =
    ariaLabel ??
    ([title, salesLegend, netLegend, periodLabel, unitLabel].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط المبيعات وصافي الربح' : 'Sales and net profit chart'))

  const headerNode = (
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
      locale={locale}
    />
  )

  if (data.length === 0) {
    return (
      <div
        role="region"
        aria-label={resolvedAriaLabel}
        dir={dir}
        data-chart-kind="sales-net-combo"
        data-chart-mode="empty"
        data-y-axis-side={yAxisSide}
        data-x-axis-reversed={xAxisReversed}
        className={cx('space-y-3', className)}
      >
        {headerNode}
        <UnavailableState compact isAr={isAr} reason={unavailableReason} />
      </div>
    )
  }

  const plottedData = data.map((d) => ({
    ...d,
    axisLabel: formatCompactAxisLabel(d.label),
    salesKwd: safeFinite(d.salesKwd),
    netKwd: safeFinite(d.netKwd),
  }))

  const ghostBarBackground = showGhostBars ? { fill: GHOST_BAR_FILL, radius: 6 } : undefined

  const renderTooltip = (props: RechartsTooltipRenderProps) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null
    const row = props.payload[0]?.payload as (typeof plottedData)[number] | undefined
    if (!row) return null
    const lines: ReadonlyArray<ChartTooltipLine> =
      row.lines && row.lines.length > 0
        ? row.lines
        : [
            {
              label: salesLegend,
              value: formatChartKwdTooltip(row.salesKwd, locale),
              tone: 'slate',
            },
            {
              label: netLegend,
              value: formatChartKwdTooltip(row.netKwd, locale),
              bold: true,
              tone: 'blue',
            },
          ]

    return (
      <GlassTooltipLines
        title={row.tooltipTitle}
        badgeText={formatPct(row.netMarginPct, { locale })}
        badgeTone="blue"
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
      data-chart-kind="sales-net-combo"
      data-y-axis-side={yAxisSide}
      data-x-axis-reversed={xAxisReversed}
      className={cx('relative select-none space-y-3', className)}
    >
      {headerNode}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
          <span className="inline-flex items-center gap-2 font-bold text-[#047857] dark:text-emerald-300">
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
            <span className="text-xs font-semibold text-[#047857] dark:text-emerald-300">
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
          <span className="whitespace-nowrap font-bold text-[#047857] dark:text-emerald-300">
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
            <ComposedChart
              data={plottedData}
              barCategoryGap="28%"
              margin={{ top: 10, right: 12, left: 12, bottom: 4 }}
            >
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
                maxBarSize={20}
                background={ghostBarBackground}
                isAnimationActive={false}
              />
              <Line
                yAxisId="net"
                type="monotone"
                dataKey="netKwd"
                name={netLegend}
                stroke={V35_CHART_COLORS.primary}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: V35_CHART_COLORS.primary,
                  stroke: '#FFFFFF',
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 4.5,
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
