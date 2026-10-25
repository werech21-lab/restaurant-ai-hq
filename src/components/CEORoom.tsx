'use client'

import { Card, Money, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function CEORoom() {
  const { t } = useI18n()
  const alerts = [
    { tone: 'bg-rose-400', text: t('alert.margin') },
    { tone: 'bg-amber-300', text: t('alert.waste') },
    { tone: 'bg-sky-300', text: t('alert.contract') },
  ]

  return (
    <div>
      <PageHeader title={t('page.ceo.title')} subtitle={t('page.ceo.subtitle')} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('stat.yesterday')} value={<Money value="48,250" />} hint={<Num>+6.4%</Num>} tone="good" />
        <Stat
          label={t('stat.margin')}
          value={<Num>32.1%</Num>}
          hint={
            <>
              <Num>-1.8</Num> {t('point')}
            </>
          }
          tone="bad"
        />
        <Stat label={t('stat.branches')} value={<Num>18/20</Num>} hint={t('hint.watch')} tone="warn" />
        <Stat label={t('stat.health')} value={<Num className="text-sky-300">86</Num>} hint={t('hint.stable')} tone="good" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-mist-100">{t('alerts.title')}</h2>
          <div className="mt-4 space-y-2 text-sm">
            {alerts.map((alert) => (
              <div key={alert.text} className="flex items-center gap-3 rounded-xl border border-gold-300/10 bg-black/25 px-3 py-3 transition hover:border-gold-300/25 hover:bg-gold-300/[0.05]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${alert.tone}`} />
                {alert.text}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-mist-100">{t('decisions.title')}</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="rounded-xl border border-gold-300/10 bg-black/25 px-4 py-3 transition hover:border-gold-300/25 hover:bg-gold-300/[0.05]">
              {t('decision.waste')} <Money value="36,000" />
            </div>
            <div className="rounded-xl border border-gold-300/10 bg-black/25 px-4 py-3 transition hover:border-gold-300/25 hover:bg-gold-300/[0.05]">
              {t('decision.chicken')} <Num>4.2%</Num>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
