import React, { type ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import {
  KpiProvenanceBadge,
  type KpiProvenanceBadgeProps,
} from '@/components/erp/KpiProvenanceBadge'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { cx } from './cx'

export type KpiValueFormat = 'kwd' | 'int' | 'pct' | 'raw'
export type KpiDeltaTone = 'positive' | 'negative' | 'neutral' | 'warning'

export type KpiProvenanceConfig = Omit<KpiProvenanceBadgeProps, 'isAr'> & {
  isAr?: boolean
}

export interface KpiCardProps {
  label: ReactNode
  value: number | string | null | undefined
  /** Numeric formatting mode when `value` is a number (defaults to `'kwd'`). */
  format?: KpiValueFormat
  /** Optional unit label rendered next to available figures (suppressed when unavailable). */
  unit?: string
  decimals?: number
  signed?: boolean
  /** Percentage delta (e.g. `3.3` -> `+3.3%`) or pre-formatted delta string. */
  delta?: number | string | null
  deltaLabel?: ReactNode
  deltaTone?: KpiDeltaTone
  /** Set `false` for costs/waste/voids where lower values are positive. */
  higherIsBetter?: boolean
  /** Accepts either structured `KpiProvenanceBadge` props or a custom badge node. */
  provenance?: KpiProvenanceConfig | ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  loading?: boolean
  locale?: FormatLocale
  href?: string
  onClick?: () => void
  className?: string
}

function isProvenanceConfig(
  value: KpiProvenanceConfig | ReactNode,
): value is KpiProvenanceConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    !React.isValidElement(value) &&
    'kind' in value &&
    'dateRange' in value
  )
}

function isUnavailableInput(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  const trimmed = value.trim()
  return trimmed === '' || trimmed === UNAVAILABLE_DASH
}

function resolveDeltaMeta(
  delta: number | string | null | undefined,
  explicitTone: KpiDeltaTone | undefined,
  higherIsBetter: boolean,
  locale: FormatLocale,
): {
  text: string
  tone: KpiDeltaTone
  direction: 'up' | 'down' | 'flat'
} | null {
  if (delta === null || delta === undefined) return null

  if (typeof delta === 'number') {
    if (!Number.isFinite(delta)) return null
    const text = formatPct(delta, { locale, signed: true })
    const isNearZero = Math.abs(delta) < 0.05
    const direction: 'up' | 'down' | 'flat' = isNearZero
      ? 'flat'
      : delta > 0
        ? 'up'
        : 'down'
    const inferredTone: KpiDeltaTone = isNearZero
      ? 'neutral'
      : delta > 0
        ? higherIsBetter
          ? 'positive'
          : 'negative'
        : higherIsBetter
          ? 'negative'
          : 'positive'

    return {
      text,
      tone: explicitTone ?? inferredTone,
      direction,
    }
  }

  const trimmed = delta.trim()
  if (!trimmed) return null
  const tone = explicitTone ?? 'neutral'
  const direction: 'up' | 'down' | 'flat' =
    trimmed.startsWith('+') || trimmed.startsWith('▲')
      ? 'up'
      : trimmed.startsWith('-') || trimmed.startsWith('▼')
        ? 'down'
        : 'flat'

  return { text: trimmed, tone, direction }
}

const DELTA_TONE_STYLE: Record<KpiDeltaTone, React.CSSProperties> = {
  positive: {
    color: 'var(--ds-positive)',
    backgroundColor: 'var(--ds-positive-bg)',
    borderColor: 'var(--ds-positive-border)',
  },
  negative: {
    color: 'var(--ds-negative)',
    backgroundColor: 'var(--ds-negative-bg)',
    borderColor: 'var(--ds-negative-border)',
  },
  warning: {
    color: 'var(--ds-warning)',
    backgroundColor: 'var(--ds-warning-bg)',
    borderColor: 'var(--ds-warning-border)',
  },
  neutral: {
    color: 'var(--ds-text-muted)',
    backgroundColor: 'var(--ds-unavailable-bg)',
    borderColor: 'var(--ds-unavailable-border)',
  },
}

/**
 * Executive KPI Card primitive:
 * - Private-bank card surface with 1px hairline border and subtle elevation
 * - Strictly renders `'—'` (`UNAVAILABLE_DASH`) with bilingual tooltip (`'غير متاح'` / `'Unavailable'`) on `null`/`undefined`/`NaN`
 * - Enforces `tabular-nums` inside a `dir="ltr"` numeric island for RTL sign & currency safety
 */
