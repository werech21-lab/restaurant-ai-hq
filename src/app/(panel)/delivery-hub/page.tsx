import { Suspense } from 'react'
import { connection } from 'next/server'
import { DeliveryHubPanel } from '@/app/(panel)/delivery-hub/delivery-hub-panel'
import { requireUser } from '@/lib/erp-auth'
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getLocale, tx } from '@/lib/i18n/server'
import { getActiveScope } from '@/lib/scope'
import { aggregatorSummary, listOpenOrders } from '@/services/delivery.service'
import { SmartIngestLaunchButton } from '@/components/SmartIngestLaunchButton'

export const metadata = { title: 'منصات التوصيل | AetherBI' }
export const dynamic = 'force-dynamic'

async function DeliveryHubContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'delivery-hub', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  const locale = await getLocale()
  if (!(await isModuleEnabled('delivery-hub'))) {
    return <DisabledModule title={tx(locale, 'منصات التوصيل', 'Delivery aggregators')} />
  }

  const scope = await getActiveScope()
  const scopeLabel = locale === 'en' ? scope.labelEn : scope.labelAr
  const filter = {
    brandCode: scope.brandId,
    branchCode: scope.branchId,
    warehouseIds: scope.warehouseIds,
  }
  const [platforms, orders] = await Promise.all([aggregatorSummary(filter), listOpenOrders(filter)])

  return (
    <div>
      <PageHeader
        title={tx(locale, 'منصات التوصيل', 'Delivery aggregators')}
        description={`${scopeLabel} · Talabat · Deliveroo · Jahez · In-House`}
      />
      <div className="mb-4">
        <SmartIngestLaunchButton module="sales_delivery" locale={locale} />
      </div>
      <DeliveryHubPanel
        platforms={platforms}
        orders={orders.map((order) => ({
          id: order.id,
          platformCode: order.platformCode,
          invoiceNumber: order.invoiceNumber,
          grossAmount: order.grossAmount,
          commissionAmount: order.commissionAmount,
          netPayout: order.netPayout,
          createdAt: order.createdAt.toISOString(),
        }))}
        brandCode={scope.brandId}
        canEdit={can(user, 'delivery-hub', 'edit')}
        canSettle={can(user, 'delivery-hub', 'create')}
      />
    </div>
  )
}

export default function DeliveryHubPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Delivery" />}>
      <DeliveryHubContent />
    </Suspense>
  )
}
