'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Badge, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { movementTypes, type MovementType, type StockMovement, type Warehouse } from '@/modules/inventory/client'
import { dateTimeText, type ListPage, type Phase } from '@/modules/inventory/ui/shared'

const PAGE_SIZE = 25

const typeTones = { IN: 'good', OUT: 'bad', TRANSFER: 'info' } as const satisfies Record<MovementType, 'good' | 'bad' | 'info'>

type Props = {
  warehouses: Warehouse[]
  reloadToken: number
}

/** The stock ledger, newest first. Rows are never edited or deleted, so this is the audit trail of every balance. */
export function MovementHistory({ warehouses, reloadToken }: Props) {
  const { t } = useI18n()
  const [type, setType] = useState<MovementType | ''>('')
  const [warehouseId, setWarehouseId] = useState('')
  const [rows, setRows] = useState<StockMovement[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [listError, setListError] = useState<MessageKey>('erp.err.generic')
  const [moreError, setMoreError] = useState<MessageKey | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reload, setReload] = useState(0)

  const buildQuery = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), direction: 'desc' })
      if (type) params.set('type', type)
      if (warehouseId) params.set('warehouseId', warehouseId)
      if (after) params.set('cursor', after)
      return `/api/v1/inventory/movements?${params.toString()}`
    },
    [type, warehouseId]
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    setMoreError(null)
    apiRequest<ListPage<StockMovement>>(buildQuery(null), { signal: controller.signal })
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
    <div className={panelClass}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={type} onChange={(event) => setType(event.target.value as MovementType | '')} aria-label={t('inv.hist.type')} className={`${inputClass} mt-0`}>
          <option value="">{t('inv.hist.allTypes')}</option>
          {movementTypes.map((value) => (
            <option key={value} value={value}>
              {t(`inv.mv.${value}`)}
            </option>
          ))}
        </select>
        <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} aria-label={t('inv.mv.warehouse')} className={`${inputClass} mt-0`}>
          <option value="">{t('inv.hist.allWarehouses')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} · {warehouse.name}
            </option>
          ))}
        </select>
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

      {phase === 'ready' && rows.length === 0 ? <p className="py-10 text-center text-gray-300">{t('inv.hist.empty')}</p> : null}

      {phase === 'ready' && rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="text-gray-400">
              <tr className="border-b border-[#30363d]">
                <th className="px-3 py-2 text-start font-medium">{t('inv.hist.date')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.hist.type')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.col.name')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.mv.warehouse')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.hist.quantity')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.hist.reference')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('inv.hist.note')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((movement) => (
                <tr key={movement.id} className="border-b border-[#30363d]/60 text-gray-200 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5">
                    <Num>{dateTimeText(movement.createdAt)}</Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={typeTones[movement.movementType]}>{t(`inv.mv.${movement.movementType}`)}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-blue-300">
                      <Num>{movement.sku}</Num>
                    </span>{' '}
                    {movement.itemName}
                  </td>
                  <td className="px-3 py-2.5">
                    <Num>{movement.warehouseCode}</Num>
                  </td>
                  <td className={`px-3 py-2.5 font-semibold ${movement.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <Num>{`${movement.quantity > 0 ? '+' : '-'}${Math.abs(movement.quantity).toLocaleString('en-US')}`}</Num>
                  </td>
                  <td className="px-3 py-2.5">{t(`inv.ref.${movement.referenceType}`)}</td>
                  <td className="px-3 py-2.5 text-gray-400">{movement.note ?? '—'}</td>
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
