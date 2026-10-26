'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import { itemSortKeys, type Item, type ItemSortKey } from '@/modules/inventory/client'
import { itemValueText, Quantity, StockBadge, useDebounced, type ListPage, type Phase } from '@/modules/inventory/ui/shared'

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
  const { t } = useI18n()
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
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort, direction, status })
      if (query) params.set('q', query)
      if (lowOnly) params.set('lowStock', 'true')
      if (after) params.set('cursor', after)
      return `/api/v1/inventory/items?${params.toString()}`
    },
    [query, status, lowOnly, sort, direction]
  )

  useEffect(() => {
    const controller = new AbortController()
    // A reload caused by a change elsewhere keeps the current rows on screen until the new page arrives.
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
    <div className={panelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('inv.search')}
          aria-label={t('inv.search')}
          className={`${inputClass} mt-0 lg:col-span-4`}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label={t('inv.filter.status')}
          className={`${inputClass} mt-0 lg:col-span-2`}
        >
          <option value="active">{t('inv.status.active')}</option>
          <option value="inactive">{t('inv.status.inactive')}</option>
          <option value="all">{t('inv.status.all')}</option>
        </select>
        <div className="flex gap-2 lg:col-span-4">
          <select value={sort} onChange={(event) => setSort(event.target.value as ItemSortKey)} aria-label={t('erp.sortBy')} className={`${inputClass} mt-0`}>
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
            className={`${inputClass} mt-0`}
          >
            <option value="asc">{t('erp.sort.asc')}</option>
            <option value="desc">{t('erp.sort.desc')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-200 lg:col-span-2">
          <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} className="h-4 w-4 accent-blue-500" />
          {t('inv.filter.lowOnly')}
        </label>
      </div>

      {phase === 'loading' ? <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}

      {phase === 'error' ? (
        <div className="space-y-3 py-6 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(listError)}
          </p>
          <div>
            <button type="button" onClick={() => setReload((value) => value + 1)} className={secondaryButton}>
              {t('erp.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'ready' && rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-200">{t('inv.empty')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('inv.emptyHint')}</p>
        </div>
      ) : null}

      {phase === 'ready' && rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.sku')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.name')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.stock')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.reorder')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.cost')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.price')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.value')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.state')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5 font-semibold text-blue-300">
                    <Num>{item.sku}</Num>
                  </td>
                  <td className="px-3 py-2.5">{item.name}</td>
                  <td className="px-3 py-2.5">
                    <Quantity value={item.currentStock} unit={item.unit} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Num>{item.reorderLevel.toLocaleString('en-US')}</Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <Money value={formatMinor(item.unitCostMinor)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Money value={formatMinor(item.sellingPriceMinor)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Money value={itemValueText(item)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StockBadge item={item} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onStockEntry(item)} className="text-blue-400 hover:text-blue-300">
                        {t('inv.stockEntry')}
                      </button>
                      <button type="button" onClick={() => onEdit(item)} className="text-gray-300 hover:text-white">
                        {t('inv.edit')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {moreError ? (
        <p role="alert" className={`${errorClass} mt-3`}>
          {t(moreError)}
        </p>
      ) : null}
      {cursor && phase === 'ready' ? (
        <div className="mt-4 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className={secondaryButton}>
            {loadingMore ? t('erp.loading') : t('erp.loadMore')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
