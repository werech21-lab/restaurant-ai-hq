'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import InventoryWorkspace from '@/modules/inventory/ui/InventoryWorkspace'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Tab = 'stock' | 'mrp' | 'purchase' | 'plm' | 'maintenance'
const tabs: readonly Tab[] = ['stock', 'mrp', 'purchase', 'plm', 'maintenance']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({
  initialTab,
  itemId,
  held,
}: {
  initialTab: string
  itemId: string | null
  held: readonly string[]
}) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
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
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard title={t('sector.inventory')} locale={fmtLocale}>
        <div
          role="tablist"
          aria-label={t('sector.inventory')}
          className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`inventory-tab-${item}`}
                aria-selected={active}
                aria-controls={`inventory-panel-${item}`}
                className={`shrink-0 whitespace-nowrap ${active ? suitePrimaryBtn : suiteSecondaryBtn}`}
                onClick={() => setTab(item)}
              >
                {t(titles[item])}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div role="tabpanel" id={`inventory-panel-${tab}`} aria-labelledby={`inventory-tab-${tab}`}>
        {tab === 'stock' ? (
          <InventoryWorkspace initialItemId={itemId} permissions={held} />
        ) : null}
        {tab === 'mrp' ? (
          <div className="space-y-4">
            <SectionCard title={t('spec.mrp')} subtitle={t('inv.mrp.lead')} locale={fmtLocale}>
              <div className="flex flex-wrap gap-2">
                <Link className={suitePrimaryBtn} href="/erp/kitchen">
                  {t('spec.kitchen')}
                </Link>
                <Link className={suiteSecondaryBtn} href="/erp/org">
                  {t('spec.org')}
                </Link>
              </div>
            </SectionCard>
            <SuperOdooBoard app="mrp" title="spec.mrp" canManage={canManage} />
          </div>
        ) : null}
        {tab === 'purchase' ? (
          <SectionCard title={t('spec.purchasing')} locale={fmtLocale}>
            <Link className={suitePrimaryBtn} href="/erp/procurement?tab=requests">
              {t('spec.purchasing')}
            </Link>
          </SectionCard>
        ) : null}
        {tab === 'plm' ? (
          <SuperOdooBoard app="plm" title="spec.plm" canManage={canManage} />
        ) : null}
        {tab === 'maintenance' ? (
          <SuperOdooBoard app="maintenance" title="spec.maintenance" canManage={canManage} />
        ) : null}
      </div>
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
