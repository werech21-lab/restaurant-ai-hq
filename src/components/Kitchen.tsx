'use client'

import { Card, Money, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Kitchen() {
  const { t } = useI18n()
  const waste = [
    { name: t('kitchen.chicken'), qty: '42', unit: t('kg'), cost: '168', bar: 'w-full' },
    { name: t('kitchen.veg'), qty: '28', unit: t('kg'), cost: '56', bar: 'w-2/3' },
    { name: t('kitchen.sauce'), qty: '15', unit: t('liter'), cost: '45', bar: 'w-[36%]' },
  ]

  return (
    <div>
      <PageHeader title={t('page.kitchen.title')} subtitle={t('page.kitchen.subtitle')} />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label={t('kitchen.waste')}
          value={<Num className="text-amber-300">8.4%</Num>}
          hint={
            <>
              {t('kitchen.target')} <Num>5%</Num>
            </>
          }
          tone="warn"
        />
        <Stat label={t('kitchen.unit')} value={<Money value="1.85" />} />
        <Stat label={t('kitchen.capacity')} value={<Num>76%</Num>} />
      </div>

      <Card>
        <h2 className="font-semibold text-mist-100">{t('kitchen.top')}</h2>
        <div className="mt-5 space-y-4">
          {waste.map((row) => (
            <div key={row.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span>{row.name}</span>
                <span className="text-mist-300">
                  <Num>{row.qty}</Num> {row.unit}
                  <span className="mx-2 text-mist-500">·</span>
                  <Money value={row.cost} />
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full bg-amber-300/80 ${row.bar}`} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
