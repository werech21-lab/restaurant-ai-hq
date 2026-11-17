'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Boxes, PackageX, Wallet } from 'lucide-react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Num } from '@/components/ui'
import { KpiCard } from '@/components/ui/kpi-card'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { formatInt, formatPct, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import {
  utilizationPercent,
  type InventorySummary,
  type Item,
} from '@/modules/inventory/client'
import { Quantity, StockBadge, invInputClass } from '@/modules/inventory/ui/shared'

const windows = [7, 30, 90] as const

type Props = {
  reloadToken: number
  onStockEntry: (item: Item) => void
  initialSummary?: InventorySummary | null
  initialError?: MessageKey | null
}

function barTone(percent: number): string {
  if (percent >= 100) return 'bg-rose-500'
  if (percent >= 80) return 'bg-amber-400'
  return 'bg-emerald-500'
}

/** Total valuation, low stock alerts, fast-moving items and warehouse utilization. */
export function InventoryOverview({
  reloadToken,
  onStockEntry,
  initialSummary,
  initialError = null,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const [days, setDays] = useState<number>(30)
  const [summary, setSummary] = useState<InventorySummary | null>(
    initialSummary ?? null,
  )
  const [error, setError] = useState<MessageKey | null>(initialError)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (initialSummary !== undefined && reload === 0 && reloadToken === 0) return
    const controller = new AbortController()
    setError(null)
    apiRequest<{ data: InventorySummary }>(`/api/v1/inventory/summary?days=${days}`, {
      signal: controller.signal,
    })
      .then((result) => setSummary(result.data))
      .catch((failure: unknown) => {
        if (!isAbort(failure)) setError(errorKey(failure))
      })
    return () => controller.abort()
  }, [days, reloadToken, reload, initialSummary])

  if (error && !summary) {
    const isForbidden = error === 'erp.err.forbidden' || error === 'erp.err.unauthenticated'
    return (
      <StateBlock
        state={isForbidden ? 'forbidden' : 'error'}
        locale={fmtLocale}
        title={t(error)}
        onRetry={isForbidden ? undefined : () => setReload((value) => value + 1)}
      />
    )
  }

  const fastMax =
    summary?.fastMoving.reduce((max, item) => Math.max(max, item.outQuantity), 0) ?? 0
  const valuationKwd =
    summary && Number.isSafeInteger(summary.valuationMinor)
      ? summary.valuationMinor / 1000
      : null

  return (
    <div className="space-y-4">
      {error ? (
        <StateBlock
          state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          compact
          locale={fmtLocale}
          title={t(error)}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          locale={fmtLocale}
          label={t('inv.stat.valuation')}
          value={valuationKwd}
          format="kwd"
          subtitle={t('inv.stat.valuationHint')}
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          loading={!summary && !error}
        />
        <KpiCard
          locale={fmtLocale}
          label={t('inv.stat.items')}
          value={summary ? summary.itemCount : null}
          format="int"
          subtitle={
            summary
              ? `${formatInt(summary.activeItemCount, fmtLocale)} ${t('inv.stat.itemsActive')}`
              : undefined
          }
          icon={<Boxes className="h-4 w-4" aria-hidden />}
          loading={!summary && !error}
        />
        <KpiCard
          locale={fmtLocale}
          label={t('inv.stat.low')}
          value={summary ? summary.lowStockCount : null}
          format="int"
          higherIsBetter={false}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          loading={!summary && !error}
        />
        <KpiCard
          locale={fmtLocale}
          label={t('inv.stat.out')}
          value={summary ? summary.outOfStockCount : null}
          format="int"
          higherIsBetter={false}
          icon={<PackageX className="h-4 w-4" aria-hidden />}
          loading={!summary && !error}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          locale={fmtLocale}
          id="inv-low-title"
          title={t('inv.lowStock.title')}
          state={!summary ? 'loading' : summary.lowStock.length === 0 ? 'empty' : 'ready'}
          stateTitle={!summary ? t('erp.loading') : t('inv.lowStock.empty')}
        >
          {summary && summary.lowStock.length > 0 ? (
            <ul className="divide-y divide-[var(--ds-border-hairline)]">
              {summary.lowStock.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <Num>{item.sku}</Num> · {t('inv.lowStock.reorderAt')}{' '}
                      <Num>{formatInt(item.reorderLevel, fmtLocale)}</Num>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Quantity value={item.currentStock} unit={item.unit} />
                    <StockBadge item={item} />
                    <button
                      type="button"
                      onClick={() => onStockEntry(item)}
                      className="ds-focus-ring cursor-pointer rounded text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      {t('inv.stockEntry')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>

        <SectionCard
          locale={fmtLocale}
          id="inv-fast-title"
          title={t('inv.fast.title')}
          subtitle={t('inv.fast.hint')}
          state={!summary ? 'loading' : summary.fastMoving.length === 0 ? 'empty' : 'ready'}
          stateTitle={!summary ? t('erp.loading') : t('inv.fast.empty')}
          actions={
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span>{t('inv.fast.window')}</span>
              <select
                aria-label={t('inv.fast.window')}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className={`${invInputClass} mt-0 w-auto py-1.5`}
              >
                {windows.map((value) => (
                  <option key={value} value={value}>
                    {formatInt(value, fmtLocale)} {t('inv.fast.days')}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          {summary && summary.fastMoving.length > 0 ? (
            <ul className="space-y-3">
              {summary.fastMoving.map((item) => (
                <li key={item.itemId} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </span>
                    <Quantity value={item.outQuantity} unit={item.unit} />
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${fastMax > 0 ? Math.max(4, Math.round((item.outQuantity * 100) / fastMax)) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        locale={fmtLocale}
        id="inv-wh-title"
        title={t('inv.warehouses.title')}
        state={!summary ? 'loading' : summary.warehouses.length === 0 ? 'empty' : 'ready'}
        stateTitle={!summary ? t('erp.loading') : t('inv.warehouses.empty')}
      >
        {summary && summary.warehouses.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {summary.warehouses.map((warehouse) => {
              const percent = utilizationPercent(
                warehouse.unitsStored,
                warehouse.capacity,
              )
              return (
                <li
                  key={warehouse.id}
                  className="ds-surface-subtle rounded-xl p-3.5 text-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      <Num>{warehouse.code}</Num> · {warehouse.name}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">
                      <Num>{formatInt(warehouse.unitsStored, fmtLocale)}</Num>{' '}
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {t('inv.warehouses.units')}
                      </span>
                    </span>
                  </div>
                  {percent !== null && warehouse.capacity !== null ? (
                    <>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
                        role="presentation"
                      >
                        <div
                          className={`h-full rounded-full ${barTone(percent)}`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>
                          <Num>{formatPct(percent, { locale: fmtLocale, decimals: 0 })}</Num>
                        </span>
                        <span>
                          {t('inv.wh.capacity')}:{' '}
                          <Num>{formatInt(warehouse.capacity, fmtLocale)}</Num>
                        </span>
                      </div>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </SectionCard>
    </div>
  )
}
