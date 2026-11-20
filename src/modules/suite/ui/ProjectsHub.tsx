'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SmartIngestLink } from '@/components/SmartIngestLink'
import { SectionCard } from '@/components/ui/section-card'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Tab = 'project' | 'timesheets' | 'helpdesk'
const tabs: readonly Tab[] = ['project', 'timesheets', 'helpdesk']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'project')
  const titles: Record<Tab, MessageKey> = {
    project: 'spec.project',
    timesheets: 'spec.timesheets',
    helpdesk: 'spec.helpdesk',
  }
  const apps = { project: 'projects', timesheets: 'timesheets', helpdesk: 'helpdesk' } as const

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('sector.projects')}
        locale={fmtLocale}
        actions={<SmartIngestLink module="crm_projects" />}
      >
        <div
          role="tablist"
          aria-label={t('sector.projects')}
          className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`projects-tab-${item}`}
                aria-selected={active}
                aria-controls={`projects-panel-${item}`}
                className={`shrink-0 whitespace-nowrap ${active ? suitePrimaryBtn : suiteSecondaryBtn}`}
                onClick={() => setTab(item)}
              >
                {t(titles[item])}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div role="tabpanel" id={`projects-panel-${tab}`} aria-labelledby={`projects-tab-${tab}`}>
        <SuperOdooBoard app={apps[tab]} title={titles[tab]} canManage={canManage} />
      </div>
    </div>
  )
}

export default function ProjectsHub({
  permissions: held,
  initialTab,
}: {
  permissions: readonly string[]
  initialTab: string
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
