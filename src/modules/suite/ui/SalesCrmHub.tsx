'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SmartIngestLink } from '@/components/SmartIngestLink'
import { SectionCard } from '@/components/ui/section-card'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import CrmWorkspace from '@/modules/crm/ui/CrmWorkspace'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Tab = 'crm' | 'sales' | 'pos' | 'subscriptions'
const tabs: readonly Tab[] = ['crm', 'sales', 'pos', 'subscriptions']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'crm')
  const titles: Record<Tab, MessageKey> = {
    crm: 'spec.crm',
    sales: 'spec.sales',
    pos: 'spec.pos',
    subscriptions: 'spec.subscriptions',
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('sector.sales')}
        subtitle={t('hub.crm')}
        locale={fmtLocale}
        actions={<SmartIngestLink module="crm_projects" />}
      >
        <div
          role="tablist"
          aria-label={t('sector.sales')}
          className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`sales-crm-tab-${item}`}
                aria-selected={active}
                aria-controls={`sales-crm-panel-${item}`}
                className={`shrink-0 whitespace-nowrap ${active ? suitePrimaryBtn : suiteSecondaryBtn}`}
                onClick={() => setTab(item)}
              >
                {t(titles[item])}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div role="tabpanel" id={`sales-crm-panel-${tab}`} aria-labelledby={`sales-crm-tab-${tab}`}>
        {tab === 'crm' ? <CrmWorkspace /> : null}
        {tab === 'sales' ? (
          <SuperOdooBoard app="sales_orders" title="spec.sales" canManage={canManage} />
        ) : null}
        {tab === 'pos' ? (
          <SuperOdooBoard app="pos_sessions" title="spec.pos" canManage={canManage} />
        ) : null}
        {tab === 'subscriptions' ? (
          <SuperOdooBoard app="subscriptions" title="spec.subscriptions" canManage={canManage} />
        ) : null}
      </div>
    </div>
  )
}

export default function SalesCrmHub({
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
