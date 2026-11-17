'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { useCan } from '@/components/erp/permissions'
import { Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { itemSortKeys, type Item, type ItemSortKey } from '@/modules/inventory/client'
import {
  Quantity,
  StockBadge,
  formatMinorKwd,
  invDangerButton,
  invErrorClass,
  invInputClass,
  invPanelClass,
  invSecondaryButton,
  itemValueText,
  useDebounced,
  type ListPage,
  type Phase,
} from '@/modules/inventory/ui/shared'

const PAGE_SIZE = 25

type StatusFilter = 'active' | 'inactive' | 'all'

type Props = {
  /** Changes whenever stock or products change elsewhere, so the list reloads. */
  reloadToken: number
  onEdit: (item: Item) => void
  onStockEntry: (item: Item) => void
}

/** Product catalog with live search, status and low-stock filters, server-side sorting and paging. */
export function ProductCatalog({ reloadToken, onEdit, onStockEntry }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const canUpdate = useCan(permissions.inventoryItemUpdate)
  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 250)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [lowOnly, setLowOnly] = useState(false)
  const [sort, setSort] = useState<ItemSortKey>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const [rows, setRows] = useState<Item[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reload, setReload] = useState(0)
  const seenToken = useRef(reloadToken)

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        sort,
        direction,
        status,
      })
      if (query) params.set('q', query)
      if (lowOnly) params.set('lowStock', 'true')
      if (after) params.set('cursor', after)
      return `/api/v1/inventory/items?${params.toString()}`
    },
    [query, status, lowOnly, sort, direction],
  )

  useEffect(() => {
    const controller = new AbortController()
    const silent = seenToken.current !== reloadToken
    seenToken.current = reloadToken
    if (!silent) {
      setRows([])
      setCursor(null)
      setPhase('loading')
    }
    setMoreError(null)
    apiRequest<ListPage<Item>>(buildQuery(null), { signal: controller.signal })
      .then((page) => {
        setRows(page.data)
        setCursor(page.nextCursor)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setListError(errorKey(error))
        setPhase('error')
      })
    return () => controller.abort()
  }, [buildQuery, reloadToken, reload])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiRequest<ListPage<Item>>(buildQuery(cursor))
      setRows((current) => [...current, ...page.data])
      setCursor(page.nextCursor)
    } catch (error) {
      setMoreError(errorKey(error))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className={invPanelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('inv.search')}
          aria-label={t('inv.search')}
          className={`${invInputClass} mt-0 lg:col-span-4`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label={t('inv.filter.status')}
          className={`${invInputClass} mt-0 lg:col-span-2`}
        >
          <option value="active">{t('inv.status.active')}</option>
          <option value="inactive">{t('inv.status.inactive')}</option>
          <option value="all">{t('inv.status.all')}</option>
        </select>
        <div className="flex gap-2 lg:col-span-4">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as ItemSortKey)}
            aria-label={t('erp.sortBy')}
            className={`${invInputClass} mt-0`}
          >
            {itemSortKeys.map((key) => (
              <option key={key} value={key}>
                {t(`inv.sort.${key}`)}
              </option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as 'asc' | 'desc')}
            aria-label={t('erp.sortBy')}
            className={`${invInputClass} mt-0`}
          >
            <option value="asc">{t('erp.sort.asc')}</option>
            <option value="desc">{t('erp.sort.desc')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 lg:col-span-2 dark:text-slate-200">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => setLowOnly(event.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          {t('inv.filter.lowOnly')}
        </label>
      </div>

      {phase === 'loading' ? (
        <StateBlock
          state="loading"
          locale={fmtLocale}
          skeletonRows={4}
          title={t('erp.loading')}
        />
      ) : null}

      {phase === 'error' ? (
        <StateBlock
          state={listError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(listError)}
          onRetry={
            listError === 'erp.err.forbidden'
              ? undefined
              : () => setReload((value) => value + 1)
          }
        />
      ) : null}

      {phase === 'ready' && rows.length === 0 ? (
        <StateBlock
          state="empty"
          compact
          locale={fmtLocale}
          title={t('inv.empty')}
          description={t('inv.emptyHint')}
        />
      ) : null}

      {phase === 'ready' && rows.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">{t('inv.col.sku')}</th>
                <th className="px-3 py-2 text-start">{t('inv.col.name')}</th>
                <th className="px-3 py-2 text-end">{t('inv.col.stock')}</th>
                <th className="px-3 py-2 text-end">{t('inv.col.reorder')}</th>
                <th className="px-3 py-2 text-end">{t('inv.col.cost')}</th>
                <th className="px-3 py-2 text-end">{t('inv.col.price')}</th>
                <th className="px-3 py-2 text-end">{t('inv.col.value')}</th>
                <th className="px-3 py-2 text-start">{t('inv.col.state')}</th>
                <th className="px-3 py-2 text-start">{t('inv.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-2.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Num>{item.sku}</Num>
                  </td>
                  <td className="px-3 py-2.5">{item.name}</td>
                  <td className="px-3 py-2.5 text-end">
                    <Quantity value={item.currentStock} unit={item.unit} />
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Num>{formatInt(item.reorderLevel, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Num>{formatMinorKwd(item.unitCostMinor, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Num>{formatMinorKwd(item.sellingPriceMinor, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end font-semibold">
                    <Num>{itemValueText(item, fmtLocale)}</Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <StockBadge item={item} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onStockEntry(item)}
                        className="ds-focus-ring cursor-pointer rounded text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        {t('inv.stockEntry')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="ds-focus-ring cursor-pointer rounded text-xs font-semibold text-slate-700 hover:underline dark:text-slate-200"
                      >
                        {t('inv.edit')}
                      </button>
                      {canUpdate && item.isActive ? (
                        <button
                          type="button"
                          className={invDangerButton}
                          onClick={() => {
                            if (!window.confirm(t('inv.deactivateConfirm'))) return
                            void apiRequest(`/api/v1/inventory/items/${item.id}`, {
                              method: 'PATCH',
                              body: {
                                version: item.version,
                                name: item.name,
                                unitCostMinor: item.unitCostMinor,
                                sellingPriceMinor: item.sellingPriceMinor,
                                reorderLevel: item.reorderLevel,
                                isActive: false,
                              },
                            })
                              .then(() => setReload((value) => value + 1))
                              .catch((error: unknown) => setMoreError(errorKey(error)))
                          }}
                        >
                          {t('inv.deactivate')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {moreError ? (
        <p role="alert" className={`${invErrorClass} mt-3`}>
          {t(moreError)}
        </p>
      ) : null}
      {cursor && phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={invSecondaryButton}
          >
            {loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
