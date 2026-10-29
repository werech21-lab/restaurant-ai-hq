'use client'

import { Card, Money, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { CommandCenterMetrics } from '@/lib/command-center'

export default function CEORoom({ metrics }: { metrics: CommandCenterMetrics }) {
  const { t } = useI18n()

  return (
    <div>
      <PageHeader title={t('page.ceo.title')} subtitle={metrics.scoped ? t('page.ceo.subtitle') : t('cc.empty')} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('cc.revenue')} value={<Money value={formatMinor(metrics.revenueMinor)} />} tone="good" />
        <Stat label={t('cc.expenses')} value={<Money value={formatMinor(metrics.expenseMinor)} />} tone="warn" />
        <Stat label={t('cc.onHand')} value={<Num>{metrics.stockOnHand.toLocaleString('en-US')}</Num>} hint={t('cc.stockHint')} tone={metrics.stockAlerts > 0 ? 'bad' : 'good'} />
        <Stat label={t('cc.journals')} value={<Num>{metrics.postedJournals.toLocaleString('en-US')}</Num>} tone="good" />
      </div>

      <Card>
        <h2 className="font-semibold text-mist-100">{t('alerts.title')}</h2>
        <p className="mt-4 text-sm text-mist-300">
          {metrics.scoped ? t('cc.banner') : t('cc.empty')}{' '}
          <Num>{metrics.pendingApprovals.toLocaleString('en-US')}</Num> {t('cc.approvals')}
        </p>
      </Card>
    </div>
  )
}
