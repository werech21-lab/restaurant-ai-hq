'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'crm' | 'sales' | 'pos' | 'subscriptions'
const tabs: readonly Tab[] = ['crm', 'sales', 'pos', 'subscriptions']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'crm')
  const titles: Record<Tab, MessageKey> = {
    crm: 'spec.crm',
    sales: 'spec.sales',
    pos: 'spec.pos',
    subscriptions: 'spec.subscriptions',
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('sector.sales')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('hub.crm')}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={tab === item ? primaryButton : secondaryButton} onClick={() => setTab(item)}>
            {t(titles[item])}
          </button>
        ))}
      </div>
      {tab === 'crm' ? <CrmWorkspace /> : null}
      {tab === 'sales' ? <SuperOdooBoard app="sales_orders" title="spec.sales" canManage={canManage} /> : null}
      {tab === 'pos' ? <SuperOdooBoard app="pos_sessions" title="spec.pos" canManage={canManage} /> : null}
      {tab === 'subscriptions' ? <SuperOdooBoard app="subscriptions" title="spec.subscriptions" canManage={canManage} /> : null}
    </div>
  )
}

export default function SalesCrmHub({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
