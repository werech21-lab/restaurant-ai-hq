import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { runSmartReconciliation } from '@/services/reconciliation.service'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'
import { ReconciliationClient } from './recon-client'

export const metadata = { title: 'Smart Bank & Delivery Reconciliation | AetherBI' }

async function Content() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'accounting', 'view') && !can(user, 'sales', 'view') && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const data = await runSmartReconciliation(user.id)

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx(locale, 'مركز المطابقة الذكية · NBK + منصات التوصيل', 'Smart Reconciliation · NBK + Delivery')}
        description={tx(
          locale,
          'مطابقة إيداعات البنك الوطني (10143/10212) مع كشوفات طلبات/ديليفرو/جاهز — كشف نقص الإيداع وعمولات TGO 17% مقابل MP 10%.',
          'Match NBK deposits (10143/10212) with Talabat/Deliveroo/Jahez settlements — flag shortfalls and TGO 17% vs MP 10%.',
        )}
      />
      <div className="flex flex-wrap gap-2">
        <SmartIngestLaunchButton module="accounting" locale={locale} />
        <SmartIngestLaunchButton module="sales_delivery" locale={locale} />
        <a href="/accounting" className="rounded-xl border border-white/10 bg-[#11161f] px-4 py-2.5 text-sm font-semibold text-white">
          {tx(locale, 'المحاسبة', 'Accounting')}
        </a>
      </div>
      <ReconciliationClient initial={data} locale={locale} />
    </div>
  )
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Reconciliation" />}>
      <Content />
    </Suspense>
  )
}
