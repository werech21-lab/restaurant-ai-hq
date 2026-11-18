import React, { type ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { UNAVAILABLE_DASH, getUnavailableTooltip } from '@/lib/format'

export type V35KpiRingTone =
  | 'blue'
  | 'sky'
  | 'indigo'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'neutral'
  | 'hero'

export type V35KpiRingSize = 'sm' | 'md' | 'lg'

export interface V35KpiRingProps {
  value?: number | null
  display: ReactNode
  percent?: number | null
  max?: number | null
  ringCenter?: ReactNode
  tone?: V35KpiRingTone
  size?: V35KpiRingSize
  dataKpi?: string
  isUnavailable?: boolean
  unavailableTooltip?: string
  valueTooltip?: string
  valueClassName?: string
  className?: string
  children?: ReactNode
}

interface RingDimensions {
  boxClass: string
  svgPx: number
  strokeWidth: number
  radius: number
  valueTextClass: string
  centerTextClass: string
  gapClass: string
}

const SIZE_SPECS: Record<V35KpiRingSize, RingDimensions> = {
  sm: {
    boxClass: 'h-11 w-11',
    svgPx: 44,
    strokeWidth: 3.5,
    radius: 17,
    valueTextClass: 'text-lg sm:text-xl',
    centerTextClass: 'text-xs',
    gapClass: 'gap-3.5',
  },
  md: {
    boxClass: 'h-14 w-14',
    svgPx: 56,
    strokeWidth: 4.5,
    radius: 23,
    valueTextClass: 'text-2xl sm:text-[28px]',
    centerTextClass: 'text-xs',
    gapClass: 'gap-3.5',
  },
  lg: {
    boxClass: 'h-[68px] w-[68px]',
    svgPx: 68,
    strokeWidth: 5,
    radius: 29,
    valueTextClass: 'text-[clamp(1.25rem,1.9vw,1.9rem)] whitespace-nowrap',
    centerTextClass: 'text-xs sm:text-sm',
    gapClass: 'gap-4',
  },
}

interface ToneSpec {
  trackClass: string
  arcClass: string
  orbitalHaloClass: string
  softWashClass: string
  centerClass: string
  valueClass: string
  unavailableValueClass: string
}

const TONE_SPECS: Record<V35KpiRingTone, ToneSpec> = {
  blue: {
    trackClass: 'stroke-[#D1FAE5] dark:stroke-emerald-400/20',
    arcClass: 'stroke-[#059669] dark:stroke-emerald-400',
    orbitalHaloClass: 'stroke-emerald-400/55 dark:stroke-emerald-300/45',
    softWashClass: 'fill-[#ECFDF5] dark:fill-emerald-400/10',
    centerClass: 'text-[#047857] dark:text-emerald-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  sky: {
    trackClass: 'stroke-teal-100 dark:stroke-teal-400/20',
    arcClass: 'stroke-[#0F766E] dark:stroke-teal-300',
    orbitalHaloClass: 'stroke-teal-400/55 dark:stroke-teal-300/45',
    softWashClass: 'fill-teal-50/75 dark:fill-teal-400/10',
    centerClass: 'text-[#0F766E] dark:text-teal-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  indigo: {
    trackClass: 'stroke-blue-100 dark:stroke-blue-400/20',
    arcClass: 'stroke-[#1E40AF] dark:stroke-sky-400',
    orbitalHaloClass: 'stroke-blue-400/55 dark:stroke-sky-300/45',
    softWashClass: 'fill-blue-50/75 dark:fill-sky-400/10',
    centerClass: 'text-[#1E40AF] dark:text-sky-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  positive: {
    trackClass: 'stroke-[#D1FAE5] dark:stroke-emerald-400/20',
    arcClass: 'stroke-[#059669] dark:stroke-emerald-400',
    orbitalHaloClass: 'stroke-emerald-400/55 dark:stroke-emerald-300/40',
    softWashClass: 'fill-[#ECFDF5] dark:fill-emerald-400/10',
    centerClass: 'text-[#047857] dark:text-emerald-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  negative: {
    trackClass: 'stroke-rose-100 dark:stroke-rose-400/20',
    arcClass: 'stroke-rose-500 dark:stroke-rose-400',
    orbitalHaloClass: 'stroke-rose-400/55 dark:stroke-rose-300/40',
    softWashClass: 'fill-rose-50/75 dark:fill-rose-400/10',
    centerClass: 'text-rose-700 dark:text-rose-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  warning: {
    trackClass: 'stroke-amber-100 dark:stroke-amber-400/20',
    arcClass: 'stroke-amber-500 dark:stroke-amber-400',
    orbitalHaloClass: 'stroke-amber-400/55 dark:stroke-amber-300/40',
    softWashClass: 'fill-amber-50/75 dark:fill-amber-400/10',
    centerClass: 'text-amber-700 dark:text-amber-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  neutral: {
    trackClass: 'stroke-slate-200/85 dark:stroke-slate-400/20',
    arcClass: 'stroke-slate-500 dark:stroke-slate-300',
    orbitalHaloClass: 'stroke-slate-400/55 dark:stroke-slate-300/40',
    softWashClass: 'fill-slate-100/80 dark:fill-slate-400/10',
    centerClass: 'text-[#4F6673] dark:text-slate-300',
    valueClass: 'text-[#1E3A5F] dark:text-slate-50',
    unavailableValueClass: 'text-[#4F6673] dark:text-slate-400',
  },
  hero: {
    trackClass: 'stroke-emerald-200/25',
    arcClass: 'stroke-[#D1FAE5]',
    orbitalHaloClass: 'stroke-emerald-200/60',
    softWashClass: 'fill-emerald-200/10',
    centerClass: 'text-[#FFFFFF]',
    valueClass: 'text-[#FFFFFF]',
    unavailableValueClass: 'text-emerald-50/90',
  },
}

type RingVisualState =
  | { mode: 'unavailable' }
  | { mode: 'arc'; clampedPercent: number }
  | { mode: 'orbital' }

function clampPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  if (raw <= 0) return 0
  if (raw >= 100) return 100
  return raw
}

