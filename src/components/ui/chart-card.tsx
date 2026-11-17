import React, { type ReactNode } from 'react'
import {
  V35_CHART_CARD_CLASS,
  V35_CHART_COLORS,
  V35_DONUT_PALETTE,
  V35_GLASS_TOOLTIP_CLASS,
} from '@/components/charts/v35-chart-theme'
import {
  formatInt,
  formatKwd,
  formatPct,
  type FormatKwdOptions,
  type FormatLocale,
} from '@/lib/format'
import { cx } from './cx'
import { DetailsPopover } from './details-popover'
import { PartialWarningBanner } from './partial-warning-banner'
import { StateBlock, type StateBlockState } from './state-block'

/**
 * V35 Executive Chart Palette (soft cobalt primary paired with calm comparison slate).
 */
export const DS_CHART_COLORS = {
  primary: V35_CHART_COLORS.primary,
  primaryDark: V35_CHART_COLORS.primaryDark,
  secondary: V35_CHART_COLORS.secondary,
  secondaryMuted: V35_CHART_COLORS.secondaryMuted,
  info: V35_CHART_COLORS.info,
  indigo: V35_CHART_COLORS.indigo,
  warning: V35_CHART_COLORS.warning,
  negative: V35_CHART_COLORS.negative,
} as const

export const DS_CHART_PALETTE = V35_DONUT_PALETTE

/**
 * Canonical 3-decimal KWD tooltip formatter for all executive charts.
 * Always delegates to `@/lib/format` (`formatKwd`) with exact 3 decimal fils precision.
 */
export function formatChartKwdTooltip(
  value: number | null | undefined,
  locale: FormatLocale = 'en',
  opts?: Omit<FormatKwdOptions, 'locale'>,
): string {
  return formatKwd(value, {
    locale,
    decimals: 3,
    showUnit: true,
    ...opts,
  })
}

export interface ChartTooltipItem {
  label: string
  value: number | string | null | undefined
  format?: 'kwd' | 'int' | 'pct' | 'raw'
  color?: string
  signed?: boolean
}

