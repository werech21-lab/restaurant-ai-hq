import React, { type ReactNode } from 'react'
import {
  formatInt,
  formatKwd,
  formatPct,
  type FormatKwdOptions,
  type FormatLocale,
} from '@/lib/format'
import { PartialWarningBanner } from './partial-warning-banner'
import { cx } from './primitives'
import { StateBlock, type StateBlockState } from './state-block'

/**
 * Restrained luxury executive chart colors (zero rainbow, zero neon).
 * One primary emerald accent paired with calm slate/teal/amber/rose semantics.
 */
export const DS_CHART_COLORS = {
  primary: '#059669',
  primaryDark: '#10B981',
  secondary: '#475569',
  secondaryMuted: '#94A3B8',
  info: '#0284C7',
  warning: '#D97706',
  negative: '#E11D48',
} as const

export const DS_CHART_PALETTE = [
  DS_CHART_COLORS.primary,
  DS_CHART_COLORS.secondary,
  DS_CHART_COLORS.info,
  DS_CHART_COLORS.warning,
  DS_CHART_COLORS.negative,
] as const

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
      className={cx(
        'min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-lg',
        className,
      )}
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
  className?: string
  children?: ReactNode
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return ''
}

/**
 * Executive Chart Card container:
 * - Period + unit subtitle, labelled X/Y axis metadata, and RTL-aware header & legend
 * - Built-in loading/empty/error/partial/unavailable states (zero layout shift)
 * - Accessible `aria-label` figure summary and subtle hairline gridline canvas
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
  className = '',
  children,
}: ChartCardProps) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const metaSubtitle = [period, unit].filter(Boolean).join(' · ')
  const composedSubtitle = subtitle ?? (metaSubtitle || undefined)
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
        'ds-chart-card ds-surface w-full min-w-0 rounded-2xl p-4 sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="ds-section-title break-words">{title}</h3>
          {composedSubtitle ? (
            <p className="ds-caption break-words">{composedSubtitle}</p>
          ) : null}
          {subtitle && metaSubtitle ? (
            <p className="ds-caption break-words">{metaSubtitle}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

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
                'relative w-full min-w-0 overflow-hidden rounded-xl border p-3 sm:p-4',
                minHeightClass,
              )}
              style={{
                borderColor: 'var(--ds-border-hairline)',
                backgroundColor: showGridBackdrop
                  ? 'var(--ds-bg-subtle)'
                  : 'transparent',
                backgroundImage: showGridBackdrop
                  ? 'linear-gradient(to bottom, var(--ds-chart-grid) 1px, transparent 1px)'
                  : undefined,
                backgroundSize: showGridBackdrop ? '100% 48px' : undefined,
              }}
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
