'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import {
  DataScopeSwitcher,
  scopeToQuery,
  type DataScopeValue,
} from '@/components/erp/DataScopeSwitcher'
import { Badge, Num } from '@/components/ui'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  movementTypes,
  type MovementType,
  type StockMovement,
  type Warehouse,
} from '@/modules/inventory/client'
import {
  invErrorClass,
  invInputClass,
  invPanelClass,
  invSecondaryButton,
  type ListPage,
  type Phase,
} from '@/modules/inventory/ui/shared'

const PAGE_SIZE = 25

const typeTones = {
  IN: 'good',
  OUT: 'bad',
  TRANSFER: 'info',
} as const satisfies Record<MovementType, 'good' | 'bad' | 'info'>

type Props = {
  warehouses: Warehouse[]
  reloadToken: number
}

/** The stock ledger, newest first. Rows are never edited or deleted. */
export function MovementHistory({ warehouses, reloadToken }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)

  const [type, setType] = useState<MovementType | ''>('')
  const [warehouseId, setWarehouseId] = useState('')
  const [scope, setScope] = useState<DataScopeValue>({
    scope: 'hot',
    from: '',
    to: '',
  })
  const [rows, setRows] = useState<StockMovement[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reload, setReload] = useState(0)

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        direction: 'desc',
        ...scopeToQuery(scope),
      })
      if (type) params.set('type', type)
      if (warehouseId) params.set('warehouseId', warehouseId)
      if (after) params.set('cursor', after)
      return `/api/v1/inventory/movements?${params.toString()}`
    },
    [type, warehouseId, scope],
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    setMoreError(null)
    apiRequest<ListPage<StockMovement>>(buildQuery(null), {
      signal: controller.signal,
    })
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
      const page = await apiRequest<ListPage<StockMovement>>(buildQuery(cursor))
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
      <div className="mb-4">
        <DataScopeSwitcher value={scope} onChange={setScope} />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as MovementType | '')}
          aria-label={t('inv.hist.type')}
          className={`${invInputClass} mt-0`}
        >
          <option value="">{t('inv.hist.allTypes')}</option>
          {movementTypes.map((value) => (
            <option key={value} value={value}>
              {t(`inv.mv.${value}`)}
            </option>
          ))}
        </select>
        <select
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          aria-label={t('inv.mv.warehouse')}
          className={`${invInputClass} mt-0`}
        >
          <option value="">{t('inv.hist.allWarehouses')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} · {warehouse.name}
            </option>
          ))}
        </select>
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
          title={t('inv.hist.empty')}
        />
      ) : null}

      {phase === 'ready' && rows.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-start">{t('inv.hist.date')}</th>
                <th className="px-3 py-2 text-start">{t('inv.hist.type')}</th>
                <th className="px-3 py-2 text-start">{t('inv.col.name')}</th>
                <th className="px-3 py-2 text-start">{t('inv.mv.warehouse')}</th>
                <th className="px-3 py-2 text-end">{t('inv.hist.quantity')}</th>
                <th className="px-3 py-2 text-start">{t('inv.hist.reference')}</th>
                <th className="px-3 py-2 text-start">{t('inv.hist.note')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-hairline)] text-slate-800 dark:text-slate-100">
              {rows.map((movement) => (
                <tr
                  key={movement.id}
                  className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-2.5">
                    <Num>{formatDateTime(movement.createdAt, { locale: fmtLocale })}</Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={typeTones[movement.movementType]}>
                      {t(`inv.mv.${movement.movementType}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      <Num>{movement.sku}</Num>
                    </span>{' '}
                    {movement.itemName}
                  </td>
                  <td className="px-3 py-2.5">
                    <Num>{movement.warehouseCode}</Num>
                  </td>
                  <td
                    className={`px-3 py-2.5 text-end font-semibold ${
                      movement.quantity > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <Num>
                      {formatInt(movement.quantity, {
                        locale: fmtLocale,
                        signed: true,
                      })}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5">
                    {t(`inv.ref.${movement.referenceType}`)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-slate-600 dark:text-slate-300"
                    title={!movement.note ? unavailableTooltip : undefined}
                  >
                    {movement.note ?? UNAVAILABLE_DASH}
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