function resolveRingVisual(
  unavailable: boolean,
  value: number | null | undefined,
  percent: number | null | undefined,
  max: number | null | undefined,
): RingVisualState {
  if (unavailable || value === null) {
    return { mode: 'unavailable' }
  }
  if (typeof percent === 'number' && Number.isFinite(percent)) {
    return { mode: 'arc', clampedPercent: clampPercent(percent) }
  }
  if (
    typeof max === 'number' &&
    Number.isFinite(max) &&
    max > 0 &&
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return { mode: 'arc', clampedPercent: clampPercent((value / max) * 100) }
  }
  return { mode: 'orbital' }
}

/**
 * Purely presentational SVG donut ring + preformatted KPI value block.
 * Never calculates business KPIs or invents missing percentages.
 */
export function V35KpiRing({
  value,
  display,
  percent,
  max,
  ringCenter,
  tone = 'blue',
  size = 'md',
  dataKpi,
  isUnavailable,
  unavailableTooltip,
  valueTooltip,
  valueClassName,
  className,
  children,
}: V35KpiRingProps) {
  const resolvedUnavailable =
    isUnavailable ??
    (value !== undefined
      ? value === null || !Number.isFinite(value)
      : display === UNAVAILABLE_DASH)

  const resolvedUnavailableTooltip =
    unavailableTooltip && unavailableTooltip.trim().length > 0
      ? unavailableTooltip
      : getUnavailableTooltip('ar')

  const ringVisual = resolveRingVisual(resolvedUnavailable, value, percent, max)
  const sizeSpec = SIZE_SPECS[size]
  const toneSpec = TONE_SPECS[tone]

  const center = sizeSpec.svgPx / 2
  const circumference = Number((2 * Math.PI * sizeSpec.radius).toFixed(2))
  const dashOffset =
    ringVisual.mode === 'arc'
      ? Number((circumference * (1 - ringVisual.clampedPercent / 100)).toFixed(2))
      : circumference

  const showRingCenter =
    ringCenter !== null &&
    ringCenter !== undefined &&
    (!resolvedUnavailable || React.isValidElement(ringCenter))

  const valueWrapClass = size === 'lg' ? 'whitespace-nowrap' : 'break-words'

  return (
    <div
      className={cx(
        'flex min-w-0 items-center',
        !resolvedUnavailable && sizeSpec.gapClass,
        className,
      )}
    >
      {!resolvedUnavailable && ringVisual.mode !== 'unavailable' ? (
        <div
          className={cx(
            'relative inline-flex shrink-0 items-center justify-center',
            sizeSpec.boxClass,
          )}
        >
          <svg
            viewBox={`0 0 ${sizeSpec.svgPx} ${sizeSpec.svgPx}`}
            width={sizeSpec.svgPx}
            height={sizeSpec.svgPx}
            aria-hidden="true"
            focusable="false"
            data-ring-mode={ringVisual.mode}
            className="h-full w-full shrink-0 overflow-visible"
          >
            {ringVisual.mode === 'arc' ? (
              <>
                <circle
                  cx={center}
                  cy={center}
                  r={Math.max(1, sizeSpec.radius - sizeSpec.strokeWidth * 0.65)}
                  className={toneSpec.softWashClass}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={sizeSpec.radius}
                  fill="none"
                  strokeWidth={sizeSpec.strokeWidth}
                  className={toneSpec.trackClass}
                />
                {ringVisual.clampedPercent > 0 ? (
                  <circle
                    cx={center}
                    cy={center}
                    r={sizeSpec.radius}
                    fill="none"
                    strokeWidth={sizeSpec.strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${center} ${center})`}
                    className={cx(
                      toneSpec.arcClass,
                      'transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none',
                    )}
                  />
                ) : null}
              </>
            ) : (
              <>
                <circle
                  cx={center}
                  cy={center}
                  r={Math.max(1, sizeSpec.radius - sizeSpec.strokeWidth * 0.65)}
                  className={toneSpec.softWashClass}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={sizeSpec.radius}
                  fill="none"
                  strokeWidth={sizeSpec.strokeWidth}
                  className={toneSpec.trackClass}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={sizeSpec.radius}
                  fill="none"
                  strokeWidth={1.75}
                  className={toneSpec.orbitalHaloClass}
                />
              </>
            )}
          </svg>

          {showRingCenter ? (
            <div
              dir="ltr"
              aria-hidden={React.isValidElement(ringCenter) ? true : undefined}
              className={cx(
                'pointer-events-none absolute inset-0 flex items-center justify-center p-1.5 font-semibold',
                sizeSpec.centerTextClass,
                toneSpec.centerClass,
              )}
            >
              {React.isValidElement(ringCenter) ? (
                ringCenter
              ) : (
                <span className="tabular-nums leading-none">{ringCenter}</span>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {resolvedUnavailable ? (
          <span
            dir="ltr"
            data-kpi={dataKpi}
            data-unavailable="true"
            title={resolvedUnavailableTooltip}
            aria-label={resolvedUnavailableTooltip}
            className={cx(
              'inline-block max-w-full font-semibold leading-tight tracking-tight tabular-nums',
              valueWrapClass,
              sizeSpec.valueTextClass,
              toneSpec.unavailableValueClass,
              valueClassName,
            )}
          >
            {UNAVAILABLE_DASH}
          </span>
        ) : (
          <span
            dir="ltr"
            data-kpi={dataKpi}
            title={valueTooltip || undefined}
            className={cx(
              'inline-block max-w-full font-semibold leading-tight tracking-tight tabular-nums',
              valueWrapClass,
              sizeSpec.valueTextClass,
              toneSpec.valueClass,
              valueClassName,
            )}
          >
            {display}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
