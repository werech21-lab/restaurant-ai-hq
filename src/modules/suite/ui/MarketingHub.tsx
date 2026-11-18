'use client'

import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import AggregatorRadar from '@/modules/governance/ui/AggregatorRadar'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Tab = 'website' | 'ecommerce' | 'email' | 'automation' | 'radar'
// 'radar' tab is unlinked (AggregatorRadar renders UnlinkedSourceNotice); hidden until Tgo/TMP settlement feed is wired.
const tabs: readonly Tab[] = ['website', 'ecommerce', 'email', 'automation']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab, held }: { initialTab: string; held: readonly string[] }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'website')
  const titles: Record<Exclude<Tab, 'radar'>, MessageKey> = {
    website: 'spec.website',
    ecommerce: 'spec.ecommerce',
    email: 'spec.email',
    automation: 'spec.automation',
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard title={t('sector.marketing')} locale={fmtLocale}>
        <div
          role="tablist"
          aria-label={t('sector.marketing')}
          className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`marketing-tab-${item}`}
                aria-selected={active}
                aria-controls={`marketing-panel-${item}`}
                className={active ? suitePrimaryBtn : suiteSecondaryBtn}
                onClick={() => setTab(item)}
              >
                {item === 'radar' ? t('erpnav.aggregator') : t(titles[item])}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div role="tabpanel" id={`marketing-panel-${tab}`} aria-labelledby={`marketing-tab-${tab}`}>
        {tab === 'radar' ? (
          <AggregatorRadar permissions={held} />
        ) : (
          <SuperOdooBoard app={tab} title={titles[tab]} canManage={canManage} />
        )}
      </div>
    </div>
  )
}

export default function MarketingHub({
  permissions: held,
  initialTab,
}: {
  permissions: readonly string[]
  initialTab: string
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} held={held} />
    </PermissionProvider>
  )
}
