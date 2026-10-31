'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import AggregatorRadar from '@/modules/governance/ui/AggregatorRadar'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'website' | 'ecommerce' | 'email' | 'automation' | 'radar'
const tabs: readonly Tab[] = ['website', 'ecommerce', 'email', 'automation', 'radar']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab, held }: { initialTab: string; held: readonly string[] }) {
  const { t } = useI18n()
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'website')
  const titles: Record<Tab, MessageKey> = {
    website: 'spec.website',
    ecommerce: 'spec.ecommerce',
    email: 'spec.email',
    automation: 'spec.automation',
    radar: 'spec.radar',
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('sector.marketing')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={tab === item ? primaryButton : secondaryButton} onClick={() => setTab(item)}>
            {t(titles[item])}
          </button>
        ))}
      </div>
      {tab === 'radar' ? <AggregatorRadar permissions={held} /> : <SuperOdooBoard app={tab} title={titles[tab]} canManage={canManage} />}
    </div>
  )
}

export default function MarketingHub({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} held={held} />
    </PermissionProvider>
  )
}
