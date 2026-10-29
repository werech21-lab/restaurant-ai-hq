'use client'

import { Card, Money, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { CommandCenterMetrics } from '@/lib/command-center'

export default function Delivery({ metrics }: { metrics: CommandCenterMetrics }) {
  const { t } = useI18n()

  return (
    <div>
      <PageHeader title={t('page.delivery.title')} subtitle={metrics.scoped ? t('delivery.live') : t('cc.empty')} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Stat label={t('delivery.orders')} value={<Num>{metrics.deliveryOrders.toLocaleString('en-US')}</Num>} />
        <Stat label={t('delivery.commission')} value={<Money value={formatMinor(metrics.commissionMinor)} />} />
      </div>
      <Card>
        <p className="text-sm text-mist-300">{t('delivery.live')}</p>
      </Card>
    </div>
  )
}