export function KpiCard({
  label,
  value,
  format = 'kwd',
  unit,
  decimals,
  signed = false,
  delta,
  deltaLabel,
  deltaTone,
  higherIsBetter = true,
  provenance,
  subtitle,
  icon,
  loading = false,
  locale = 'ar',
  href,
  onClick,
  className = '',
}: KpiCardProps) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTooltip = getUnavailableTooltip(locale)
  const unavailable = isUnavailableInput(value)

  let displayValue: string = UNAVAILABLE_DASH
  let resolvedUnit: string | undefined

  if (!unavailable) {
    if (typeof value === 'number') {
      if (format === 'int') {
        displayValue = formatInt(value, { locale, signed })
        resolvedUnit = unit
      } else if (format === 'pct') {
        displayValue = formatPct(value, { locale, decimals, signed })
        resolvedUnit = unit
      } else if (format === 'raw') {
        displayValue = String(value)
        resolvedUnit = unit
      } else {
        // Canonical KWD: use formatKwd(value, { locale, showUnit }) so unit never drifts from locale.
        if (unit !== undefined) {
          displayValue = formatKwd(value, {
            locale,
            showUnit: false,
            decimals,
            signed,
          })
          resolvedUnit = unit || undefined
        } else {
          displayValue = formatKwd(value, {
            locale,
            showUnit: true,
            decimals,
            signed,
          })
        }
      }
    } else if (typeof value === 'string') {
      displayValue = value
      resolvedUnit = unit
    }
  }

  const deltaMeta = resolveDeltaMeta(delta, deltaTone, higherIsBetter, locale)

  const body = loading ? (
    <div
      role="status"
      aria-busy="true"
      data-loading="true"
      className="flex flex-col justify-between gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="ds-skeleton h-4 w-28 rounded-md" />
        <div className="ds-skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="ds-skeleton h-8 w-40 rounded-md" />
      <div className="ds-skeleton h-3.5 w-32 rounded-md" />
      <span className="sr-only">{isAr ? 'جارٍ تحميل المؤشر…' : 'Loading metric…'}</span>
    </div>
  ) : (
    <>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--ds-accent-soft)',
                borderColor: 'var(--ds-border-accent)',
                color: 'var(--ds-accent)',
              }}
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <span className="ds-label min-w-0 break-words">{label}</span>
        </div>

        {deltaMeta ? (
          <span
            dir="ltr"
            data-kpi-delta-tone={deltaMeta.tone}
            style={DELTA_TONE_STYLE[deltaMeta.tone]}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums"
          >
            {deltaMeta.direction === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : deltaMeta.direction === 'down' ? (
              <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span className="tabular-nums">{deltaMeta.text}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span
          dir="ltr"
          data-kpi-val=""
          data-unavailable={unavailable ? 'true' : undefined}
          title={unavailable ? unavailableTooltip : undefined}
          aria-label={unavailable ? unavailableTooltip : undefined}
          style={unavailable ? { color: 'var(--ds-unavailable)' } : undefined}
          className="ds-kpi-value ds-num tabular-nums"
        >
          {displayValue}
        </span>

        {!unavailable && resolvedUnit ? (
          <span className="ds-caption font-semibold">{resolvedUnit}</span>
        ) : null}
      </div>

      {subtitle || deltaLabel ? (
        <div className="ds-caption mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {subtitle ? <span>{subtitle}</span> : null}
          {deltaLabel ? <span>{deltaLabel}</span> : null}
        </div>
      ) : null}

      {provenance ? (
        <div data-kpi-provenance-slot="true" className="mt-2">
          {isProvenanceConfig(provenance) ? (
            <KpiProvenanceBadge
              compact
              isAr={provenance.isAr ?? isAr}
              {...provenance}
            />
          ) : (
            provenance
          )}
        </div>
      ) : null}
    </>
  )

  const baseClass = cx(
    'ds-kpi-card ds-surface ds-motion flex h-full w-full flex-col justify-between rounded-2xl p-4 text-start sm:p-5',
    (href || onClick) && 'ds-focus-ring cursor-pointer',
    className,
  )

  if (href) {
    return (
      <a href={href} dir={dir} className={baseClass}>
        {body}
      </a>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} dir={dir} className={baseClass}>
        {body}
      </button>
    )
  }

  return (
    <article dir={dir} className={baseClass}>
      {body}
    </article>
  )
}
