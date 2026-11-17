'use client'

import { useEffect, type ReactNode } from 'react'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export const suitePanelClass = 'ds-surface w-full min-w-0 rounded-2xl p-4 sm:p-5'
export const suiteCardClass =
  'rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5'
export const suiteInputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60'
export const suiteLabelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
export const suitePrimaryBtn =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
export const suiteSecondaryBtn =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
export const suiteErrorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'
export const suiteNoticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'

export function SuiteUnavailableDash({ locale }: { locale: FormatLocale }) {
  const tooltip = getUnavailableTooltip(locale)
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export function SuiteMoney({
  minor,
  signed = false,
  className = '',
}: {
  minor: number | null | undefined
  signed?: boolean
  className?: string
}) {
  const { locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  if (typeof minor !== 'number' || !Number.isFinite(minor)) {
    return <SuiteUnavailableDash locale={fmtLocale} />
  }
  return (
    <span dir="ltr" className={`ds-num inline-block whitespace-nowrap tabular-nums ${className}`}>
      {formatKwd(minor / 1000, { locale: fmtLocale, signed })}
    </span>
  )
}

export function kuwaitTodayMidnightMs(): number {
  const todayIso = formatDate(new Date(), 'en')
  const parsed = Date.parse(`${todayIso}T00:00:00+03:00`)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function parseKuwaitDateMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(`${trimmed}T00:00:00+03:00`)
    return Number.isNaN(ms) ? null : ms
  }
  const ms = Date.parse(trimmed)
  return Number.isNaN(ms) ? null : ms
}

export function SuiteModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t, locale } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] p-5 text-[var(--ds-text-primary)] shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--ds-border-hairline)] pb-3">
          <h3 className="text-base font-bold text-[var(--ds-text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="ds-focus-ring inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-lg leading-none text-[var(--ds-text-muted)] hover:bg-[var(--ds-bg-hover)] hover:text-[var(--ds-text-primary)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
