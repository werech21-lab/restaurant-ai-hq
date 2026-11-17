import React, { type ReactNode } from 'react'
import { AlertCircle, Inbox, Info, Link2Off, Lock, Slash } from 'lucide-react'
import { UNAVAILABLE_DASH, getUnavailableTooltip, type FormatLocale } from '@/lib/format'
import { cx } from './cx'

export type StateBlockState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'partial'
  | 'unavailable'
  | 'unlinked'
  | 'forbidden'

export interface StateBlockProps {
  state: StateBlockState
  locale?: FormatLocale
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  warningAr?: string | null
  warningEn?: string | null
  unavailableSections?: string[]
  /**
   * Accepted only so callers can pass caught errors cleanly without ever
   * leaking raw error messages, stack traces, URLs, or credentials into the UI.
   */
  error?: unknown
  skeletonRows?: number
  minHeightClass?: string
  compact?: boolean
  className?: string
}

const DEFAULT_COPY: Record<
  Exclude<StateBlockState, 'loading'>,
  { titleAr: string; titleEn: string; descAr: string; descEn: string }
> = {
  empty: {
    titleAr: 'لا توجد بيانات متاحة',
    titleEn: 'No data available',
    descAr: 'جرّب تعديل الفلاتر أو اختيار فترة زمنية أخرى.',
    descEn: 'Try adjusting filters or selecting a different time period.',
  },
  error: {
    titleAr: 'تعذّر تحميل البيانات حالياً',
    titleEn: 'Unable to load data right now',
    descAr: 'حدث خلل مؤقت أثناء التحديث. يرجى المحاولة مجدداً.',
    descEn: 'A temporary issue occurred while refreshing. Please try again.',
  },
  partial: {
    titleAr: 'بعض الأرقام غير متاحة الآن',
    titleEn: 'Some figures are temporarily unavailable',
    descAr: 'تُعرض المؤشرات المتوفرة حالياً مع تمييز الأقسام الناقصة.',
    descEn: 'Available metrics are shown below; missing sections remain marked unavailable.',
  },
  unavailable: {
    titleAr: 'غير متاح',
    titleEn: 'Unavailable',
    descAr: 'تعذّر التحقق من هذه القراءة من المصدر المباشر في الوقت الحالي.',
    descEn: 'This metric could not be verified from the live source right now.',
  },
  unlinked: {
    titleAr: 'المصدر غير مربوط حالياً',
    titleEn: 'Source not connected',
    descAr: 'اربط مصدر البيانات الحي لعرض الأرقام التشغيلية الفعلية.',
    descEn: 'Connect the live data source to display verified operational metrics.',
  },
  forbidden: {
    titleAr: 'صلاحية العرض غير متوفرة',
    titleEn: 'Access restricted',
    descAr: 'لا تتوفر لدورك صلاحية الاطلاع على هذا القسم.',
    descEn: 'Your current role does not include access to this section.',
  },
}

/**
 * Standardized async & fallback state surface (`loading`, `empty`, `error`, `partial`, `unavailable`).
 * Guarantees zero layout shift skeletons, bilingual copy, and zero raw error/stack/credential leaks.
 */
