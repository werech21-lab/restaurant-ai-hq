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
    titleAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    titleEn: 'No Odoo data for this period',
    descAr: 'لا تُعرض أرقام لهذه الفترة لأن المصدر الحي لم يُرجع بيانات.',
    descEn: 'No figures are shown for this period because the live source returned no data.',
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
          'flex flex-col justify-center gap-2 rounded-2xl border border-slate-300/70 bg-white/80 px-4 py-3 text-[13px] text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] backdrop-blur-md ring-1 ring-slate-900/[0.04] dark:border-slate-500/25 dark:bg-[rgba(15,26,48,0.78)] dark:text-slate-200 dark:ring-white/5',
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
                className="ds-num rounded-md bg-slate-100/90 px-1.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
              >
                {unavailableSections.length}
              </span>
            ) : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
        {resolvedDescription ? (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {resolvedDescription}
          </p>
        ) : null}
      </div>
    )
  }

  const isError = state === 'error'
  const icon = isError ? (
    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden />
  ) : state === 'unavailable' ? (
    <Slash className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
  ) : state === 'unlinked' ? (
    <Link2Off className="h-5 w-5 text-blue-600/80 dark:text-sky-400/80" aria-hidden />
  ) : state === 'forbidden' ? (
    <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
  ) : (
    <Inbox className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
  )

  return (
    <div
      role={isError ? 'alert' : 'status'}
      data-state-block={state}
      data-unavailable={state === 'unavailable' ? 'true' : undefined}
      dir={dir}
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border text-center backdrop-blur-md',
        isError
          ? 'border-rose-300/55 bg-white/85 dark:border-rose-400/25 dark:bg-[rgba(15,26,48,0.82)]'
          : 'border-slate-300/65 bg-slate-50/80 dark:border-slate-500/25 dark:bg-[rgba(12,21,40,0.72)]',
        padClass,
        minHeightClass,
        className,
      )}
    >
      <div
        className={cx(
          'mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border',
          isError
            ? 'border-rose-200/80 bg-rose-50/85 dark:border-rose-400/25 dark:bg-rose-500/15'
            : 'border-slate-200/85 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]',
        )}
      >
        {icon}
      </div>

      {state === 'unavailable' ? (
        <span
          dir="ltr"
          title={unavailableTooltip}
          aria-label={unavailableTooltip}
          data-unavailable="true"
          className="ds-kpi-value ds-num mb-1 tabular-nums text-slate-500 dark:text-slate-400"
        >
          {UNAVAILABLE_DASH}
        </span>
      ) : null}

      <p
        className={cx(
          'text-sm font-semibold',
          isError ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100',
        )}
      >
        {resolvedTitle}
      </p>

      {resolvedDescription ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {resolvedDescription}
        </p>
      ) : null}

      {onRetry || action ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="ds-motion ds-focus-ring cursor-pointer rounded-xl border border-slate-300/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.12]"
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
