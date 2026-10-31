'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'project' | 'timesheets' | 'helpdesk'
const tabs: readonly Tab[] = ['project', 'timesheets', 'helpdesk']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'project')
  const titles: Record<Tab, MessageKey> = {
    project: 'spec.project',
    timesheets: 'spec.timesheets',
    helpdesk: 'spec.helpdesk',
  }
  const apps = { project: 'projects', timesheets: 'timesheets', helpdesk: 'helpdesk' } as const

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('sector.projects')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={tab === item ? primaryButton : secondaryButton} onClick={() => setTab(item)}>
            {t(titles[item])}
          </button>
        ))}
      </div>
      <SuperOdooBoard app={apps[tab]} title={titles[tab]} canManage={canManage} />
    </div>
  )
}

export default function ProjectsHub({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