export function StateBlock({
  state,
  locale = 'ar',
  title,
  description,
  action,
  onRetry,
  retryLabel,
  warningAr,
  warningEn,
  unavailableSections,
  error: _ignoredError,
  skeletonRows = 3,
  minHeightClass = 'min-h-[148px]',
  compact = false,
  className = '',
}: StateBlockProps) {
  void _ignoredError
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const padClass = compact ? 'px-4 py-4' : 'px-5 py-7'

  if (state === 'loading') {
    const loadingLabel = title ?? (isAr ? 'جارٍ تحميل البيانات…' : 'Loading data…')
    const rows = Math.max(2, Math.min(6, skeletonRows))
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={typeof loadingLabel === 'string' ? loadingLabel : undefined}
        data-state-block="loading"
        dir={dir}
        className={cx(
          'ds-surface-subtle flex flex-col justify-center gap-3 rounded-2xl',
          padClass,
          minHeightClass,
          className,
        )}
      >
        <div className="ds-skeleton h-4 w-2/5 rounded-md" />
        <div className="space-y-2.5">
          {Array.from({ length: rows }, (_, i) => (
            <div
              key={i}
              className={cx(
                'ds-skeleton h-3.5 rounded-md',
                i === rows - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-5/6',
              )}
            />
          ))}
        </div>
        <span className="sr-only">{loadingLabel}</span>
      </div>
    )
  }

  const defaults = DEFAULT_COPY[state]
  const resolvedTitle =
    title ??
    (state === 'partial'
      ? isAr
        ? warningAr || defaults.titleAr
        : warningEn || defaults.titleEn
      : isAr
        ? defaults.titleAr
        : defaults.titleEn)

  const resolvedDescription =
    description ?? (isAr ? defaults.descAr : defaults.descEn)

  const unavailableTooltip = getUnavailableTooltip(locale)

  if (state === 'partial') {
    return (
      <div
        role="alert"
        data-state-block="partial"
        data-odoo-partial-warning="true"
        dir={dir}
        className={cx(
          'flex flex-col justify-center gap-2 rounded-2xl border px-4 py-3.5 text-[13px]',
          className,
        )}
        style={{
          backgroundColor: 'var(--ds-unavailable-bg)',
          borderColor: 'var(--ds-unavailable-border)',
          color: 'var(--ds-unavailable)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4 shrink-0" aria-hidden />
            <span>{resolvedTitle}</span>
            {unavailableSections && unavailableSections.length > 0 ? (
              <span
                dir="ltr"
                className="ds-num rounded-md px-1.5 py-0.5 text-xs font-bold"
                style={{ backgroundColor: 'var(--ds-bg-surface)' }}
              >
                {unavailableSections.length}
              </span>
            ) : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
        {resolvedDescription ? (
          <p className="text-xs leading-relaxed opacity-90">{resolvedDescription}</p>
        ) : null}
      </div>
    )
  }

  const toneStyle: React.CSSProperties =
    state === 'error'
      ? {
          backgroundColor: 'var(--ds-negative-bg)',
          borderColor: 'var(--ds-negative-border)',
        }
      : {
          backgroundColor: 'var(--ds-bg-subtle)',
          borderColor: 'var(--ds-border-hairline)',
        }

  const icon =
    state === 'error' ? (
      <AlertCircle className="h-5 w-5" style={{ color: 'var(--ds-negative)' }} aria-hidden />
    ) : state === 'unavailable' ? (
      <Slash className="h-5 w-5" style={{ color: 'var(--ds-unavailable)' }} aria-hidden />
    ) : state === 'unlinked' ? (
      <Link2Off className="h-5 w-5" style={{ color: 'var(--ds-text-muted)' }} aria-hidden />
    ) : state === 'forbidden' ? (
      <Lock className="h-5 w-5" style={{ color: 'var(--ds-warning)' }} aria-hidden />
    ) : (
      <Inbox className="h-5 w-5" style={{ color: 'var(--ds-text-muted)' }} aria-hidden />
    )

  return (
    <div
      role={state === 'error' ? 'alert' : 'status'}
      data-state-block={state}
      data-unavailable={state === 'unavailable' ? 'true' : undefined}
      dir={dir}
      style={toneStyle}
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border text-center',
        padClass,
        minHeightClass,
        className,
      )}
    >
      <div
        className="mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border"
        style={{
          backgroundColor: 'var(--ds-bg-surface)',
          borderColor: 'var(--ds-border-hairline)',
        }}
      >
        {icon}
      </div>

      {state === 'unavailable' ? (
        <span
          dir="ltr"
          title={unavailableTooltip}
          aria-label={unavailableTooltip}
          data-unavailable="true"
          className="ds-kpi-value ds-num mb-1 tabular-nums"
          style={{ color: 'var(--ds-unavailable)' }}
        >
          {UNAVAILABLE_DASH}
        </span>
      ) : null}

      <p
        className="text-sm font-semibold"
        style={{
          color: state === 'error' ? 'var(--ds-negative)' : 'var(--ds-text-primary)',
        }}
      >
        {resolvedTitle}
      </p>

      {resolvedDescription ? (
        <p
          className="mt-1 max-w-md text-xs leading-relaxed"
          style={{ color: 'var(--ds-text-muted)' }}
        >
          {resolvedDescription}
        </p>
      ) : null}

      {onRetry || action ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="ds-motion ds-focus-ring cursor-pointer rounded-xl border px-3.5 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--ds-bg-surface)',
                borderColor: 'var(--ds-border-strong)',
                color: 'var(--ds-text-primary)',
              }}
            >
              {retryLabel ?? (isAr ? 'إعادة المحاولة' : 'Retry')}
            </button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  )
}
