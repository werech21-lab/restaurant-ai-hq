import { Suspense } from 'react'
import { connection } from 'next/server'
import { DeliveryHubPanel } from '@/app/(panel)/delivery-hub/delivery-hub-panel'
import { requireUser } from '@/lib/erp-auth'
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { aggregatorSummary, listOpenOrders } from '@/services/delivery.service'

export const metadata = { title: 'منصات التوصيل | AetherBI' }
export const dynamic = 'force-dynamic'

async function DeliveryHubContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'delivery-hub', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!(await isModuleEnabled('delivery-hub'))) return <DisabledModule title="منصات التوصيل" />

  const scope = await getActiveScope()
  const filter = {
    brandCode: scope.brandId,
    branchCode: scope.branchId,
    warehouseIds: scope.warehouseIds,
  }
  const [platforms, orders] = await Promise.all([aggregatorSummary(filter), listOpenOrders(filter)])

  return (
    <div>
      <PageHeader
        title="منصات التوصيل · Kuwait Delivery Hub"
        description={`${scope.labelAr} · Talabat · Deliveroo · Jahez · Cari · In-House`}
      />
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
    <Suspense fallback={<PageSkeleton title="منصات التوصيل" />}>
      <DeliveryHubContent />
    </Suspense>
  )
}
