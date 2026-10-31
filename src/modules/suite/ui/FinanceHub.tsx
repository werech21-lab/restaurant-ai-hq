'use client'

import Link from 'next/link'
import { useState } from 'react'
import FinanceDashboard from '@/components/erp/FinanceDashboard'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import AnalyticPnlPanel from '@/modules/suite/ui/AnalyticPnlPanel'
import SuperOdooBoard from '@/modules/suite/ui/SuperOdooBoard'

type Tab = 'accounting' | 'invoicing' | 'expenses' | 'analytic'
const tabs: readonly Tab[] = ['accounting', 'invoicing', 'expenses', 'analytic']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab, invoiceId }: { initialTab: string; invoiceId: string | null }) {
  const { t } = useI18n()
  const canManage = useCan(permissions.suiteManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'invoicing')
  const titles: Record<Tab, MessageKey> = {
    accounting: 'spec.accounting',
    invoicing: 'spec.invoices',
    expenses: 'spec.expenses',
    analytic: 'spec.analytic',
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('sector.finance')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" className={tab === item ? primaryButton : secondaryButton} onClick={() => setTab(item)}>
            {t(titles[item])}
          </button>
        ))}
      </div>
      {tab === 'accounting' ? (
        <section className={`${panelClass} space-y-3`}>
          <p className="text-sm text-gray-300">{t('spec.ledger')}</p>
          <div className="flex flex-wrap gap-2">
            <Link className={primaryButton} href="/erp/ledger?tab=entries">{t('spec.ledger')}</Link>
            <Link className={secondaryButton} href="/erp/ledger?tab=accounts">{t('spec.accounts')}</Link>
          </div>
        </section>
      ) : null}
      {tab === 'invoicing' ? <FinanceDashboard initialInvoiceId={invoiceId} /> : null}
      {tab === 'expenses' ? (
        <section className={`${panelClass} space-y-3`}>
          <p className="text-sm text-gray-300">{t('spec.expenses')}</p>
          <Link className={primaryButton} href="/erp/hr?tab=expenses">{t('spec.expenses')}</Link>
        </section>
      ) : null}
      {tab === 'analytic' ? (
        <div className="space-y-4">
          <AnalyticPnlPanel />
          <SuperOdooBoard app="analytic" title="spec.analytic" canManage={canManage} />
        </div>
      ) : null}
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
