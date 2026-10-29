'use client'

import { Card, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import type { CommandCenterMetrics } from '@/lib/command-center'

export default function Kitchen({ metrics }: { metrics: CommandCenterMetrics }) {
  const { t } = useI18n()

  return (
    <div>
      <PageHeader title={t('page.kitchen.title')} subtitle={metrics.scoped ? t('kitchen.live') : t('cc.empty')} />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Stat label={t('kitchen.recipes')} value={<Num>{metrics.recipes.toLocaleString('en-US')}</Num>} />
        <Stat label={t('kitchen.wasteQty')} value={<Num>{metrics.wasteQuantity.toLocaleString('en-US')}</Num>} hint={t('kitchen.wasteNote')} tone="warn" />
      </div>
      <Card>
        <p className="text-sm text-mist-300">{t('kitchen.live')}</p>
      </Card>
    </div>
  )
}
