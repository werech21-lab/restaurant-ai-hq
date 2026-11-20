'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { PermissionProvider } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Item, Warehouse } from '@/modules/inventory/client'
import { InventoryOverview } from '@/modules/inventory/ui/InventoryOverview'
import { ItemForm } from '@/modules/inventory/ui/ItemForm'
import { MovementHistory } from '@/modules/inventory/ui/MovementHistory'
import { ProductCatalog } from '@/modules/inventory/ui/ProductCatalog'
import {
  Modal,
  invNoticeClass,
  invPrimaryButton,
  invSecondaryButton,
  type ListPage,
  type Phase,
} from '@/modules/inventory/ui/shared'
import { StockMovementForm } from '@/modules/inventory/ui/StockMovementForm'
import { WarehouseManager } from '@/modules/inventory/ui/WarehouseManager'

const tabs = ['overview', 'catalog', 'movements', 'warehouses'] as const
type Tab = (typeof tabs)[number]

type Dialog = { kind: 'item'; item?: Item } | { kind: 'movement'; item?: Item } | null

/** The inventory screen: overview, product catalog, stock movement ledger and warehouses. */
export default function InventoryWorkspace({
  initialItemId = null,
  permissions = [],
  initialTab,
}: {
  initialItemId?: string | null
  permissions?: readonly string[]
  initialTab?: Tab
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const [tab, setTab] = useState<Tab>(
    initialTab ?? (initialItemId ? 'catalog' : 'overview'),
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [linkError, setLinkError] = useState<MessageKey | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehousePhase, setWarehousePhase] = useState<Phase>('loading')
  const [warehouseError, setWarehouseError] = useState<MessageKey>('erp.err.generic')
  const [warehouseReload, setWarehouseReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<ListPage<Warehouse>>('/api/v1/inventory/warehouses?limit=100&status=all', {
      signal: controller.signal,
    })
      .then((page) => {
        setWarehouses(page.data)
        setWarehousePhase('ready')
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return
        setWarehouseError(errorKey(error))
        setWarehousePhase('error')
      })
    return () => controller.abort()
  }, [reloadToken, warehouseReload])

  useEffect(() => {
    if (!initialItemId) return
    const controller = new AbortController()
    apiRequest<{ data: Item }>(`/api/v1/inventory/items/${initialItemId}`, {
      signal: controller.signal,
    })
      .then((payload) => setDialog({ kind: 'item', item: payload.data }))
      .catch((error: unknown) => {
        if (!isAbort(error)) setLinkError(errorKey(error))
      })
    return () => controller.abort()
  }, [initialItemId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const changed = useCallback((message: MessageKey) => {
    setNotice(message)
    setReloadToken((value) => value + 1)
  }, [])

  const closeDialog = useCallback(() => setDialog(null), [])

  return (
    <PermissionProvider permissions={permissions}>
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
        <Link
          href="/erp"
          className="ds-focus-ring inline-block rounded text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {t('erp.back')}
        </Link>

        <SectionCard
          locale={fmtLocale}
          icon={<Package className="h-4 w-4" aria-hidden />}
          title={t('inv.title')}
          subtitle={t('inv.subtitle')}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog({ kind: 'movement' })}
                className={invSecondaryButton}
              >
                {t('inv.stockEntry')}
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'item' })}
                className={invPrimaryButton}
              >
                {t('inv.newItem')}
              </button>
            </div>
          }
        >
          {notice ? (
            <p role="status" className={`${invNoticeClass} mb-4`}>
              {t(notice)}
            </p>
          ) : null}

          {linkError ? (
            <div className="mb-4">
              <StateBlock
                state={linkError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
                compact
                locale={fmtLocale}
                title={t(linkError)}
              />
            </div>
          ) : null}

          <div
            role="tablist"
            aria-label={t('inv.title')}
            className="mb-4 flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)]"
          >
            {tabs.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`inv-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`inv-panel-${value}`}
                onClick={() => setTab(value)}
                className={`ds-focus-ring -mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
                  tab === value
                    ? 'border-emerald-600 font-bold text-emerald-700 dark:border-emerald-400 dark:text-emerald-300'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {t(`inv.tab.${value}`)}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`inv-panel-${tab}`}
            aria-labelledby={`inv-tab-${tab}`}
          >
            {tab === 'overview' ? (
              <InventoryOverview
                reloadToken={reloadToken}
                onStockEntry={(item) => setDialog({ kind: 'movement', item })}
              />
            ) : null}
            {tab === 'catalog' ? (
              <ProductCatalog
                reloadToken={reloadToken}
                onEdit={(item) => setDialog({ kind: 'item', item })}
                onStockEntry={(item) => setDialog({ kind: 'movement', item })}
              />
            ) : null}
            {tab === 'movements' ? (
              <MovementHistory warehouses={warehouses} reloadToken={reloadToken} />
            ) : null}
            {tab === 'warehouses' ? (
              <WarehouseManager
                warehouses={warehouses}
                phase={warehousePhase}
                error={warehouseError}
                onRetry={() => {
                  setWarehousePhase('loading')
                  setWarehouseReload((value) => value + 1)
                }}
                onChanged={changed}
              />
            ) : null}
          </div>
        </SectionCard>

        {dialog?.kind === 'item' ? (
          <Modal
            title={dialog.item ? t('inv.form.itemEdit') : t('inv.form.itemNew')}
            onClose={closeDialog}
          >
            <ItemForm
              item={dialog.item}
              onCancel={closeDialog}
              onSaved={(message) => {
                closeDialog()
                changed(message)
              }}
            />
          </Modal>
        ) : null}

        {dialog?.kind === 'movement' ? (
          <Modal title={t('inv.mv.title')} onClose={closeDialog}>
            <StockMovementForm
              warehouses={warehouses}
              initialItem={dialog.item}
              onCancel={closeDialog}
              onSaved={(message) => {
                closeDialog()
                changed(message)
              }}
            />
          </Modal>
        ) : null}
      </div>
    </PermissionProvider>
  )
}
