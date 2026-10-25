'use client'

import { Card, Num, PageHeader } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Quality() {
  const { t } = useI18n()
  const alerts = [
    {
      tone: 'bg-rose-400',
      text: (
        <>
          {t('quality.temp')} <Num>{t('quality.tempValue')}</Num>
        </>
      ),
    },
    { tone: 'bg-amber-300', text: t('quality.scale') },
    {
      tone: 'bg-sky-300',
      text: (
        <>
          <Num>14</Num> {t('quality.staff')}
        </>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title={t('page.quality.title')} subtitle={t('page.quality.subtitle')} />

      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <Card key={index}>
            <div className="flex items-start gap-3 text-sm leading-7">
              <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${alert.tone}`} />
              <p>{alert.text}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
