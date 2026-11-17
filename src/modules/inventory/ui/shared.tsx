'use client'

import { useEffect, type ReactNode } from 'react'
import { Badge, Num } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  formatKwd,
  type FormatLocale,
} from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { money } from '@/lib/money'
import { isLowStock, stockValue, type Item } from '@/modules/inventory/client'

export { useDebounced, type ListPage, type Phase } from '@/components/erp/common'

export const invPanelClass = 'ds-surface rounded-2xl p-4 sm:p-5'
export const invSubtlePanelClass = 'ds-surface-subtle rounded-2xl p-4 sm:p-5'
export const invInputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#0D1512] dark:text-slate-100'
export const invLabelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300'
export const invPrimaryButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
export const invSecondaryButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300/90 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]'
export const invDangerButton =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-rose-500/40 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70'
export const invErrorClass =
  'rounded-xl border border-rose-500/35 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
export const invNoticeClass =
  'rounded-xl border border-emerald-500/35 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'

const modalWidths = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof modalWidths
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`ds-surface-elevated my-8 w-full ${modalWidths[size]} rounded-2xl p-5`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="ds-focus-ring inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg text-xl leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function dateTimeText(iso: string, locale: FormatLocale = 'ar'): string {
  return formatDateTime(iso, { locale })
}

export function formatMinorKwd(
  amountMinor: number | null | undefined,
  locale: FormatLocale = 'ar',
): string {
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor)) {
    return UNAVAILABLE_DASH
  }
  return formatKwd(amountMinor / 1000, { locale })
}

/** Quantity x unit cost as a 3-decimal KWD string, or a dash when out of safe range. */
export function itemValueText(
  item: Pick<Item, 'currentStock' | 'unitCostMinor'>,
  locale: FormatLocale = 'ar',
): string {
  try {
    return formatMinorKwd(
      stockValue(item.currentStock, money(item.unitCostMinor)).amountMinor,
      locale,
    )
  } catch {
    return UNAVAILABLE_DASH
  }
}

export function StockBadge({
  item,
}: {
  item: Pick<Item, 'currentStock' | 'reorderLevel' | 'isActive'>
}) {
  const { t } = useI18n()
  if (!item.isActive) return <Badge tone="neutral">{t('inv.badge.inactive')}</Badge>
  if (item.currentStock === 0) return <Badge tone="bad">{t('inv.badge.out')}</Badge>
  if (isLowStock(item.currentStock, item.reorderLevel)) {
    return <Badge tone="warn">{t('inv.badge.low')}</Badge>
  }
  return <Badge tone="good">{t('inv.badge.ok')}</Badge>
}

export function Quantity({ value, unit }: { value: number; unit?: Item['unit'] }) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Num>{formatInt(value, fmtLocale)}</Num>
      {unit ? (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {t(`inv.unit.${unit}`)}
        </span>
      ) : null}
    </span>
  )
}
