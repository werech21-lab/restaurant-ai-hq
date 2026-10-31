'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import InventoryWorkspace from '@/modules/inventory/ui/InventoryWorkspace'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'stock' | 'mrp' | 'purchase' | 'plm' | 'maintenance'
const tabs: readonly Tab[] = ['stock', 'mrp', 'purchase', 'plm', 'maintenance']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab, itemId, held }: { initialTab: string; itemId: string | null; held: readonly string[] }) {
  const { t } = useI18n()
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'stock')
  const titles: Record<Tab, MessageKey> = {
    stock: 'spec.inventory',
    mrp: 'spec.mrp',
    purchase: 'spec.purchasing',
    plm: 'spec.plm',
    maintenance: 'spec.maintenance',
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('sector.inventory')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={tab === item ? primaryButton : secondaryButton} onClick={() => setTab(item)}>
            {t(titles[item])}
          </button>
        ))}
      </div>
      {tab === 'stock' ? <InventoryWorkspace initialItemId={itemId} permissions={held} /> : null}
      {tab === 'mrp' ? <SuperOdooBoard app="mrp" title="spec.mrp" canManage={canManage} /> : null}
      {tab === 'purchase' ? (
        <section className={`${panelClass} space-y-3`}>
          <p className="text-sm text-gray-300">{t('spec.purchasing')}</p>
          <Link className={primaryButton} href="/erp/procurement?tab=requests">{t('spec.purchasing')}</Link>
        </section>
      ) : null}
      {tab === 'plm' ? <SuperOdooBoard app="plm" title="spec.plm" canManage={canManage} /> : null}
      {tab === 'maintenance' ? <SuperOdooBoard app="maintenance" title="spec.maintenance" canManage={canManage} /> : null}
    </div>
  )
}

export default function InventoryHub({
  permissions: held,
  initialTab,
  itemId = null,
}: {
  permissions: readonly string[]
  initialTab: string
  itemId?: string | null
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} itemId={itemId} held={held} />
    </PermissionProvider>
  )
}
