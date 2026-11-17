'use client'

import Link from 'next/link'
import { useState } from 'react'
import FinanceDashboard from '@/components/erp/FinanceDashboard'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SmartIngestLink } from '@/components/SmartIngestLink'
import { SectionCard } from '@/components/ui/section-card'
import { permissions } from '@/lib/auth/permissions'
import type { FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import AnalyticPnlPanel from '@/modules/suite/ui/AnalyticPnlPanel'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'
import { suitePrimaryBtn, suiteSecondaryBtn } from '@/modules/suite/ui/shared'

type Tab = 'accounting' | 'invoicing' | 'expenses' | 'analytic'
const tabs: readonly Tab[] = ['accounting', 'invoicing', 'expenses', 'analytic']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({
  initialTab,
  invoiceId,
}: {
  initialTab: string
  invoiceId: string | null
}) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'invoicing')
  const titles: Record<Tab, MessageKey> = {
    accounting: 'spec.accounting',
    invoicing: 'spec.invoices',
    expenses: 'spec.expenses',
    analytic: 'spec.analytic',
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('sector.finance')}
        locale={fmtLocale}
        actions={<SmartIngestLink module="accounting" />}
      >
        <div
          role="tablist"
          aria-label={t('sector.finance')}
          className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => {
            const active = tab === item
            return (
              <button
                key={item}
                type="button"
                role="tab"
                id={`finance-tab-${item}`}
                aria-selected={active}
                aria-controls={`finance-panel-${item}`}
                className={active ? suitePrimaryBtn : suiteSecondaryBtn}
                onClick={() => setTab(item)}
              >
                {t(titles[item])}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div role="tabpanel" id={`finance-panel-${tab}`} aria-labelledby={`finance-tab-${tab}`}>
        {tab === 'accounting' ? (
          <SectionCard title={t('spec.ledger')} locale={fmtLocale}>
            <div className="flex flex-wrap gap-2">
              <Link className={suitePrimaryBtn} href="/erp/ledger?tab=entries">
                {t('spec.ledger')}
              </Link>
              <Link className={suiteSecondaryBtn} href="/erp/ledger?tab=accounts">
                {t('spec.accounts')}
              </Link>
            </div>
          </SectionCard>
        ) : null}
        {tab === 'invoicing' ? <FinanceDashboard initialInvoiceId={invoiceId} /> : null}
        {tab === 'expenses' ? (
          <SectionCard title={t('spec.expenses')} locale={fmtLocale}>
            <Link className={suitePrimaryBtn} href="/erp/hr?tab=expenses">
              {t('spec.expenses')}
            </Link>
          </SectionCard>
        ) : null}
        {tab === 'analytic' ? (
          <div className="space-y-4">
            <AnalyticPnlPanel />
            <SuperOdooBoard app="analytic" title="spec.analytic" canManage={canManage} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function FinanceHub({
  permissions: held,
  initialTab,
  invoiceId = null,
}: {
  permissions: readonly string[]
  initialTab: string
  invoiceId?: string | null
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} invoiceId={invoiceId} />
    </PermissionProvider>
  )
}