export function ChartTooltipContent({
  title,
  items,
  locale = 'ar',
  className = '',
}: {
  title?: ReactNode
  items: ReadonlyArray<ChartTooltipItem>
  locale?: FormatLocale
  className?: string
}) {
  const isAr = locale !== 'en'

  return (
    <div
      role="tooltip"
      dir={isAr ? 'rtl' : 'ltr'}
      className={cx(V35_GLASS_TOOLTIP_CLASS, className)}
    >
      {title ? (
        <div className="mb-1.5 border-b border-slate-100 pb-1 font-bold text-slate-900">
          {title}
        </div>
      ) : null}
      <div className="space-y-1">
        {items.map((item, idx) => {
          let formatted: string
          if (typeof item.value === 'string') {
            formatted = item.value
          } else if (item.format === 'int') {
            formatted = formatInt(item.value, { locale, signed: item.signed })
          } else if (item.format === 'pct') {
            formatted = formatPct(item.value, { locale, signed: item.signed })
          } else if (item.format === 'raw') {
            formatted = item.value == null ? '—' : String(item.value)
          } else {
            formatted = formatChartKwdTooltip(item.value, locale, {
              signed: item.signed,
            })
          }

          return (
            <div
              key={`${item.label}-${idx}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                {item.color ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                ) : null}
                <span>{item.label}</span>
              </span>
              <span
                dir="ltr"
                className="ds-num font-bold tabular-nums text-slate-950"
              >
                {formatted}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface V35SparklineProps {
  values?: ReadonlyArray<number | null | undefined>
  color?: string
  width?: number
  height?: number
  ariaLabel?: string
  className?: string
}

/**
 * Pure SVG sparkline path for `>= 2` real finite numbers.
 * Emits zero `<circle>` nodes and returns `null` when fewer than 2 real points exist.
 */
export function V35Sparkline({
  values,
  color = V35_CHART_COLORS.primary,
  width = 80,
  height = 28,
  ariaLabel,
  className = '',
}: V35SparklineProps) {
  const points = (values ?? []).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  )
  if (points.length < 2) {
    return null
  }

  const w = Math.max(24, width)
  const h = Math.max(16, height)
  const padX = 2
  const padY = 3
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const minVal = Math.min(...points)
  const maxVal = Math.max(...points)
  const span = maxVal - minVal

  const coords = points.map((val, idx) => {
    const x = padX + (idx / (points.length - 1)) * innerW
    const y =
      span === 0
        ? h / 2
        : padY + innerH - ((val - minVal) / span) * innerH
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    }
  })

  let linePath = `M ${coords[0].x} ${coords[0].y}`
  if (coords.length === 2) {
    linePath += ` L ${coords[1].x} ${coords[1].y}`
  } else {
    for (let i = 1; i < coords.length - 1; i += 1) {
      const mx = ((coords[i].x + coords[i + 1].x) / 2).toFixed(2)
      const my = ((coords[i].y + coords[i + 1].y) / 2).toFixed(2)
      linePath += ` Q ${coords[i].x} ${coords[i].y} ${mx} ${my}`
    }
    const last = coords[coords.length - 1]
    linePath += ` L ${last.x} ${last.y}`
  }

  const first = coords[0]
  const last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x} ${(h - 1).toFixed(2)} L ${first.x} ${(h - 1).toFixed(2)} Z`

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
      data-sparkline="true"
      className={cx('shrink-0 overflow-visible', className)}
    >
      <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export interface V35ChartCardHeaderProps {
  title?: ReactNode
  subtitle?: ReactNode
  period?: string
  unit?: string
  infoContent?: ReactNode
  infoLabel?: string
  kpiValue?: ReactNode
  deltaPct?: number | null
  deltaLabel?: string
  deltaHigherIsBetter?: boolean
  sparklineValues?: ReadonlyArray<number>
  sparklineColor?: string
  actions?: ReactNode
  locale?: FormatLocale
  isAr?: boolean
  /** When true, wraps the header (and optional `children`) in `V35_CHART_CARD_CLASS`. */
  asCard?: boolean
  className?: string
  children?: ReactNode
}

function resolveDeltaBadge(
  deltaPct: number | null | undefined,
  higherIsBetter: boolean,
  locale: FormatLocale,
): { text: string; tone: 'emerald' | 'rose' | 'neutral'; cls: string } | null {
  if (typeof deltaPct !== 'number' || !Number.isFinite(deltaPct)) return null
  const text = formatPct(deltaPct, { locale, signed: true })
  const isZero = deltaPct === 0 || !/[1-9]/.test(text)
  if (isZero) {
    return {
      text,
      tone: 'neutral',
      cls: 'border-slate-200/90 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
    }
  }
  const favorable = higherIsBetter ? deltaPct > 0 : deltaPct < 0
  return favorable
    ? {
        text,
        tone: 'emerald',
        cls: 'border-emerald-200/90 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
      }
    : {
        text,
        tone: 'rose',
        cls: 'border-rose-200/90 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
      }
}

/**
 * Shared "Chart Library" card header:
 * - Small executive title + interactive `<DetailsPopover>` (`ⓘ`, zero `title=`) when `infoContent` supplied
 * - Period · unit metadata subtitle
 * - Big tabular KPI figure + emerald/rose/slate `%` change pill + optional inline `V35Sparkline`
 * - Optional `asCard` wrapper using `V35_CHART_CARD_CLASS`
 */
export function V35ChartCardHeader({
  title,
  subtitle,
  period,
  unit,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter = true,
  sparklineValues,
  sparklineColor,
  actions,
  locale,
  isAr,
  asCard = false,
  className = '',
  children,
}: V35ChartCardHeaderProps) {
  const resolvedLocale: FormatLocale = locale ?? (isAr === false ? 'en' : 'ar')
  const resolvedIsAr = isAr ?? resolvedLocale !== 'en'
  const dir = resolvedIsAr ? 'rtl' : 'ltr'

  const metaSubtitle = [period, unit].filter(Boolean).join(' · ')
  const composedSubtitle = subtitle ?? (metaSubtitle || undefined)
  const hasKpiValue = kpiValue !== undefined && kpiValue !== null && kpiValue !== ''
  const deltaBadge = resolveDeltaBadge(deltaPct, deltaHigherIsBetter, resolvedLocale)
  const finiteSparkCount = (sparklineValues ?? []).filter(
    (v) => typeof v === 'number' && Number.isFinite(v),
  ).length
  const hasSparkline = finiteSparkCount >= 2

  const hasHeaderContent = Boolean(
    title ||
      composedSubtitle ||
      infoContent ||
      hasKpiValue ||
      deltaBadge ||
      deltaLabel ||
      hasSparkline ||
      actions,
  )

  if (!hasHeaderContent && !asCard) {
    return null
  }

  const resolvedInfoLabel =
    infoLabel ??
    (typeof title === 'string' && title.trim().length > 0
      ? title
      : resolvedIsAr
        ? 'تفاصيل المخطط'
        : 'Chart details')

  const headerBody = hasHeaderContent ? (
    <div
      dir={dir}
      data-chart-header="true"
      className={cx(
        'flex flex-wrap items-start justify-between gap-3',
        !asCard && className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {title || infoContent ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {title ? (
              <h3
                className={cx(
                  'break-words',
                  hasKpiValue
                    ? 'text-sm font-semibold text-slate-600 dark:text-slate-300'
                    : 'ds-section-title text-sm sm:text-base font-bold text-slate-900 dark:text-white',
                )}
              >
                {title}
              </h3>
            ) : null}
            {infoContent ? (
              <DetailsPopover
                isAr={resolvedIsAr}
                accessibleSummary={resolvedInfoLabel}
                heading={infoLabel}
                triggerLabel={
                  <span className="sr-only">{resolvedInfoLabel}</span>
                }
                triggerClassName="!h-6 !w-6 !justify-center !gap-0 !p-0 border-slate-200/90 bg-slate-50/90 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-white"
              >
                {infoContent}
              </DetailsPopover>
            ) : null}
          </div>
        ) : null}

        {composedSubtitle ? (
          <p className="ds-caption break-words">{composedSubtitle}</p>
        ) : null}
        {subtitle && metaSubtitle ? (
          <p className="ds-caption break-words">{metaSubtitle}</p>
        ) : null}

        {hasKpiValue || deltaBadge || deltaLabel ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1">
            {hasKpiValue ? (
              <span
                dir="ltr"
                className="text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {kpiValue}
              </span>
            ) : null}
            {deltaBadge ? (
              <span
                dir="ltr"
                data-delta-tone={deltaBadge.tone}
                className={cx(
                  'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
                  deltaBadge.cls,
                )}
              >
                {deltaBadge.text}
              </span>
            ) : null}
            {deltaLabel ? (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {deltaLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasSparkline || actions ? (
        <div className="flex shrink-0 items-center gap-3">
          {hasSparkline ? (
            <V35Sparkline values={sparklineValues} color={sparklineColor} />
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null

  if (!asCard) {
    return headerBody
  }

  return (
    <div dir={dir} className={cx(V35_CHART_CARD_CLASS, 'w-full min-w-0 space-y-3', className)}>
      {headerBody}
      {children}
    </div>
  )
}

export interface ChartLegendItem {
  key: string
  label: string
  color: string
  muted?: boolean
}

export interface ChartCardProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Time period label included in subtitle & accessible summary (e.g. `'2026-11-01 → 2026-11-16'`). */
  period?: string
  /** Measurement unit label included in subtitle & accessible summary (e.g. `'د.ك'`, `'KWD'`, `'%'`). */
  unit?: string
  /** Labelled X-axis metadata with unit/scale. */
  xAxisLabel?: string
  /** Labelled Y-axis metadata with unit/scale. */
  yAxisLabel?: string
  legend?: ReactNode
  legendItems?: ReadonlyArray<ChartLegendItem>
  actions?: ReactNode
  footer?: ReactNode
  ariaLabel?: string
  state?: 'ready' | StateBlockState
  partial?: boolean
  warningAr?: string | null
  warningEn?: string | null
  unavailableSections?: string[]
  stateTitle?: ReactNode
  stateDescription?: ReactNode
  stateAction?: ReactNode
  onRetry?: () => void
  /** Accepted only to swallow safely without leaking raw error text. */
  error?: unknown
  locale?: FormatLocale
  minHeightClass?: string
  showGridBackdrop?: boolean
  /** Optional Chart Library info popover content rendered next to the card title via `<DetailsPopover>`. */
  infoContent?: ReactNode
  /** Optional accessible label & heading for the `<DetailsPopover>` info button. */
  infoLabel?: string
  /** Optional hero KPI figure displayed above the chart. */
  kpiValue?: ReactNode
  /** Optional signed percentage delta pill displayed next to `kpiValue`. */
  deltaPct?: number | null
  /** Optional context caption displayed beside `deltaPct`. */
  deltaLabel?: string
  /** Controls whether positive `deltaPct` renders emerald (`true`, default) or rose (`false`). */
  deltaHigherIsBetter?: boolean
  /** Optional numeric series rendered as a compact inline `V35Sparkline` when >= 2 finite points exist. */
  sparklineValues?: ReadonlyArray<number>
  className?: string
  children?: ReactNode
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return ''
}

/**
 * Executive Chart Card container:
 * - Clean Chart Library white card in Light mode & hairline slate in Dark mode
 * - Optional `<DetailsPopover>` (`ⓘ`), tabular KPI headline, delta pill, and inline sparkline
 * - Built-in loading/empty/error/partial/unavailable states (zero layout shift)
 * - Accessible `aria-label` figure summary and open hairline plot surface
 */
export function ChartCard({
  title,
  subtitle,
  period,
  unit,
  xAxisLabel,
  yAxisLabel,
  legend,
  legendItems,
  actions,
  footer,
  ariaLabel,
  state = 'ready',
  partial = false,
  warningAr,
  warningEn,
  unavailableSections,
  stateTitle,
  stateDescription,
  stateAction,
  onRetry,
  error,
  locale = 'ar',
  minHeightClass = 'min-h-[240px]',
  showGridBackdrop = true,
  infoContent,
  infoLabel,
  kpiValue,
  deltaPct,
  deltaLabel,
  deltaHigherIsBetter = true,
  sparklineValues,
  className = '',
  children,
}: ChartCardProps) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const resolvedAriaLabel =
    ariaLabel ??
    ([extractText(title), period, unit].filter(Boolean).join(' — ') ||
      (isAr ? 'مخطط بياني' : 'Executive chart'))

  const isBlockingState =
    state === 'loading' ||
    state === 'empty' ||
    state === 'error' ||
    state === 'unavailable' ||
    state === 'unlinked' ||
    state === 'forbidden'

  const showPartialBanner = state === 'partial' || partial === true

  return (
    <section
      role="region"
      aria-label={resolvedAriaLabel}
      dir={dir}
      data-chart-card="true"
      className={cx(
        'ds-chart-card ds-surface w-full min-w-0',
        V35_CHART_CARD_CLASS,
        className,
      )}
    >
      <V35ChartCardHeader
        title={title}
        subtitle={subtitle}
        period={period}
        unit={unit}
        infoContent={infoContent}
        infoLabel={infoLabel}
        kpiValue={kpiValue}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
        deltaHigherIsBetter={deltaHigherIsBetter}
        sparklineValues={sparklineValues}
        actions={actions}
        locale={locale}
      />

      {legend || (legendItems && legendItems.length > 0) ? (
        <div
          dir={dir}
          data-chart-legend="true"
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
          style={{ color: 'var(--ds-text-secondary)' }}
        >
          {legend}
          {legendItems?.map((item) => (
            <span
              key={item.key}
              className={cx(
                'inline-flex items-center gap-1.5 font-semibold',
                item.muted && 'opacity-70',
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {showPartialBanner ? (
        <div className="mt-3">
          <PartialWarningBanner
            partial
            warningAr={warningAr}
            warningEn={warningEn}
            unavailableSections={unavailableSections}
            locale={locale}
          />
        </div>
      ) : null}

      <div className="mt-4 min-w-0">
        {isBlockingState ? (
          <StateBlock
            state={state}
            locale={locale}
            title={stateTitle}
            description={stateDescription}
            action={stateAction}
            onRetry={onRetry}
            error={error}
            minHeightClass={minHeightClass}
          />
        ) : (
          <div className="space-y-2">
            {yAxisLabel ? (
              <div
                data-chart-axis-y="true"
                className="ds-caption flex items-center justify-between gap-2 font-semibold"
              >
                <span>{yAxisLabel}</span>
              </div>
            ) : null}

            <div
              className={cx(
                'relative w-full min-w-0 overflow-hidden pt-1',
                minHeightClass,
              )}
              style={
                showGridBackdrop
                  ? {
                      backgroundImage:
                        'linear-gradient(to bottom, var(--ds-chart-grid) 1px, transparent 1px)',
                      backgroundSize: '100% 48px',
                    }
                  : undefined
              }
            >
              {children}
            </div>

            {xAxisLabel ? (
              <div
                data-chart-axis-x="true"
                className="ds-caption text-center font-semibold"
              >
                {xAxisLabel}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {footer ? (
        <div
          className="mt-4 border-t border-[var(--ds-border-hairline)] pt-3 text-xs"
          style={{ color: 'var(--ds-text-muted)' }}
        >
          {footer}
        </div>
      ) : null}
    </section>
  )
}
