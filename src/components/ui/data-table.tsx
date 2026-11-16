import React, { type ReactNode } from 'react'
import { DataCard, PaginationBar } from '@/components/erp-ui'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKuwaitDate,
  formatKuwaitDateTime,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { PAGE_SIZE, pageCount } from '@/lib/pagination'
import { PartialWarningBanner } from './partial-warning-banner'
import { cx } from './primitives'
import { StateBlock } from './state-block'

export interface LegacyDataTableProps {
  toolbar?: ReactNode
  children: ReactNode
  path: string
  params: Record<string, string | number | undefined>
  page: number
  total: number
}

export interface DataTableColumn<TRow> {
  key: string
  header: ReactNode
  align?: 'start' | 'end' | 'center' | 'numeric'
  format?: 'kwd' | 'int' | 'pct' | 'date' | 'datetime'
  signed?: boolean
  decimals?: number
  widthClass?: string
  headerClassName?: string
  cellClassName?: string
  accessor?: (row: TRow) => number | string | Date | null | undefined
  render?: (row: TRow, index: number) => ReactNode
}

export interface StructuredDataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>
  rows: ReadonlyArray<TRow>
  rowKey: (row: TRow, index: number) => string
  locale?: FormatLocale
  toolbar?: ReactNode
  caption?: string
  footer?: ReactNode
  stickyHeader?: boolean
  maxHeightClass?: string
  loading?: boolean
  unavailable?: boolean
  error?: boolean
  partial?: boolean
  warningAr?: string | null
  warningEn?: string | null
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  onRetry?: () => void
  /** Accepted only to satisfy StateBlock's safe error-swallowing contract. */
  errorObject?: unknown
  path?: string
  params?: Record<string, string | number | undefined>
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (nextPage: number) => void
  className?: string
}

function isLegacyProps<TRow>(
  props: LegacyDataTableProps | StructuredDataTableProps<TRow>,
): props is LegacyDataTableProps {
  return 'children' in props && !('columns' in props)
}

function isNumericColumn<TRow>(col: DataTableColumn<TRow>): boolean {
  return (
    col.align === 'numeric' ||
    col.align === 'end' ||
    col.format === 'kwd' ||
    col.format === 'int' ||
    col.format === 'pct'
  )
}

function formatCellRaw(
  raw: number | string | Date | null | undefined,
  format: DataTableColumn<never>['format'],
  locale: FormatLocale,
  signed?: boolean,
  decimals?: number,
): { text: string; unavailable: boolean } {
  if (raw === null || raw === undefined) {
    return { text: UNAVAILABLE_DASH, unavailable: true }
  }
  if (typeof raw === 'number' && !Number.isFinite(raw)) {
    return { text: UNAVAILABLE_DASH, unavailable: true }
  }
  if (typeof raw === 'string' && (raw.trim() === '' || raw.trim() === UNAVAILABLE_DASH)) {
    return { text: UNAVAILABLE_DASH, unavailable: true }
  }

  if (format === 'kwd') {
    const val = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(val)) return { text: UNAVAILABLE_DASH, unavailable: true }
    const text = formatKwd(val, { locale, decimals, signed })
    return { text, unavailable: text === UNAVAILABLE_DASH }
  }

  if (format === 'int') {
    const val = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(val)) return { text: UNAVAILABLE_DASH, unavailable: true }
    const text = formatInt(val, { locale, signed })
    return { text, unavailable: text === UNAVAILABLE_DASH }
  }

  if (format === 'pct') {
    const val = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(val)) return { text: UNAVAILABLE_DASH, unavailable: true }
    const text = formatPct(val, { locale, decimals, signed })
    return { text, unavailable: text === UNAVAILABLE_DASH }
  }

  if (format === 'date') {
    const input = raw instanceof Date || typeof raw === 'number' || typeof raw === 'string' ? raw : null
    const text = formatKuwaitDate(input, locale)
    return { text, unavailable: text === UNAVAILABLE_DASH }
  }

  if (format === 'datetime') {
    const input = raw instanceof Date || typeof raw === 'number' || typeof raw === 'string' ? raw : null
    const text = formatKuwaitDateTime(input, locale)
    return { text, unavailable: text === UNAVAILABLE_DASH }
  }

  return { text: String(raw), unavailable: false }
}

