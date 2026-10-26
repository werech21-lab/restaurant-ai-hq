'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { errorClass, inputClass, panelClass, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import { utilizationPercent, type InventorySummary, type Item } from '@/modules/inventory/client'
import { Quantity, StockBadge } from '@/modules/inventory/ui/shared'

const windows = [7, 30, 90] as const

type Props = {
  reloadToken: number
  onStockEntry: (item: Item) => void
}

function barTone(percent: number): string {
  if (percent >= 100) return 'bg-rose-400'
  if (percent >= 80) return 'bg-amber-300'
  return 'bg-emerald-400'
}

/** Total valuation, low stock alerts, fast-moving items and warehouse utilization. */
export function InventoryOverview({ reloadToken, onStockEntry }: Props) {
  const { t } = useI18n()
  const [days, setDays] = useState<number>(30)
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    apiRequest<{ data: InventorySummary }>(`/api/v1/inventory/summary?days=${days}`, { signal: controller.signal })
      .then((result) => setSummary(result.data))
      .catch((failure: unknown) => {
        if (!isAbort(failure)) setError(errorKey(failure))
      })
    return () => controller.abort()
  }, [days, reloadToken, reload])

  if (error && !summary) {
    return (
      <div className={`${panelClass} space-y-3 py-8 text-center`}>
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(error)}
        </p>
        <div>
          <button type="button" onClick={() => setReload((value) => value + 1)} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
    )
  }

  const fastMax = summary?.fastMoving.reduce((max, item) => Math.max(max, item.outQuantity), 0) ?? 0

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className={errorClass}>
          {t(error)}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('inv.stat.valuation')}</div>
          <div className="mt-2 text-2xl font-bold text-mist-100">{summary ? <Money value={formatMinor(summary.valuationMinor)} /> : <Num>—</Num>}</div>
          <div className="mt-1 text-xs text-gray-500">{t('inv.stat.valuationHint')}</div>
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('inv.stat.items')}</div>
          <div className="mt-2 text-2xl font-bold text-mist-100">
            <Num>{summary ? summary.itemCount.toLocaleString('en-US') : '—'}</Num>
          </div>
          {summary ? (
            <div className="mt-1 text-sm text-gray-400">
              <Num>{summary.activeItemCount.toLocaleString('en-US')}</Num> {t('inv.stat.itemsActive')}
            </div>
          ) : null}
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('inv.stat.low')}</div>
          <div className="mt-2 text-2xl font-bold text-yellow-300">
            <Num>{summary ? summary.lowStockCount.toLocaleString('en-US') : '—'}</Num>
          </div>
        </div>
        <div className={panelClass}>
          <div className="text-sm text-gray-400">{t('inv.stat.out')}</div>
          <div className="mt-2 text-2xl font-bold text-red-400">
            <Num>{summary ? summary.outOfStockCount.toLocaleString('en-US') : '—'}</Num>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={panelClass} aria-labelledby="inv-low-title">
          <h3 id="inv-low-title" className="font-semibold text-mist-100">
            {t('inv.lowStock.title')}
          </h3>
          {!summary ? <p className="py-6 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}
          {summary && summary.lowStock.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">{t('inv.lowStock.empty')}</p> : null}
          {summary && summary.lowStock.length > 0 ? (
            <ul className="mt-3 divide-y divide-[#30363d]/60">
              {summary.lowStock.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-100">{item.name}</div>
                    <div className="text-xs text-gray-400">
                      <Num>{item.sku}</Num> · {t('inv.lowStock.reorderAt')} <Num>{item.reorderLevel.toLocaleString('en-US')}</Num>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Quantity value={item.currentStock} unit={item.unit} />
                    <StockBadge item={item} />
                    <button type="button" onClick={() => onStockEntry(item)} className="text-blue-400 hover:text-blue-300">
                      {t('inv.stockEntry')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={panelClass} aria-labelledby="inv-fast-title">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="inv-fast-title" className="font-semibold text-mist-100">
                {t('inv.fast.title')}
              </h3>
              <p className="text-xs text-gray-400">{t('inv.fast.hint')}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              {t('inv.fast.window')}
              <select value={days} onChange={(event) => setDays(Number(event.target.value))} className={`${inputClass} mt-0 w-auto py-1.5`}>
                {windows.map((value) => (
                  <option key={value} value={value}>
                    {value} {t('inv.fast.days')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!summary ? <p className="py-6 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}
          {summary && summary.fastMoving.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">{t('inv.fast.empty')}</p> : null}
          {summary && summary.fastMoving.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {summary.fastMoving.map((item) => (
                <li key={item.itemId} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-gray-100">{item.name}</span>
                    <Quantity value={item.outQuantity} unit={item.unit} />
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5" role="presentation">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${fastMax > 0 ? Math.max(4, Math.round((item.outQuantity * 100) / fastMax)) : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className={panelClass} aria-labelledby="inv-wh-title">
        <h3 id="inv-wh-title" className="font-semibold text-mist-100">
          {t('inv.warehouses.title')}
        </h3>
        {!summary ? <p className="py-6 text-center text-sm text-gray-400">{t('erp.loading')}</p> : null}
        {summary && summary.warehouses.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">{t('inv.warehouses.empty')}</p> : null}
        {summary && summary.warehouses.length > 0 ? (
          <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {summary.warehouses.map((warehouse) => {
              const percent = utilizationPercent(warehouse.unitsStored, warehouse.capacity)
              return (
                <li key={warehouse.id} className="rounded-xl border border-[#30363d] p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-gray-100">
                      <Num>{warehouse.code}</Num> · {warehouse.name}
                    </span>
                    <span className="text-gray-300">
                      <Num>{warehouse.unitsStored.toLocaleString('en-US')}</Num> <span className="text-xs text-gray-400">{t('inv.warehouses.units')}</span>
                    </span>
                  </div>
                  {percent !== null && warehouse.capacity !== null ? (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5" role="presentation">
                        <div className={`h-full rounded-full ${barTone(percent)}`} style={{ width: `${Math.min(100, percent)}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-400">
                        <span>
                          <Num>{`${percent}%`}</Num>
                        </span>
                        <span>
                          {t('inv.wh.capacity')}: <Num>{warehouse.capacity.toLocaleString('en-US')}</Num>
                        </span>
                      </div>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
