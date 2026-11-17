'use client'

import type { ReactNode } from 'react'
import { usePagedList } from '@/components/erp/usePagedList'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  proErrorClass,
  proPanelClass,
  proSecondaryButton,
} from '@/modules/procurement/ui/shared'

export type Column<T> = { header: MessageKey; cell: (row: T) => ReactNode }

type Props<T extends { id: string }> = {
  /** The endpoint with every filter, without the cursor. A change reloads from the first page. */
  path: string
  reloadToken: number
  columns: ReadonlyArray<Column<T>>
  onOpen: (row: T) => void
  emptyTitle: MessageKey
  emptyHint?: MessageKey
  toolbar?: ReactNode
}

/** A server-paginated table with loading, error, empty and load-more states. Rows open on click or Enter. */
export function PagedTable<T extends { id: string }>({
  path,
  reloadToken,
  columns,
  onOpen,
  emptyTitle,
  emptyHint,
  toolbar,
}: Props<T>) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const list = usePagedList<T>(path, reloadToken)

  return (
    <div className={proPanelClass}>
      {toolbar ? <div className="mb-4 flex flex-wrap items-center gap-3">{toolbar}</div> : null}

      {list.phase === 'loading' ? (
        <StateBlock
          state="loading"
          locale={fmtLocale}
          skeletonRows={4}
          title={t('erp.loading')}
        />
      ) : null}

      {list.phase === 'error' ? (
        <StateBlock
          state={list.error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(list.error)}
          onRetry={list.error === 'erp.err.forbidden' ? undefined : list.reload}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length === 0 ? (
        <StateBlock
          state="empty"
          compact
          locale={fmtLocale}
          title={t(emptyTitle)}
          description={emptyHint ? t(emptyHint) : undefined}
        />
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th key={column.header} className="px-3 py-2 text-start">
                    {t(column.header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {list.rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(row)
                  }}
                  className="ds-focus-ring cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.04]"
                >
                  {columns.map((column) => (
                    <td key={column.header} className="px-3 py-2.5">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {list.moreError ? (
        <p role="alert" className={`${proErrorClass} mt-3`}>
          {t(list.moreError)}
        </p>
      ) : null}
      {list.hasMore && list.phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={list.loadMore}
            disabled={list.loadingMore}
            className={proSecondaryButton}
          >
            {list.loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