export type DataTableProps<TRow = Record<string, unknown>> =
  | LegacyDataTableProps
  | StructuredDataTableProps<TRow>

/**
 * Executive DataTable primitive:
 * - 100% backwards-compatible with legacy `(toolbar, children, path, params, page, total)` usage
 * - Structured mode adds sticky header, RTL-aware logical alignment (`text-start`/`text-end`),
 *   `tabular-nums` + `dir="ltr"` numeric islands, inner `overflow-x-auto` (no 360px page overflow),
 *   pagination, loading skeleton, and bilingual empty/unavailable/error states.
 */
export function DataTable<TRow = Record<string, unknown>>(
  props: DataTableProps<TRow>,
): React.ReactElement {
  if (isLegacyProps(props)) {
    const { toolbar, children, path, params, page, total } = props
    return (
      <DataCard>
        {toolbar}
        <div className="w-full overflow-x-auto">{children}</div>
        <PaginationBar path={path} params={params} page={page} total={total} />
      </DataCard>
    )
  }

  const {
    columns,
    rows,
    rowKey,
    locale = 'ar',
    toolbar,
    caption,
    footer,
    stickyHeader = true,
    maxHeightClass,
    loading = false,
    unavailable = false,
    error = false,
    partial = false,
    warningAr,
    warningEn,
    emptyTitle,
    emptyDescription,
    onRetry,
    errorObject,
    path,
    params,
    page,
    pageSize = PAGE_SIZE,
    total,
    onPageChange,
    className = '',
  } = props

  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTooltip = getUnavailableTooltip(locale)

  const renderPagination = () => {
    if (page === undefined || total === undefined) return null
    if (path) {
      return (
        <PaginationBar
          path={path}
          params={params ?? {}}
          page={page}
          total={total}
        />
      )
    }

    const pages = pageSize === PAGE_SIZE ? pageCount(total) : Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    const summaryText =
      total === 0
        ? isAr
          ? 'لا توجد سجلات'
          : 'No records'
        : isAr
          ? `عرض ${from}–${to} من ${total}`
          : `Showing ${from}–${to} of ${total}`

    return (
      <div
        dir={dir}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ds-border-hairline)] px-4 py-3 text-xs"
        style={{ color: 'var(--ds-text-muted)' }}
      >
        <span>{summaryText}</span>
        {onPageChange ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="ds-motion ds-focus-ring rounded-lg border border-[var(--ds-border-hairline)] px-3 py-1.5 font-semibold text-[var(--ds-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isAr ? 'السابق' : 'Previous'}
            </button>
            <span dir="ltr" className="ds-num min-w-14 text-center font-semibold tabular-nums">
              {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => onPageChange(Math.min(pages, page + 1))}
              className="ds-motion ds-focus-ring rounded-lg border border-[var(--ds-border-hairline)] px-3 py-1.5 font-semibold text-[var(--ds-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        ) : (
          <span dir="ltr" className="ds-num font-semibold tabular-nums">
            {page} / {pages}
          </span>
        )}
      </div>
    )
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="p-4">
          <StateBlock state="loading" locale={locale} skeletonRows={4} />
        </div>
      )
    }

    if (error) {
      return (
        <div className="p-4">
          <StateBlock
            state="error"
            locale={locale}
            onRetry={onRetry}
            error={errorObject}
          />
        </div>
      )
    }

    if (unavailable) {
      return (
        <div className="p-4">
          <StateBlock state="unavailable" locale={locale} />
        </div>
      )
    }

    if (rows.length === 0) {
      return (
        <div className="p-4">
          <StateBlock
            state="empty"
            locale={locale}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      )
    }

    return (
      <div
        data-table-scroll="true"
        className={cx(
          'w-full overflow-x-auto',
          maxHeightClass && 'overflow-y-auto',
          maxHeightClass,
        )}
      >
        <table className="w-full min-w-[540px] border-collapse text-xs sm:text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead
            className={cx(
              stickyHeader && 'sticky top-0 z-10',
              'border-b border-[var(--ds-border-hairline)]',
            )}
            style={{ backgroundColor: 'var(--ds-bg-subtle)' }}
          >
            <tr>
              {columns.map((col) => {
                const numeric = isNumericColumn(col)
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : numeric
                      ? 'text-end'
                      : 'text-start'

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cx(
                      'whitespace-nowrap px-3.5 py-3 text-xs font-bold',
                      alignClass,
                      col.widthClass,
                      col.headerClassName,
                    )}
                    style={{ color: 'var(--ds-text-secondary)' }}
                  >
                    {col.header}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--ds-border-hairline)]">
            {rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                className="ds-motion transition-colors hover:bg-[var(--ds-bg-hover)]"
              >
                {columns.map((col) => {
                  const numeric = isNumericColumn(col)
                  const alignClass =
                    col.align === 'center'
                      ? 'text-center'
                      : numeric
                        ? 'text-end tabular-nums'
                        : 'text-start'

                  let cellNode: ReactNode
                  if (col.render) {
                    const custom = col.render(row, rowIndex)
                    cellNode =
                      numeric || col.format === 'date' || col.format === 'datetime' ? (
                        <span dir="ltr" className="ds-num tabular-nums">
                          {custom}
                        </span>
                      ) : (
                        custom
                      )
                  } else if (col.accessor) {
                    const raw = col.accessor(row)
                    const formatted = formatCellRaw(
                      raw,
                      col.format,
                      locale,
                      col.signed,
                      col.decimals,
                    )
                    if (formatted.unavailable) {
                      cellNode = (
                        <span
                          dir="ltr"
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                          className="ds-num tabular-nums"
                          style={{ color: 'var(--ds-unavailable)' }}
                        >
                          {UNAVAILABLE_DASH}
                        </span>
                      )
                    } else if (
                      numeric ||
                      col.format === 'date' ||
                      col.format === 'datetime'
                    ) {
                      cellNode = (
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatted.text}
                        </span>
                      )
                    } else {
                      cellNode = formatted.text
                    }
                  } else {
                    cellNode = (
                      <span
                        dir="ltr"
                        title={unavailableTooltip}
                        aria-label={unavailableTooltip}
                        data-unavailable="true"
                        className="ds-num tabular-nums"
                        style={{ color: 'var(--ds-unavailable)' }}
                      >
                        {UNAVAILABLE_DASH}
                      </span>
                    )
                  }

                  return (
                    <td
                      key={col.key}
                      className={cx(
                        'whitespace-nowrap px-3.5 py-3 align-middle',
                        alignClass,
                        col.widthClass,
                        col.cellClassName,
                      )}
                      style={{ color: 'var(--ds-text-primary)' }}
                    >
                      {cellNode}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          {footer ? (
            <tfoot
              className="border-t border-[var(--ds-border-hairline)] font-semibold"
              style={{ backgroundColor: 'var(--ds-bg-subtle)' }}
            >
              {footer}
            </tfoot>
          ) : null}
        </table>
      </div>
    )
  }

  return (
    <div
      dir={dir}
      data-data-table="true"
      className={cx(
        'ds-table-card ds-surface w-full min-w-0 max-w-full overflow-hidden rounded-2xl',
        className,
      )}
    >
      {toolbar ? (
        <div className="border-b border-[var(--ds-border-hairline)] px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      {partial && !loading && !error && !unavailable ? (
        <div className="px-4 pt-3">
          <PartialWarningBanner
            partial
            warningAr={warningAr}
            warningEn={warningEn}
            locale={locale}
          />
        </div>
      ) : null}

      {renderBody()}
      {renderPagination()}
    </div>
  )
}
