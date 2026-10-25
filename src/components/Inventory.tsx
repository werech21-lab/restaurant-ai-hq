'use client'

import { Badge, Card, Money, Num, PageHeader, Stat } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export default function Inventory() {
  const { t } = useI18n()
  const items = [
    { name: t('stock.chicken'), qty: '12', unit: t('kg'), status: t('stock.low'), tone: 'bad' as const },
    { name: t('stock.lettuce'), qty: '4', unit: t('kg'), status: t('stock.low'), tone: 'bad' as const },
    { name: t('stock.oil'), qty: '18', unit: t('liter'), status: t('stock.soon'), tone: 'warn' as const },
    { name: t('stock.garlic'), qty: '6', unit: t('liter'), status: t('stock.soon'), tone: 'warn' as const },
  ]

  return (
    <div>
      <PageHeader title={t('page.inventory.title')} subtitle={t('page.inventory.subtitle')} />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label={t('stock.below')} value={<Num className="text-rose-400">7</Num>} />
        <Stat label={t('stock.expiring')} value={<Num className="text-amber-300">12</Num>} />
        <Stat label={t('stock.value')} value={<Money value="186,400" />} />
      </div>

      <Card>
        <h2 className="font-semibold text-mist-100">{t('stock.follow')}</h2>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-1">
              <span className="font-medium">{item.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-mist-300">
                  <Num>{item.qty}</Num> {item.unit}
                </span>
                <Badge tone={item.tone}>{item.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
