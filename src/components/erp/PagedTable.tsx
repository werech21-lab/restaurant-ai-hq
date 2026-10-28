'use client'

import type { ReactNode } from 'react'
import { errorClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { usePagedList } from '@/components/erp/usePagedList'
import { useI18n, type MessageKey } from '@/lib/i18n'

export type Column<T> = { header: MessageKey; cell: (row: T) => ReactNode }

type Props<T extends { id: string }> = {
  /** The endpoint with every filter, without the cursor. A change reloads from the first page. */
  path: string
  reloadToken: number
  columns: ReadonlyArray<Column<T>>
  onOpen: (row: T) => void
  emptyTitle: MessageKey
  emptyHint: MessageKey
  toolbar?: ReactNode
}

/** A server-paginated table with loading, error, empty and load-more states. Rows open on click or Enter. */
export function PagedTable<T extends { id: string }>({ path, reloadToken, columns, onOpen, emptyTitle, emptyHint, toolbar }: Props<T>) {
  const { t } = useI18n()
  const list = usePagedList<T>(path, reloadToken)

  return (
    <div className={panelClass}>
      {toolbar ? <div className="mb-4 flex flex-wrap items-center gap-3">{toolbar}</div> : null}

      {list.phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}

      {list.phase === 'error' ? (
        <div className="space-y-3 py-6 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(list.error)}
          </p>
          <div>
            <button type="button" onClick={list.reload} className={secondaryButton}>
              {t('erp.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {list.phase === 'ready' && list.rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-200">{t(emptyTitle)}</p>
          <p className="mt-1 text-sm text-gray-400">{t(emptyHint)}</p>
        </div>
      ) : null}

      {list.phase === 'ready' && list.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                {columns.map((column) => (
                  <th key={column.header} className="px-3 py-2 text-start font-medium">
                    {t(column.header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(row)
                  }}
                  className="cursor-pointer border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
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
        <p role="alert" className={`${errorClass} mt-3`}>
          {t(list.moreError)}
        </p>
      ) : null}
      {list.hasMore && list.phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button type="button" onClick={list.loadMore} disabled={list.loadingMore} className={secondaryButton}>
            {list.loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
