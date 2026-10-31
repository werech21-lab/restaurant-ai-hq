'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { PermissionProvider } from '@/components/erp/permissions'
import { errorClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Item, Warehouse } from '@/modules/inventory/client'
import { InventoryOverview } from '@/modules/inventory/ui/InventoryOverview'
import { ItemForm } from '@/modules/inventory/ui/ItemForm'
import { MovementHistory } from '@/modules/inventory/ui/MovementHistory'
import { ProductCatalog } from '@/modules/inventory/ui/ProductCatalog'
import { Modal, type ListPage, type Phase } from '@/modules/inventory/ui/shared'
import { StockMovementForm } from '@/modules/inventory/ui/StockMovementForm'
import { WarehouseManager } from '@/modules/inventory/ui/WarehouseManager'

const tabs = ['overview', 'catalog', 'movements', 'warehouses'] as const
type Tab = (typeof tabs)[number]

type Dialog = { kind: 'item'; item?: Item } | { kind: 'movement'; item?: Item } | null

/** The inventory screen: overview, product catalog, stock movement ledger and warehouses. */
export default function InventoryWorkspace({ initialItemId = null, permissions = [] }: { initialItemId?: string | null; permissions?: readonly string[] }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>(initialItemId ? 'catalog' : 'overview')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [linkError, setLinkError] = useState<MessageKey | null>(null)
  // Bumped after any change so every tab reloads its data.
  const [reloadToken, setReloadToken] = useState(0)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehousePhase, setWarehousePhase] = useState<Phase>('loading')
  const [warehouseError, setWarehouseError] = useState<MessageKey>('erp.err.generic')
  const [warehouseReload, setWarehouseReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<ListPage<Warehouse>>('/api/v1/inventory/warehouses?limit=100&status=all', { signal: controller.signal })
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

  // A link with an item id opens that item for editing on arrival.
  useEffect(() => {
    if (!initialItemId) return
    const controller = new AbortController()
    apiRequest<{ data: Item }>(`/api/v1/inventory/items/${initialItemId}`, { signal: controller.signal })
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
    <div>
      <Link href="/" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('inv.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('inv.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDialog({ kind: 'movement' })} className={secondaryButton}>
            {t('inv.stockEntry')}
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'item' })} className={primaryButton}>
            {t('inv.newItem')}
          </button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={`${noticeClass} mb-4`}>
          {t(notice)}
        </p>
      ) : null}

      {linkError ? (
        <p role="alert" className={`${errorClass} mb-4`}>
          {t(linkError)}
        </p>
      ) : null}

      <div role="tablist" aria-label={t('inv.title')} className="mb-4 flex flex-wrap gap-1 border-b border-[#30363d]">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`inv-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`inv-panel-${value}`}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(`inv.tab.${value}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`inv-panel-${tab}`} aria-labelledby={`inv-tab-${tab}`}>
        {tab === 'overview' ? <InventoryOverview reloadToken={reloadToken} onStockEntry={(item) => setDialog({ kind: 'movement', item })} /> : null}
        {tab === 'catalog' ? (
          <ProductCatalog
            reloadToken={reloadToken}
            onEdit={(item) => setDialog({ kind: 'item', item })}
            onStockEntry={(item) => setDialog({ kind: 'movement', item })}
          />
        ) : null}
        {tab === 'movements' ? <MovementHistory warehouses={warehouses} reloadToken={reloadToken} /> : null}
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

      {dialog?.kind === 'item' ? (
        <Modal title={dialog.item ? t('inv.form.itemEdit') : t('inv.form.itemNew')} onClose={closeDialog}>
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
